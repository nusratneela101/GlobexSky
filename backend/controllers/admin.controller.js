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

// Alias used by GET /admin/dashboard
export const getDashboard = getDashboardStats;

export async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, role, search, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('profiles').select('*', { count: 'exact' }).range(from, to);
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('full_name', `%${search}%`);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function createUser(req, res, next) {
  try {
    const { email, password, full_name, role = 'buyer' } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'email and password are required.' });
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) return res.status(400).json({ success: false, error: authError.message });
    const userId = authData.user.id;
    const { data, error } = await supabase.from('profiles').upsert({ id: userId, user_id: userId, email, full_name: full_name || email, role }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
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
    const allowed = ['full_name', 'role', 'status', 'verification_status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, error: 'role is required.' });
    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'status is required.' });
    const { data, error } = await supabase.from('profiles').update({ status }).eq('id', req.params.id).select().single();
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

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'status is required.' });
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function refundOrder(req, res, next) {
  try {
    const { data: order, error: fetchErr } = await supabase.from('orders').select('*').eq('id', req.params.id).single();
    if (fetchErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });
    const { data, error } = await supabase.from('orders').update({ status: 'refunded' }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listAllProducts(req, res, next) {
  try {
    const { page = 1, limit = 20, status, search, category_id } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('products').select('*', { count: 'exact' }).range(from, to).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);
    if (category_id) query = query.eq('category_id', category_id);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function createProduct(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').insert(req.body).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateProduct(req, res, next) {
  try {
    const allowed = ['name', 'description', 'price', 'stock_quantity', 'status', 'category_id', 'main_image', 'is_featured'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('products').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteProduct(req, res, next) {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product deleted.' });
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

export async function getAnalytics(req, res, next) {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [ordersRes, usersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('id,total_amount,status,created_at').gte('created_at', since),
      supabase.from('profiles').select('id,created_at').gte('created_at', since),
      supabase.from('products').select('id,name,status').limit(10),
    ]);

    const orders = ordersRes.data || [];
    const users = usersRes.data || [];

    // Build daily revenue and order counts
    const dailyMap = {};
    orders.forEach((o) => {
      const day = o.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0 };
      dailyMap[day].revenue += +(o.total_amount || 0);
      dailyMap[day].orders += 1;
    });

    const userDailyMap = {};
    users.forEach((u) => {
      const day = u.created_at.slice(0, 10);
      userDailyMap[day] = (userDailyMap[day] || 0) + 1;
    });

    const totalRevenue = orders.reduce((s, o) => s + +(o.total_amount || 0), 0);

    res.json({
      success: true,
      data: {
        period,
        total_orders: orders.length,
        total_revenue: totalRevenue,
        new_users: users.length,
        daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
        user_growth: Object.entries(userDailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
      },
    });
  } catch (err) { next(err); }
}

export async function listCategories(req, res, next) {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCategory(req, res, next) {
  try {
    const { name, slug, description, parent_id } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required.' });
    const { data, error } = await supabase.from('categories').insert({ name, slug, description, parent_id }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateCategory(req, res, next) {
  try {
    const allowed = ['name', 'slug', 'description', 'parent_id'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('categories').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteCategory(req, res, next) {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
}

// Aliases: /admin/settings → site-settings
export const getSettings = getSiteSettings;
export const updateSettings = updateSiteSettings;
