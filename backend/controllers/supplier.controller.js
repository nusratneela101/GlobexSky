import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function getSupplierProfile(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_profiles').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Supplier not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierProducts(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase
      .from('products').select('*', { count: 'exact' }).eq('supplier_id', req.params.id).eq('status', 'active').range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getDashboardStats(req, res, next) {
  try {
    const supplierId = req.user.profile?.id;
    const [orders, products, earnings] = await Promise.all([
      supabase.from('orders').select('id,status,total', { count: 'exact' }).eq('supplier_id', supplierId),
      supabase.from('products').select('id,status', { count: 'exact' }).eq('supplier_id', supplierId),
      supabase.from('supplier_payouts').select('amount').eq('supplier_id', supplierId).eq('status', 'paid'),
    ]);
    res.json({
      success: true, data: {
        total_orders: orders.count || 0,
        total_products: products.count || 0,
        total_earned: (earnings.data || []).reduce((s, r) => s + (+r.amount), 0),
      },
    });
  } catch (err) { next(err); }
}

export async function updateSupplierProfile(req, res, next) {
  try {
    const allowed = ['company_name', 'business_type', 'country'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('supplier_profiles').update(updates).eq('user_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierOrders(req, res, next) {
  try {
    const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('supplier_id', req.user.profile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierAnalytics(req, res, next) {
  try {
    const { data, error } = await supabase.from('orders').select('total,status,created_at').eq('supplier_id', req.user.profile?.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    const revenue = (data || []).filter((o) => o.status === 'delivered').reduce((s, o) => s + (+o.total), 0);
    res.json({ success: true, data: { orders: data, total_revenue: revenue } });
  } catch (err) { next(err); }
}

export async function getSupplierEarnings(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_payouts').select('*').eq('supplier_id', req.user.profile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
