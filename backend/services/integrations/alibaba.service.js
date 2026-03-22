/**
 * Globex Sky — alibaba.service.js
 * Alibaba Open Platform product sync service.
 *
 * Supports:
 *  - Product search
 *  - Product detail fetching
 *  - Supplier information retrieval
 *  - Price comparison
 *  - Product import to local database
 *  - Periodic sync (prices, availability)
 *  - Category mapping (Alibaba → Globex Sky)
 *  - Image download and re-upload to Cloudinary
 *  - Rate limiting to respect Alibaba API limits
 */

import crypto from 'crypto';
import supabase from '../../config/supabase.js';
import { alibabaConfig } from '../../config/integrations.js';
import { uploadFromUrl } from '../cloudinary.service.js';

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const _callTimestamps = [];

function _rateLimit() {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (_callTimestamps.length && _callTimestamps[0] < windowStart) _callTimestamps.shift();
  if (_callTimestamps.length >= alibabaConfig.rateLimitPerMinute) {
    const waitMs = 60_000 - (now - _callTimestamps[0]);
    return new Promise(resolve => setTimeout(resolve, waitMs + 100));
  }
  _callTimestamps.push(now);
  return Promise.resolve();
}

// ─── Request Signing ─────────────────────────────────────────────────────────

/**
 * Generate a signed Alibaba Open Platform API request URL.
 */
function _buildSignedUrl(method, params = {}) {
  const allParams = {
    method,
    app_key: alibabaConfig.appKey,
    access_token: alibabaConfig.accessToken,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-md5',
    ...params,
  };

  const sorted = Object.keys(allParams).sort().map(k => `${k}${allParams[k]}`).join('');
  const sign = crypto.createHmac('md5', alibabaConfig.appSecret).update(sorted).digest('hex').toUpperCase();

  const qs = new URLSearchParams({ ...allParams, sign }).toString();
  return `${alibabaConfig.baseUrl}?${qs}`;
}

async function _apiCall(method, params = {}, retries = 3) {
  await _rateLimit();
  const url = _buildSignedUrl(method, params);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error_response) throw new Error(data.error_response.msg || 'Alibaba API error');
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ─── Category Mapping ────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  '281': 'Electronics',
  '136': 'Clothing & Apparel',
  '57': 'Home & Garden',
  '26': 'Sports & Outdoors',
  '84': 'Toys & Games',
  '63': 'Health & Beauty',
  '29': 'Automotive',
  '15': 'Industrial Machinery',
  '39': 'Food & Agriculture',
  '47': 'Chemical Products',
};

function _mapCategory(alibabaCategory) {
  return CATEGORY_MAP[String(alibabaCategory)] || 'Other';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search for products on Alibaba.
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=20]
 * @param {string} [opts.categoryId]
 * @param {number} [opts.minPrice]
 * @param {number} [opts.maxPrice]
 * @returns {object} { products, total, page }
 */
export async function searchProducts({ keyword, page = 1, pageSize = 20, categoryId, minPrice, maxPrice } = {}) {
  const params = { keywords: keyword, page_index: page, page_size: pageSize };
  if (categoryId) params.category_id = categoryId;
  if (minPrice != null) params.price_from = minPrice;
  if (maxPrice != null) params.price_to = maxPrice;

  const data = await _apiCall('alibaba.icbu.product.search', params);
  const raw = data?.alibaba_icbu_product_search_response?.result?.products?.product || [];
  const total = data?.alibaba_icbu_product_search_response?.result?.total_count || 0;

  const products = raw.map(p => ({
    externalId: String(p.subject_id || p.product_id),
    title: p.subject || p.title,
    price: parseFloat(p.price_range?.price_from || p.price || 0),
    priceMax: parseFloat(p.price_range?.price_to || p.price || 0),
    currency: p.price_range?.currency || 'USD',
    moq: parseInt(p.min_order_quantity || 1, 10),
    imageUrl: p.main_image || '',
    detailUrl: p.detail_url || '',
    supplierId: String(p.company_id || ''),
    supplierName: p.company_name || '',
    category: _mapCategory(p.category_id),
    source: 'alibaba',
  }));

  return { products, total, page };
}

/**
 * Fetch full product details from Alibaba.
 * @param {string} productId - Alibaba product ID
 */
export async function getProductDetail(productId) {
  const data = await _apiCall('alibaba.icbu.product.get', { product_id: productId });
  const p = data?.alibaba_icbu_product_get_response?.product;
  if (!p) throw new Error(`Product ${productId} not found on Alibaba.`);

  return {
    externalId: String(p.subject_id || p.product_id),
    title: p.subject,
    description: p.description || '',
    price: parseFloat(p.price_info?.price || 0),
    currency: p.price_info?.currency || 'USD',
    moq: parseInt(p.min_order_quantity || 1, 10),
    images: Array.isArray(p.image_list?.image) ? p.image_list.image.map(i => i.original_image_url || i.image_url) : [],
    attributes: p.attribute_list?.attribute || [],
    categoryId: String(p.category_id || ''),
    category: _mapCategory(p.category_id),
    supplierId: String(p.company_id || ''),
    supplierName: p.company_name || '',
    stock: parseInt(p.stock || 0, 10),
    source: 'alibaba',
  };
}

/**
 * Retrieve supplier information by Alibaba company ID.
 * @param {string} companyId
 */
export async function getSupplierInfo(companyId) {
  const data = await _apiCall('alibaba.icbu.company.get', { company_id: companyId });
  const c = data?.alibaba_icbu_company_get_response?.company;
  if (!c) throw new Error(`Supplier ${companyId} not found on Alibaba.`);

  return {
    externalId: String(c.company_id),
    name: c.company_name,
    country: c.country || '',
    businessType: c.business_type || '',
    goldSupplier: !!c.is_gold_supplier,
    verifiedSupplier: !!c.is_verified_supplier,
    tradeAssurance: !!c.is_trade_assurance,
    yearEstablished: c.reg_year || null,
    totalEmployees: c.total_employee || null,
    annualRevenue: c.annual_revenue || null,
    mainProducts: c.main_product_list?.main_product || [],
    profileUrl: c.company_url || '',
  };
}

/**
 * Compare prices for a keyword across Alibaba listings.
 * Returns min, max, average.
 * @param {string} keyword
 */
export async function comparePrices(keyword) {
  const { products } = await searchProducts({ keyword, pageSize: 50 });
  if (!products.length) return { min: 0, max: 0, avg: 0, count: 0 };
  const prices = products.map(p => p.price).filter(v => v > 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return { min, max, avg: parseFloat(avg.toFixed(4)), count: prices.length };
}

/**
 * Import a single Alibaba product into the local database.
 * Downloads images to Cloudinary and maps to local schema.
 * @param {string} productId - Alibaba external product ID
 * @param {string} importedBy - Admin user ID
 * @returns {object} Created product record
 */
export async function importProduct(productId, importedBy) {
  const detail = await getProductDetail(productId);

  // Upload primary image to Cloudinary
  let cloudinaryUrl = detail.images[0] || '';
  if (cloudinaryUrl) {
    try {
      const uploaded = await uploadFromUrl(cloudinaryUrl, `alibaba/${productId}`);
      cloudinaryUrl = uploaded.secure_url;
    } catch (_) {
      // keep original URL if upload fails
    }
  }

  const product = {
    name: detail.title,
    description: detail.description,
    price: detail.price,
    currency: detail.currency,
    moq: detail.moq,
    images: [cloudinaryUrl, ...detail.images.slice(1)].filter(Boolean),
    category: detail.category,
    stock_quantity: detail.stock,
    external_id: detail.externalId,
    external_source: 'alibaba',
    supplier_external_id: detail.supplierId,
    supplier_name: detail.supplierName,
    status: 'pending',
    imported_by: importedBy,
    metadata: { attributes: detail.attributes },
  };

  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Perform a periodic sync: update prices and availability for all products
 * sourced from Alibaba.
 * @returns {{ updated: number, errors: number }}
 */
export async function syncProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, external_id')
    .eq('external_source', 'alibaba')
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  let updated = 0;
  let errors = 0;

  for (const product of products || []) {
    try {
      const detail = await getProductDetail(product.external_id);
      await supabase.from('products').update({
        price: detail.price,
        stock_quantity: detail.stock,
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);
      updated++;
    } catch (_) {
      errors++;
    }
  }

  return { updated, errors, total: (products || []).length };
}
