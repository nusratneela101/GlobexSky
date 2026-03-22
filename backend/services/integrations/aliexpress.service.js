/**
 * Globex Sky — aliexpress.service.js
 * AliExpress dropshipping sync service via AliExpress Open Platform.
 *
 * Supports:
 *  - Product search and detail fetching
 *  - Dropshipping-specific data (shipping times, tracking)
 *  - Product import for dropshipping catalog
 *  - Order placement via API
 *  - Order tracking sync
 *  - Price monitoring and alerts
 */

import crypto from 'crypto';
import supabase from '../../config/supabase.js';
import { aliexpressConfig } from '../../config/integrations.js';
import { uploadFromUrl } from '../cloudinary.service.js';

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const _callTimestamps = [];

function _rateLimit() {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (_callTimestamps.length && _callTimestamps[0] < windowStart) _callTimestamps.shift();
  if (_callTimestamps.length >= aliexpressConfig.rateLimitPerMinute) {
    const waitMs = 60_000 - (now - _callTimestamps[0]);
    return new Promise(resolve => setTimeout(resolve, waitMs + 100));
  }
  _callTimestamps.push(now);
  return Promise.resolve();
}

// ─── Request Signing ─────────────────────────────────────────────────────────

function _buildSignedParams(method, params = {}) {
  const allParams = {
    method,
    app_key: aliexpressConfig.appKey,
    access_token: aliexpressConfig.accessToken,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-sha256',
    ...params,
  };

  const sorted = Object.keys(allParams).sort().map(k => `${k}${allParams[k]}`).join('');
  const sign = crypto.createHmac('sha256', aliexpressConfig.appSecret).update(sorted).digest('hex').toUpperCase();

  return { ...allParams, sign };
}

async function _apiCall(method, params = {}, retries = 3) {
  await _rateLimit();
  const signedParams = _buildSignedParams(method, params);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(aliexpressConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(signedParams).toString(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error_response) throw new Error(data.error_response.msg || 'AliExpress API error');
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search for products on AliExpress.
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=20]
 * @param {string} [opts.categoryId]
 * @param {number} [opts.minPrice]
 * @param {number} [opts.maxPrice]
 * @param {string} [opts.shipToCountry='US']
 * @returns {object} { products, total, page }
 */
export async function searchProducts({
  keyword, page = 1, pageSize = 20, categoryId, minPrice, maxPrice, shipToCountry = 'US',
} = {}) {
  const params = {
    keywords: keyword,
    page_no: page,
    page_size: pageSize,
    ship_to_country: shipToCountry,
    local_currency: 'USD',
  };
  if (categoryId) params.category_id = categoryId;
  if (minPrice != null) params.min_sale_price = minPrice;
  if (maxPrice != null) params.max_sale_price = maxPrice;

  const data = await _apiCall('aliexpress.affiliate.product.query', params);
  const result = data?.aliexpress_affiliate_product_query_response?.resp_result;
  if (!result || result.resp_code !== 200) {
    throw new Error(result?.resp_msg || 'Search failed');
  }

  const raw = result.result?.products?.product || [];
  const total = result.result?.total_record_count || 0;

  const products = raw.map(p => ({
    externalId: String(p.product_id),
    title: p.product_title || '',
    price: parseFloat(p.target_sale_price || p.sale_price || 0),
    originalPrice: parseFloat(p.original_price || 0),
    currency: p.target_sale_price_currency || 'USD',
    imageUrl: p.product_main_image_url || '',
    productUrl: p.product_detail_url || '',
    commissionRate: parseFloat(p.commission_rate || 0),
    shippingTime: p.first_level_category_name || '',
    sales30Days: parseInt(p.lastest_volume || 0, 10),
    rating: parseFloat(p.evaluate_rate || 0),
    source: 'aliexpress',
  }));

  return { products, total, page };
}

/**
 * Fetch full product details including shipping options.
 * @param {string} productId
 * @param {string} [shipToCountry='US']
 */
export async function getProductDetail(productId, shipToCountry = 'US') {
  const data = await _apiCall('aliexpress.ds.product.get', {
    product_id: productId,
    ship_to_country: shipToCountry,
    local_currency: 'USD',
  });

  const p = data?.aliexpress_ds_product_get_response?.result;
  if (!p) throw new Error(`Product ${productId} not found on AliExpress.`);

  const shippingOptions = (p.shipping_info?.aeop_freight_calculate_result_for_buyer_d_t_o_list || []).map(s => ({
    provider: s.service_name || '',
    estimatedDays: parseInt(s.estimated_delivery_time || 0, 10),
    price: parseFloat(s.freight?.price || 0),
    trackingAvailable: !!s.tracking_available,
  }));

  return {
    externalId: String(p.ae_item_base_info_dto?.product_id || productId),
    title: p.ae_item_base_info_dto?.subject || '',
    description: p.ae_item_desc?.desc || '',
    price: parseFloat(p.ae_item_base_info_dto?.us_sale_price || 0),
    originalPrice: parseFloat(p.ae_item_base_info_dto?.us_original_price || 0),
    currency: 'USD',
    images: (p.ae_multimedia_info_dto?.image_urls || '').split(';').filter(Boolean),
    shippingOptions,
    variants: p.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [],
    rating: parseFloat(p.ae_item_base_info_dto?.avg_evaluation_rating || 0),
    totalOrders: parseInt(p.ae_item_base_info_dto?.order_count || 0, 10),
    source: 'aliexpress',
  };
}

/**
 * Import an AliExpress product into the dropshipping catalog.
 * @param {string} productId
 * @param {string} importedBy - Admin/supplier user ID
 */
export async function importProduct(productId, importedBy) {
  const detail = await getProductDetail(productId);

  let primaryImage = detail.images[0] || '';
  if (primaryImage) {
    try {
      const uploaded = await uploadFromUrl(primaryImage, `aliexpress/${productId}`);
      primaryImage = uploaded.secure_url;
    } catch (_) { /* keep original */ }
  }

  const product = {
    name: detail.title,
    description: detail.description,
    price: detail.price,
    currency: 'USD',
    images: [primaryImage, ...detail.images.slice(1)].filter(Boolean),
    external_id: detail.externalId,
    external_source: 'aliexpress',
    status: 'pending',
    imported_by: importedBy,
    metadata: {
      shipping_options: detail.shippingOptions,
      variants: detail.variants,
      rating: detail.rating,
      total_orders: detail.totalOrders,
      original_price: detail.originalPrice,
      is_dropshipping: true,
    },
  };

  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Place a dropshipping order on AliExpress.
 * @param {object} orderDetails
 * @param {string} orderDetails.productId - AliExpress product ID
 * @param {string} orderDetails.skuId - Variant SKU
 * @param {number} orderDetails.quantity
 * @param {object} orderDetails.shippingAddress
 * @param {string} orderDetails.logisticsService - e.g. 'CAINIAO_STANDARD'
 * @returns {object} { externalOrderId, status }
 */
export async function placeOrder({ productId, skuId, quantity, shippingAddress, logisticsService }) {
  const orderItems = [{
    product_id: productId,
    product_count: quantity,
    sku_code: skuId,
    logistics_service_name: logisticsService,
    order_memo: '',
  }];

  const addressInfo = {
    contact_person: shippingAddress.fullName || '',
    full_name: shippingAddress.fullName || '',
    address: shippingAddress.address || '',
    city: shippingAddress.city || '',
    province: shippingAddress.state || '',
    country: shippingAddress.country || 'US',
    zip: shippingAddress.postalCode || '',
    mobile_no: shippingAddress.phone || '',
    phone_country: shippingAddress.phoneCountry || '+1',
  };

  const data = await _apiCall('aliexpress.ds.order.create', {
    param_place_order_request4_open_api_d_t_o: JSON.stringify({ product_items: orderItems, logistics_address: addressInfo }),
  });

  const result = data?.aliexpress_ds_order_create_response?.result;
  if (!result?.is_success) throw new Error(result?.error_msg || 'Failed to place AliExpress order');

  return {
    externalOrderId: String(result.order_list?.[0]?.order_id || ''),
    status: 'placed',
  };
}

/**
 * Sync tracking information for an AliExpress order.
 * @param {string} externalOrderId - AliExpress order ID
 * @returns {object} { trackingNumber, carrier, status, events }
 */
export async function syncOrderTracking(externalOrderId) {
  const data = await _apiCall('aliexpress.ds.order.tracking.info.get', { order_id: externalOrderId });
  const result = data?.aliexpress_ds_order_tracking_info_get_response?.result;
  if (!result) throw new Error('No tracking info returned.');

  const events = (result.details || []).map(e => ({
    timestamp: e.event_date,
    status: e.event_desc || '',
    location: e.signing_time || '',
  }));

  return {
    trackingNumber: result.logistics_no || '',
    carrier: result.logistics_company || '',
    status: result.logistics_status || '',
    events,
    estimatedDelivery: result.arrive_date || '',
  };
}

/**
 * Monitor price changes for all AliExpress products and create alerts.
 * @returns {{ alerts: number, checked: number }}
 */
export async function monitorPrices() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, external_id, price, metadata')
    .eq('external_source', 'aliexpress')
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  let alerts = 0;

  for (const product of products || []) {
    try {
      const detail = await getProductDetail(product.external_id);
      const oldPrice = parseFloat(product.price);
      const newPrice = detail.price;
      const changePct = oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 : 0;

      if (changePct >= aliexpressConfig.priceAlertThresholdPct) {
        await supabase.from('product_price_alerts').insert({
          product_id: product.id,
          old_price: oldPrice,
          new_price: newPrice,
          change_pct: parseFloat(changePct.toFixed(2)),
          source: 'aliexpress',
          created_at: new Date().toISOString(),
        });
        alerts++;
      }

      await supabase.from('products').update({ price: newPrice, updated_at: new Date().toISOString() }).eq('id', product.id);
    } catch (_) { /* skip this product */ }
  }

  return { alerts, checked: (products || []).length };
}
