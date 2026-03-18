import supabase from '../config/supabase.js';
import { calculateMarkup } from '../services/pricing.service.js';

export async function getDashboard(req, res, next) {
  try {
    const { data: products, count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active');
    res.json({ success: true, data: { total_products: count } });
  } catch (err) { next(err); }
}

export async function listDropshippingProducts(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(400).json({ success: false, error: error.message });
    // Compute markup for each product
    const enriched = await Promise.all((data || []).map(async (p) => {
      const markup = await calculateMarkup(p.price, p.category_id);
      return { ...p, dropship_price: markup.selling_price, profit: markup.profit };
    }));
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
}

export async function importProduct(req, res, next) {
  try {
    const { product_id } = req.body;
    const { data: product } = await supabase.from('products').select('*').eq('id', product_id).single();
    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data: product, message: 'Product imported to your store.' });
  } catch (err) { next(err); }
}

export async function listImportedProducts(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_imported_products')
      .select('*')
      .eq('user_id', userId)
      .order('imported_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

export async function removeProduct(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { error } = await supabase
      .from('dropshipping_imported_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product removed from your store.' });
  } catch (err) { next(err); }
}

export async function updatePricing(req, res, next) {
  try {
    const { id } = req.params;
    const { selling_price, markup_percent } = req.body;
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_imported_products')
      .update({ selling_price, markup_percent, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getDropshipOrders(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('order_type', 'dropship')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

export async function routeOrderToSupplier(req, res, next) {
  try {
    const { order_id } = req.params;
    const { supplier_id } = req.body;
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();
    if (fetchErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });
    const { data, error } = await supabase
      .from('orders')
      .update({ supplier_id, status: 'processing', routed_at: new Date().toISOString() })
      .eq('id', order_id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Order routed to supplier.' });
  } catch (err) { next(err); }
}

export async function getAnalytics(req, res, next) {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,total_amount,profit,created_at,status')
      .eq('order_type', 'dropship')
      .gte('created_at', since);
    if (error) return res.status(400).json({ success: false, error: error.message });
    const totalRevenue = (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalProfit = (orders || []).reduce((sum, o) => sum + (o.profit || 0), 0);
    const totalOrders = (orders || []).length;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00';
    res.json({
      success: true,
      data: {
        period,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        total_orders: totalOrders,
        profit_margin: profitMargin,
        orders: orders || [],
      },
    });
  } catch (err) { next(err); }
}

export async function getConnectedSuppliers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('dropshipping_suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

export async function updateSettings(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_settings')
      .upsert({ user_id: userId, ...req.body, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').upsert(req.body, { onConflict: 'id' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getInventorySync(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('id,title,stock,updated_at').eq('status', 'active');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function syncInventory(req, res, next) {
  try {
    // Placeholder for real inventory sync logic
    res.json({ success: true, message: 'Inventory sync triggered.', synced_at: new Date().toISOString() });
  } catch (err) { next(err); }
}
