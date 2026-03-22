/**
 * Globex Sky — 1688.service.js
 * 1688 (China domestic B2B) product sync service.
 *
 * Supports:
 *  - Product search
 *  - Product detail fetching with Chinese→English translation
 *  - Price conversion (CNY → USD)
 *  - Product import
 *  - Supplier verification status mapping
 *  - MOQ (Minimum Order Quantity) mapping
 */

import crypto from 'crypto';
import supabase from '../../config/supabase.js';
import { china1688Config } from '../../config/integrations.js';
import { uploadFromUrl } from '../cloudinary.service.js';

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const _callTimestamps = [];

function _rateLimit() {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (_callTimestamps.length && _callTimestamps[0] < windowStart) _callTimestamps.shift();
  if (_callTimestamps.length >= china1688Config.rateLimitPerMinute) {
    const waitMs = 60_000 - (now - _callTimestamps[0]);
    return new Promise(resolve => setTimeout(resolve, waitMs + 100));
  }
  _callTimestamps.push(now);
  return Promise.resolve();
}

// ─── Request Signing ─────────────────────────────────────────────────────────

function _buildSignedUrl(method, params = {}) {
  const allParams = {
    method,
    app_key: china1688Config.appKey,
    access_token: china1688Config.accessToken,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-md5',
    ...params,
  };

  const sorted = Object.keys(allParams).sort().map(k => `${k}${allParams[k]}`).join('');
  const sign = crypto.createHmac('md5', china1688Config.appSecret).update(sorted).digest('hex').toUpperCase();

  const qs = new URLSearchParams({ ...allParams, sign }).toString();
  return `${china1688Config.baseUrl}?${qs}`;
}

async function _apiCall(method, params = {}, retries = 3) {
  await _rateLimit();
  const url = _buildSignedUrl(method, params);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error_response) throw new Error(data.error_response.msg || '1688 API error');
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ─── Translation ─────────────────────────────────────────────────────────────

/**
 * Translate Chinese text to English via the configured translation API.
 * Falls back to the original text if translation is unavailable.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function _translateToEnglish(text) {
  if (!text || !china1688Config.translateApiKey) return text;
  try {
    const url = `${china1688Config.translateApiUrl}?key=${china1688Config.translateApiKey}&q=${encodeURIComponent(text)}&source=zh-CN&target=en`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const json = await res.json();
    return json?.data?.translations?.[0]?.translatedText || text;
  } catch (_) {
    return text;
  }
}

// ─── Currency Conversion ─────────────────────────────────────────────────────

/**
 * Fetch the live CNY→USD rate (with fallback to configured static rate).
 * @returns {Promise<number>} Exchange rate
 */
async function _getUsdRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/CNY');
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.USD) return data.rates.USD;
    }
  } catch (_) { /* use static rate */ }
  return china1688Config.cnyToUsdRate;
}

/**
 * Convert CNY to USD using live or configured rate.
 * @param {number} cnyAmount
 * @returns {Promise<number>}
 */
async function _cnyToUsd(cnyAmount) {
  if (!cnyAmount) return 0;
  const rate = await _getUsdRate();
  return parseFloat((cnyAmount * rate).toFixed(4));
}

// ─── Supplier Verification Mapping ───────────────────────────────────────────

const SUPPLIER_LEVEL_MAP = {
  0: 'unverified',
  1: 'basic',
  2: 'verified',
  3: 'gold',
  4: 'platinum',
};

function _mapSupplierLevel(level) {
  return SUPPLIER_LEVEL_MAP[parseInt(level, 10)] || 'unverified';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search for products on 1688.
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=20]
 * @param {string} [opts.categoryId]
 * @param {number} [opts.minPrice] - in CNY
 * @param {number} [opts.maxPrice] - in CNY
 * @returns {object} { products, total, page }
 */
export async function searchProducts({ keyword, page = 1, pageSize = 20, categoryId, minPrice, maxPrice } = {}) {
  const params = { keywords: keyword, beginPage: page, pageSize };
  if (categoryId) params.categoryId = categoryId;
  if (minPrice != null) params.priceStart = minPrice;
  if (maxPrice != null) params.priceEnd = maxPrice;

  const data = await _apiCall('com.alibaba.fenxiao.trade.product.search', params);
  const raw = data?.result?.data || [];
  const total = data?.result?.totalCount || 0;

  // Fetch exchange rate once for all products
  const usdRate = await _getUsdRate();

  const products = await Promise.all(raw.map(async p => {
    const titleEn = await _translateToEnglish(p.subjectTrans || p.subject || '');
    const priceCny = parseFloat(p.priceInfo?.price || 0);
    const priceUsd = parseFloat((priceCny * usdRate).toFixed(4));
    return {
      externalId: String(p.offerId || p.productId),
      title: titleEn,
      titleZh: p.subject || '',
      priceUsd,
      priceCny,
      moq: parseInt(p.minOrderQuantity || 1, 10),
      imageUrl: p.imageUrl || '',
      supplierId: String(p.memberId || ''),
      supplierName: p.sellerLoginId || '',
      supplierLevel: _mapSupplierLevel(p.memberLevelName),
      source: '1688',
    };
  }));

  return { products, total, page };
}

/**
 * Fetch full product details from 1688 with translation.
 * @param {string} productId
 */
export async function getProductDetail(productId) {
  const data = await _apiCall('com.alibaba.product.get', { offerId: productId });
  const p = data?.result;
  if (!p) throw new Error(`Product ${productId} not found on 1688.`);

  const titleEn = await _translateToEnglish(p.subject || '');
  const descEn = await _translateToEnglish(p.description || '');
  const priceUsd = await _cnyToUsd(parseFloat(p.priceInfo?.price || 0));

  return {
    externalId: String(p.offerId || productId),
    title: titleEn,
    titleZh: p.subject || '',
    description: descEn,
    descriptionZh: p.description || '',
    priceUsd,
    priceCny: parseFloat(p.priceInfo?.price || 0),
    currency: 'USD',
    moq: parseInt(p.minOrderQuantity || 1, 10),
    images: Array.isArray(p.imageList) ? p.imageList : [],
    attributes: p.attributes || [],
    categoryId: String(p.categoryId || ''),
    supplierId: String(p.memberId || ''),
    supplierName: p.sellerLoginId || '',
    supplierLevel: _mapSupplierLevel(p.supplierLevel),
    source: '1688',
  };
}

/**
 * Import a 1688 product into the local database.
 * @param {string} productId
 * @param {string} importedBy - Admin user ID
 */
export async function importProduct(productId, importedBy) {
  const detail = await getProductDetail(productId);

  let primaryImage = detail.images[0] || '';
  if (primaryImage) {
    try {
      const uploaded = await uploadFromUrl(primaryImage, `1688/${productId}`);
      primaryImage = uploaded.secure_url;
    } catch (_) { /* keep original */ }
  }

  const product = {
    name: detail.title,
    name_zh: detail.titleZh,
    description: detail.description,
    price: detail.priceUsd,
    currency: 'USD',
    moq: detail.moq,
    images: [primaryImage, ...detail.images.slice(1)].filter(Boolean),
    external_id: detail.externalId,
    external_source: '1688',
    supplier_external_id: detail.supplierId,
    supplier_name: detail.supplierName,
    status: 'pending',
    imported_by: importedBy,
    metadata: {
      attributes: detail.attributes,
      price_cny: detail.priceCny,
      supplier_level: detail.supplierLevel,
    },
  };

  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Periodic sync: update prices and stock for all 1688-sourced products.
 * @returns {{ updated: number, errors: number, total: number }}
 */
export async function syncProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, external_id, metadata')
    .eq('external_source', '1688')
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  let updated = 0;
  let errors = 0;

  for (const product of products || []) {
    try {
      const detail = await getProductDetail(product.external_id);
      await supabase.from('products').update({
        price: detail.priceUsd,
        metadata: { ...(product.metadata || {}), price_cny: detail.priceCny },
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);
      updated++;
    } catch (_) {
      errors++;
    }
  }

  return { updated, errors, total: (products || []).length };
}
