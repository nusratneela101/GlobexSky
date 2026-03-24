/**
 * Admin Dashboard Controller
 * Provides metrics, charts, geographic data, and system health for the admin panel.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/dashboard/metrics — total users, orders, revenue, active suppliers, pending approvals */
export async function getDashboardMetrics(req, res, next) {
  try {
    const [usersRes, ordersRes, suppliersRes, approvalsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, total_amount', { count: 'exact' }),
      supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const revenue = (ordersRes.data || []).reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

    res.json({
      success: true,
      data: {
        total_users: usersRes.count || 0,
        total_orders: ordersRes.count || 0,
        total_revenue: revenue,
        active_suppliers: suppliersRes.count || 0,
        pending_approvals: approvalsRes.count || 0,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/revenue-chart?period=daily|weekly|monthly */
export async function getRevenueChart(req, res, next) {
  try {
    const { period = 'daily' } = req.query;
    const days = period === 'monthly' ? 365 : period === 'weekly' ? 84 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data, error } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Group by period
    const grouped = {};
    (data || []).forEach((order) => {
      const d = new Date(order.created_at);
      let key;
      if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'weekly') {
        // ISO week: Thursday determines the year; day-of-week Sunday=0..Saturday=6
        const thursday = new Date(d);
        thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
        const yearStart = new Date(thursday.getFullYear(), 0, 4);
        const isoWeek = 1 + Math.round((thursday - yearStart) / 604800000);
        key = `${thursday.getFullYear()}-W${String(isoWeek).padStart(2, '0')}`;
      } else {
        key = d.toISOString().slice(0, 10);
      }
      grouped[key] = (grouped[key] || 0) + (parseFloat(order.total_amount) || 0);
    });

    const chart = Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
    res.json({ success: true, data: chart, period });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/geographic — orders and users by country */
export async function getGeographicDistribution(req, res, next) {
  try {
    const [ordersRes, usersRes] = await Promise.all([
      supabase.from('orders').select('shipping_country'),
      supabase.from('profiles').select('country'),
    ]);

    const ordersByCountry = {};
    (ordersRes.data || []).forEach((o) => {
      if (o.shipping_country) ordersByCountry[o.shipping_country] = (ordersByCountry[o.shipping_country] || 0) + 1;
    });

    const usersByCountry = {};
    (usersRes.data || []).forEach((u) => {
      if (u.country) usersByCountry[u.country] = (usersByCountry[u.country] || 0) + 1;
    });

    res.json({ success: true, data: { orders_by_country: ordersByCountry, users_by_country: usersByCountry } });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/top-products?limit=10 */
export async function getTopProducts(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const { data, error } = await supabase
      .from('order_items')
      .select('product_id, quantity, products(id, name, images)')
      .order('quantity', { ascending: false })
      .limit(limit);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/top-suppliers?limit=10 */
export async function getTopSuppliers(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, company_name, rating, total_orders, verified')
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/quick-stats — today's orders, pending inspections, active disputes, new registrations */
export async function getQuickStats(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.toISOString();

    const [todayOrders, pendingInspections, activeDisputes, newRegistrations] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);

    res.json({
      success: true,
      data: {
        today_orders: todayOrders.count || 0,
        pending_inspections: pendingInspections.count || 0,
        active_disputes: activeDisputes.count || 0,
        new_registrations: newRegistrations.count || 0,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/dashboard/system-health — server status, error rates, response times */
export async function getSystemHealth(req, res, next) {
  try {
    const startTime = Date.now();
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const dbLatencyMs = Date.now() - startTime;

    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        status: error ? 'degraded' : 'healthy',
        db_latency_ms: dbLatencyMs,
        uptime_seconds: Math.round(uptimeSeconds),
        memory_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        memory_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        node_version: process.version,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
}
