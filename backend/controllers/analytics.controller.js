import supabase from '../config/supabase.js';

export async function getDashboardStats(req, res, next) {
  try {
    const role = req.user.profile?.role;
    const userId = req.user.id;
    const supplierId = req.user.profile?.id;

    const [users, orders, products, revenue] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      role === 'supplier'
        ? supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId)
        : supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', userId),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('transactions').select('amount').eq('type', 'payment').eq('status', 'completed'),
    ]);

    const totalRevenue = (revenue.data || []).reduce((s, t) => s + (+t.amount), 0);
    res.json({ success: true, data: { total_users: users.count, total_orders: orders.count, total_products: products.count, total_revenue: totalRevenue } });
  } catch (err) { next(err); }
}

export async function getSalesReport(req, res, next) {
  try {
    const { start, end } = req.query;
    let query = supabase.from('orders').select('id,total,status,created_at').eq('status', 'delivered');
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);
    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    const total = (data || []).reduce((s, o) => s + (+o.total), 0);
    res.json({ success: true, data: { orders: data, total_revenue: total, order_count: (data || []).length } });
  } catch (err) { next(err); }
}

export async function getUserAnalytics(req, res, next) {
  try {
    const { data, error } = await supabase.from('profiles').select('role,created_at');
    if (error) return res.status(400).json({ success: false, error: error.message });
    const byRole = (data || []).reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: { total: (data || []).length, by_role: byRole } });
  } catch (err) { next(err); }
}

export async function getProductAnalytics(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('status,category_id,created_at');
    if (error) return res.status(400).json({ success: false, error: error.message });
    const byStatus = (data || []).reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: { total: (data || []).length, by_status: byStatus } });
  } catch (err) { next(err); }
}

export async function getShipmentAnalytics(req, res, next) {
  try {
    const { data, error } = await supabase.from('parcels').select('status,created_at,destination_country');
    if (error) return res.status(400).json({ success: false, error: error.message });
    const byStatus = (data || []).reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: { total: (data || []).length, by_status: byStatus } });
  } catch (err) { next(err); }
}

export async function getFinancialReport(req, res, next) {
  try {
    const { data, error } = await supabase.from('transactions').select('type,amount,status,created_at');
    if (error) return res.status(400).json({ success: false, error: error.message });
    const summary = (data || []).reduce((acc, t) => {
      if (!acc[t.type]) acc[t.type] = 0;
      if (t.status === 'completed') acc[t.type] += +t.amount;
      return acc;
    }, {});
    res.json({ success: true, data: { transactions: data, summary } });
  } catch (err) { next(err); }
}
