import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function getDashboardStats(req, res, next) {
  try {
    const [users, orders, products, revenue] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('transactions').select('amount').eq('type', 'payment').eq('status', 'completed'),
    ]);
    const totalRevenue = (revenue.data || []).reduce((s, t) => s + (+t.amount), 0);
    res.json({ success: true, data: { total_users: users.count, total_orders: orders.count, total_products: products.count, total_revenue: totalRevenue } });
  } catch (err) { next(err); }
}

export async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('profiles').select('*', { count: 'exact' }).range(from, to);
    if (role) query = query.eq('role', role);
    if (search) query = query.ilike('full_name', `%${search}%`);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getUser(req, res, next) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateUser(req, res, next) {
  try {
    const allowed = ['full_name', 'role', 'verification_status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteUser(req, res, next) {
  try {
    const { data: profile } = await supabase.from('profiles').select('user_id').eq('id', req.params.id).single();
    if (!profile) return res.status(404).json({ success: false, error: 'User not found.' });
    await supabase.auth.admin.deleteUser(profile.user_id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { next(err); }
}

export async function listAllOrders(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('orders').select('*, buyer:profiles!buyer_id(*)', { count: 'exact' }).range(from, to).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function listAllProducts(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('products').select('*', { count: 'exact' }).range(from, to).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function updateProductStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('products').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listAllTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase.from('transactions').select('*', { count: 'exact' }).range(from, to).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function listSuppliers(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_profiles').select('*, profile:profiles(*)');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function verifySupplier(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_profiles').update({ verified: true }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSiteSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateSiteSettings(req, res, next) {
  try {
    const { key, value, type, category } = req.body;
    const { data, error } = await supabase.from('site_settings').upsert({ key, value, type, category, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getFeatureToggles(req, res, next) {
  try {
    const { data, error } = await supabase.from('feature_toggles').select('*');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateFeatureToggle(req, res, next) {
  try {
    const { feature_name, is_enabled } = req.body;
    const { data, error } = await supabase.from('feature_toggles').upsert({ feature_name, is_enabled, updated_at: new Date().toISOString() }, { onConflict: 'feature_name' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
