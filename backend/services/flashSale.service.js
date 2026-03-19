import supabase from '../config/supabase.js';

/**
 * Flash sale lifecycle states: draft → scheduled → active → ended → cancelled
 */

/**
 * Create a new flash sale.
 * @param {object} params
 */
export async function createFlashSaleRecord({ name, description, bannerImage, startsAt, endsAt, maxOrders, createdBy }) {
  const { data, error } = await supabase
    .from('flash_sales')
    .insert([{
      name,
      description: description || null,
      banner_image: bannerImage || null,
      starts_at: startsAt,
      ends_at: endsAt,
      max_orders: maxOrders || null,
      status: 'scheduled',
      created_by: createdBy,
      total_revenue: 0,
      total_orders: 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all currently active flash sales (started, not yet ended).
 */
export async function getActiveFlashSalesData() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('flash_sales')
    .select('*, products:flash_sale_products(*, product:products(id,name,images,price))')
    .eq('status', 'active')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(sale => ({
    ...sale,
    countdown_seconds: Math.max(0, Math.floor((new Date(sale.ends_at) - new Date()) / 1000)),
  }));
}

/**
 * Get upcoming flash sales (scheduled, not yet started).
 */
export async function getUpcomingFlashSalesData() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('flash_sales')
    .select('*, products:flash_sale_products(*, product:products(id,name,images,price))')
    .eq('status', 'scheduled')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(sale => ({
    ...sale,
    starts_in_seconds: Math.max(0, Math.floor((new Date(sale.starts_at) - new Date()) / 1000)),
  }));
}

/**
 * Update a flash sale's details.
 * @param {string} saleId
 * @param {object} updates
 */
export async function updateFlashSaleRecord(saleId, updates) {
  const allowed = ['name', 'description', 'banner_image', 'starts_at', 'ends_at', 'max_orders', 'status'];
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const { data, error } = await supabase
    .from('flash_sales')
    .update(sanitized)
    .eq('id', saleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cancel a flash sale.
 * @param {string} saleId
 */
export async function cancelFlashSaleRecord(saleId) {
  const { data, error } = await supabase
    .from('flash_sales')
    .update({ status: 'cancelled' })
    .eq('id', saleId)
    .neq('status', 'ended')
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add products to a flash sale with discounted prices.
 * @param {string} saleId
 * @param {Array<{productId, originalPrice, salePrice, stockLimit}>} products
 */
export async function addProductsToFlashSale(saleId, products) {
  const rows = products.map(p => ({
    flash_sale_id: saleId,
    product_id: p.productId,
    original_price: p.originalPrice,
    sale_price: p.salePrice,
    stock_limit: p.stockLimit || null,
    stock_remaining: p.stockLimit || null,
    discount_pct: p.originalPrice > 0
      ? +((1 - p.salePrice / p.originalPrice) * 100).toFixed(1)
      : 0,
    units_sold: 0,
  }));

  const { data, error } = await supabase
    .from('flash_sale_products')
    .upsert(rows, { onConflict: 'flash_sale_id,product_id' })
    .select();

  if (error) throw error;
  return data;
}

/**
 * Build analytics for a flash sale.
 * @param {string} saleId
 */
export async function getFlashSaleAnalyticsData(saleId) {
  const { data: sale, error } = await supabase
    .from('flash_sales')
    .select('*')
    .eq('id', saleId)
    .single();

  if (error || !sale) throw new Error('Flash sale not found.');

  const { data: products } = await supabase
    .from('flash_sale_products')
    .select('*')
    .eq('flash_sale_id', saleId);

  const items = products || [];
  const totalUnitsSold = items.reduce((s, p) => s + (p.units_sold || 0), 0);
  const totalRevenue = items.reduce((s, p) => s + ((p.units_sold || 0) * (p.sale_price || 0)), 0);
  const avgDiscount = items.length > 0
    ? +(items.reduce((s, p) => s + (p.discount_pct || 0), 0) / items.length).toFixed(1)
    : 0;

  return {
    sale_id: saleId,
    name: sale.name,
    status: sale.status,
    starts_at: sale.starts_at,
    ends_at: sale.ends_at,
    total_products: items.length,
    total_units_sold: totalUnitsSold,
    total_revenue: +totalRevenue.toFixed(2),
    avg_discount_pct: avgDiscount,
    total_orders: sale.total_orders || 0,
    products,
  };
}

/**
 * Calculate the discounted price based on type and value.
 * @param {number} originalPrice
 * @param {'percentage'|'fixed'} discountType
 * @param {number} discountValue
 */
export function calculateDiscountedPrice(originalPrice, discountType, discountValue) {
  if (discountType === 'percentage') {
    return Math.max(0, +(originalPrice * (1 - discountValue / 100)).toFixed(2));
  }
  return Math.max(0, +(originalPrice - discountValue).toFixed(2));
}
