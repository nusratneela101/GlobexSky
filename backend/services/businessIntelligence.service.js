/**
 * GlobexSky — Business Intelligence Service
 * Trend analysis, price prediction, demand forecasting, competitor monitoring, report generation.
 */

import supabase from '../config/supabase.js';

/**
 * Identify trending products by views, orders, and category/region/time filters.
 * @param {{ category?: string, region?: string, days?: number, limit?: number }} opts
 * @returns {Promise<object>}
 */
export async function analyzeTrends({ category, region, days = 30, limit = 20 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let orderQuery = supabase
    .from('order_items')
    .select('product_id,quantity,orders(created_at,buyer_id)')
    .gte('orders.created_at', since);

  const { data: orderItems, error: oeError } = await orderQuery;
  if (oeError) throw new Error(oeError.message);

  // Aggregate order counts per product
  const productCount = (orderItems || []).reduce((acc, item) => {
    if (!item.product_id) return acc;
    acc[item.product_id] = (acc[item.product_id] || 0) + (item.quantity || 1);
    return acc;
  }, {});

  const topProductIds = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  let productsQuery = supabase
    .from('products')
    .select('id,name,price,category_id,thumbnail_url,status')
    .in('id', topProductIds.length ? topProductIds : ['00000000-0000-0000-0000-000000000000']);

  if (category) productsQuery = productsQuery.eq('category_id', category);

  const { data: products } = await productsQuery;

  return {
    period_days: days,
    trending_products: (products || []).map((p) => ({
      ...p,
      order_count: productCount[p.id] || 0,
    })),
    total_tracked: Object.keys(productCount).length,
  };
}

/**
 * Price trend analysis for products/categories.
 * @param {{ productId?: string, category?: string, days?: number }} opts
 * @returns {Promise<object>}
 */
export async function analyzePrices({ productId, category, days = 90 } = {}) {
  let query = supabase.from('products').select('id,name,price,category_id,created_at,updated_at');
  if (productId) query = query.eq('id', productId);
  if (category) query = query.eq('category_id', category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const products = data || [];
  const prices = products.map((p) => +p.price).filter(Boolean);
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  return {
    period_days: days,
    product_count: products.length,
    avg_price: Math.round(avg * 100) / 100,
    min_price: min,
    max_price: max,
    products,
  };
}

/**
 * Demand forecasting based on historical order data.
 * @param {{ category?: string, days?: number }} opts
 * @returns {Promise<object>}
 */
export async function forecastDemand({ category, days = 90 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('orders')
    .select('id,total,created_at,status')
    .gte('created_at', since)
    .eq('status', 'delivered');

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const orders = data || [];
  const weeklyBuckets = {};
  orders.forEach((o) => {
    const week = new Date(o.created_at);
    week.setDate(week.getDate() - week.getDay());
    const key = week.toISOString().split('T')[0];
    if (!weeklyBuckets[key]) weeklyBuckets[key] = { week: key, count: 0, revenue: 0 };
    weeklyBuckets[key].count += 1;
    weeklyBuckets[key].revenue += +o.total;
  });

  const weeks = Object.values(weeklyBuckets).sort((a, b) => a.week.localeCompare(b.week));
  const counts = weeks.map((w) => w.count);
  const avgWeekly = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const growthRate = counts.length >= 2
    ? ((counts[counts.length - 1] - counts[0]) / (counts[0] || 1)) * 100
    : 0;

  return {
    period_days: days,
    total_orders: orders.length,
    avg_weekly_orders: Math.round(avgWeekly * 10) / 10,
    growth_rate_pct: Math.round(growthRate * 10) / 10,
    weekly_trend: weeks,
    projected_next_week: Math.round(avgWeekly * (1 + growthRate / 100 / weeks.length || 1)),
  };
}

/**
 * Competitor pricing and activity analysis (based on product price distribution).
 * @param {{ category?: string, limit?: number }} opts
 * @returns {Promise<object>}
 */
export async function analyzeCompetitors({ category, limit = 50 } = {}) {
  let query = supabase
    .from('products')
    .select('id,name,price,category_id,supplier_id,status')
    .eq('status', 'active')
    .order('price', { ascending: true })
    .limit(limit);

  if (category) query = query.eq('category_id', category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const products = data || [];
  const prices = products.map((p) => +p.price).filter(Boolean);
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // Group by supplier to estimate market share
  const supplierCount = products.reduce((acc, p) => {
    acc[p.supplier_id] = (acc[p.supplier_id] || 0) + 1;
    return acc;
  }, {});

  const marketShare = Object.entries(supplierCount)
    .map(([supplierId, count]) => ({
      supplier_id: supplierId,
      product_count: count,
      market_share_pct: Math.round((count / products.length) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 10);

  return {
    total_products_analyzed: products.length,
    avg_market_price: Math.round(avg * 100) / 100,
    price_range: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    top_suppliers_by_listing: marketShare,
    lowest_priced: products.slice(0, 5),
    highest_priced: [...products].sort((a, b) => b.price - a.price).slice(0, 5),
  };
}

/**
 * Generate a custom report aggregated by date range, category, and region.
 * @param {{ reportType: string, startDate?: string, endDate?: string, categories?: string[], regions?: string[], suppliers?: string[] }} opts
 * @returns {Promise<object>}
 */
export async function generateCustomReport({ reportType, startDate, endDate, categories = [], regions = [], suppliers = [] } = {}) {
  const since = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
  const until = endDate || new Date().toISOString();

  switch (reportType) {
    case 'market_overview': {
      const [trends, prices, demand] = await Promise.all([
        analyzeTrends({ days: 30 }),
        analyzePrices({}),
        forecastDemand({ days: 30 }),
      ]);
      return { report_type: reportType, generated_at: new Date().toISOString(), trends, prices, demand };
    }
    case 'price_analysis':
      return { report_type: reportType, generated_at: new Date().toISOString(), ...(await analyzePrices({ days: 30 })) };
    case 'demand_forecast':
      return { report_type: reportType, generated_at: new Date().toISOString(), ...(await forecastDemand({ days: 90 })) };
    case 'competitor_analysis':
      return { report_type: reportType, generated_at: new Date().toISOString(), ...(await analyzeCompetitors({})) };
    default:
      throw new Error(`Unknown reportType: ${reportType}`);
  }
}
