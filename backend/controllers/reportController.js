/**
 * Globex Sky — reportController.js
 * Financial reports & analytics controller for admin.
 */

import supabase from '../config/supabase.js';

/**
 * Escape a value for RFC 4180 CSV output.
 * Wraps the value in double-quotes if it contains a comma, double-quote, or newline,
 * and escapes any embedded double-quotes by doubling them.
 * @param {string} value
 * @returns {string}
 */
function escapeCsvField(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ─── Revenue Report ──────────────────────────────────────────────────── */

/** GET /api/admin/reports/revenue */
export async function getRevenueReport(req, res, next) {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    let query = supabase
      .from('payments')
      .select('amount, currency, created_at, method, status')
      .eq('status', 'completed');

    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query.order('created_at');
    if (error) return res.status(400).json({ success: false, error: error.message });

    // Aggregate revenue by period
    const grouped = {};
    let totalRevenue = 0;
    for (const p of data) {
      const date = new Date(p.created_at);
      let key;
      if (group_by === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else if (group_by === 'year') key = `${date.getFullYear()}`;
      else key = date.toISOString().slice(0, 10);

      grouped[key] = (grouped[key] || 0) + parseFloat(p.amount || 0);
      totalRevenue += parseFloat(p.amount || 0);
    }

    const chart_data = Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));

    // Revenue by method
    const byMethod = {};
    for (const p of data) {
      byMethod[p.method] = (byMethod[p.method] || 0) + parseFloat(p.amount || 0);
    }

    res.json({ success: true, data: { total_revenue: totalRevenue, chart_data, by_method: byMethod, transactions: data.length } });
  } catch (err) { next(err); }
}

/* ─── Profit & Loss Report ────────────────────────────────────────────── */

/** GET /api/admin/reports/profit-loss */
export async function getProfitLossReport(req, res, next) {
  try {
    const { start_date, end_date } = req.query;

    // Revenue: completed payments
    let revenueQuery = supabase.from('payments').select('amount').eq('status', 'completed');
    if (start_date) revenueQuery = revenueQuery.gte('created_at', start_date);
    if (end_date) revenueQuery = revenueQuery.lte('created_at', end_date);
    const { data: revenues } = await revenueQuery;

    // Refunds
    let refundQuery = supabase.from('payments').select('amount').eq('status', 'refunded');
    if (start_date) refundQuery = refundQuery.gte('created_at', start_date);
    if (end_date) refundQuery = refundQuery.lte('created_at', end_date);
    const { data: refunds } = await refundQuery;

    // Payouts
    let payoutQuery = supabase.from('payouts').select('amount').eq('status', 'completed');
    if (start_date) payoutQuery = payoutQuery.gte('created_at', start_date);
    if (end_date) payoutQuery = payoutQuery.lte('created_at', end_date);
    const { data: payouts } = await payoutQuery;

    const totalRevenue = (revenues || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const totalRefunds = (refunds || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const totalPayouts = (payouts || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const grossProfit = totalRevenue - totalRefunds;
    const netProfit = grossProfit - totalPayouts;

    res.json({
      success: true,
      data: {
        revenue: totalRevenue,
        refunds: totalRefunds,
        payouts: totalPayouts,
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Commission Report ───────────────────────────────────────────────── */

/** GET /api/admin/reports/commissions */
export async function getCommissionReport(req, res, next) {
  try {
    const { start_date, end_date } = req.query;

    let query = supabase.from('transactions').select('amount, fee, net_amount, type, created_at, user_id').eq('type', 'commission');
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });

    const totalCommission = (data || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const totalTransactions = data?.length || 0;

    res.json({
      success: true,
      data: {
        total_commission: totalCommission,
        total_transactions: totalTransactions,
        avg_commission: totalTransactions > 0 ? (totalCommission / totalTransactions).toFixed(2) : 0,
        transactions: data,
      },
    });
  } catch (err) { next(err); }
}

/* ─── Payout Summary ──────────────────────────────────────────────────── */

/** GET /api/admin/reports/payouts */
export async function getPayoutSummary(req, res, next) {
  try {
    const { start_date, end_date, status } = req.query;

    let query = supabase.from('payouts').select('*, profiles(full_name, email)', { count: 'exact' });
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query.order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });

    const totalPaid = (data || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalPending = (data || []).filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    res.json({ success: true, data, meta: { total: count, total_paid: totalPaid, total_pending: totalPending } });
  } catch (err) { next(err); }
}

/* ─── All Transactions ────────────────────────────────────────────────── */

/** GET /api/admin/reports/transactions */
export async function getAllTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20, type, status, user_id, start_date, end_date } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    let query = supabase.from('transactions').select('*', { count: 'exact' });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (user_id) query = query.eq('user_id', user_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/* ─── Export Report ───────────────────────────────────────────────────── */

/** GET /api/admin/reports/export/:type */
export async function exportReport(req, res, next) {
  try {
    const { type } = req.params; // 'revenue', 'commissions', 'transactions', 'payouts'
    const { start_date, end_date, format = 'csv' } = req.query;

    let data = [];
    if (type === 'transactions') {
      let query = supabase.from('transactions').select('*');
      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);
      const { data: rows } = await query.order('created_at', { ascending: false });
      data = rows || [];
    } else if (type === 'payouts') {
      let query = supabase.from('payouts').select('*');
      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);
      const { data: rows } = await query.order('created_at', { ascending: false });
      data = rows || [];
    } else if (type === 'revenue') {
      let query = supabase.from('payments').select('*').eq('status', 'completed');
      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);
      const { data: rows } = await query.order('created_at', { ascending: false });
      data = rows || [];
    }

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.json"`);
      return res.json({ success: true, data });
    }

    // CSV format
    if (!data.length) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
      return res.send('No data available for the selected period.\n');
    }

    const headers = Object.keys(data[0]).map(escapeCsvField).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v => escapeCsvField(v == null ? '' : String(v))).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}
