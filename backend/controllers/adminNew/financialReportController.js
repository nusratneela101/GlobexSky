/**
 * Admin Financial Report Controller
 * P&L, cash flow, tax, commission, subscription, refund, and export reports.
 */

import supabase from '../../config/supabase.js';

/** GET /api/admin/reports/profit-loss?startDate=&endDate= */
export async function getProfitAndLoss(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required.' });
    }

    const [ordersRes, refundsRes, expensesRes] = await Promise.all([
      supabase.from('orders').select('total_amount, commission_amount').gte('created_at', startDate).lte('created_at', endDate).eq('payment_status', 'paid'),
      supabase.from('refunds').select('amount').gte('created_at', startDate).lte('created_at', endDate).eq('status', 'approved'),
      supabase.from('expenses').select('amount, category').gte('created_at', startDate).lte('created_at', endDate),
    ]);

    const grossRevenue = (ordersRes.data || []).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const totalRefunds = (refundsRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalExpenses = (expensesRes.data || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const netRevenue = grossRevenue - totalRefunds;
    const netProfit = netRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate },
        gross_revenue: grossRevenue,
        total_refunds: totalRefunds,
        net_revenue: netRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        profit_margin_percent: netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100 * 10) / 10 : 0,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/cash-flow?period=monthly */
export async function getCashFlowReport(req, res, next) {
  try {
    const { period = 'monthly', year } = req.query;
    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const since = `${targetYear}-01-01T00:00:00.000Z`;
    const until = `${targetYear}-12-31T23:59:59.999Z`;

    const [inflows, outflows] = await Promise.all([
      supabase.from('payments').select('amount, created_at').gte('created_at', since).lte('created_at', until).eq('status', 'completed'),
      supabase.from('payouts').select('amount, created_at').gte('created_at', since).lte('created_at', until).eq('status', 'completed'),
    ]);

    res.json({
      success: true,
      data: {
        period,
        year: targetYear,
        total_inflows: (inflows.data || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
        total_outflows: (outflows.data || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
        inflows: inflows.data || [],
        outflows: outflows.data || [],
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/tax?period=quarterly&country=US */
export async function getTaxReport(req, res, next) {
  try {
    const { period = 'quarterly', country, startDate, endDate } = req.query;

    let query = supabase.from('orders').select('total_amount, tax_amount, shipping_country').eq('payment_status', 'paid');
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (country) query = query.eq('shipping_country', country);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const byCountry = {};
    (data || []).forEach((order) => {
      const c = order.shipping_country || 'UNKNOWN';
      if (!byCountry[c]) byCountry[c] = { revenue: 0, tax: 0 };
      byCountry[c].revenue += parseFloat(order.total_amount) || 0;
      byCountry[c].tax += parseFloat(order.tax_amount) || 0;
    });

    res.json({ success: true, data: { period, country: country || 'all', by_country: byCountry } });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/commission?period=monthly */
export async function getCommissionReport(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    let query = supabase.from('orders').select('commission_amount, supplier_id, suppliers(company_name)').eq('payment_status', 'paid');
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const commissionBySupplier = {};
    (data || []).forEach((order) => {
      const supplierId = order.supplier_id || 'unknown';
      if (!commissionBySupplier[supplierId]) {
        commissionBySupplier[supplierId] = {
          supplier_id: supplierId,
          company_name: order.suppliers?.company_name || 'Unknown',
          total_commission: 0,
        };
      }
      commissionBySupplier[supplierId].total_commission += parseFloat(order.commission_amount) || 0;
    });

    const totalCommission = Object.values(commissionBySupplier).reduce((s, b) => s + b.total_commission, 0);

    res.json({
      success: true,
      data: {
        total_commission: totalCommission,
        by_supplier: Object.values(commissionBySupplier),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/subscription-revenue?period=monthly */
export async function getSubscriptionRevenue(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    let query = supabase.from('subscriptions').select('plan, amount, currency, created_at').eq('status', 'active');
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const byPlan = {};
    (data || []).forEach((sub) => {
      const plan = sub.plan || 'unknown';
      if (!byPlan[plan]) byPlan[plan] = { plan, count: 0, revenue: 0 };
      byPlan[plan].count += 1;
      byPlan[plan].revenue += parseFloat(sub.amount) || 0;
    });

    const totalRevenue = Object.values(byPlan).reduce((s, p) => s + p.revenue, 0);

    res.json({
      success: true,
      data: {
        total_subscription_revenue: totalRevenue,
        by_plan: Object.values(byPlan),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/refunds?period=monthly */
export async function getRefundReport(req, res, next) {
  try {
    const { startDate, endDate, status } = req.query;

    let query = supabase.from('refunds').select('*', { count: 'exact' });
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const totalAmount = (data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    res.json({
      success: true,
      data: {
        total_refunds: count || 0,
        total_amount: totalAmount,
        refunds: data || [],
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/export?reportType=profit-loss&format=csv */
export async function exportReport(req, res, next) {
  try {
    const { reportType, format = 'csv', startDate, endDate } = req.query;
    if (!reportType) return res.status(400).json({ success: false, error: 'reportType is required.' });

    // Fetch data based on report type
    let reportData = [];
    if (reportType === 'profit-loss') {
      const { data } = await supabase.from('orders').select('id, total_amount, commission_amount, created_at').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString());
      reportData = data || [];
    } else if (reportType === 'refunds') {
      const { data } = await supabase.from('refunds').select('*').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString());
      reportData = data || [];
    } else {
      return res.status(400).json({ success: false, error: `Unsupported reportType: ${reportType}` });
    }

    if (format === 'csv') {
      if (reportData.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}.csv"`);
        return res.send('');
      }
      const headers = Object.keys(reportData[0]).join(',');
      const rows = reportData.map((row) => Object.values(row).map((v) => `"${v}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}.csv"`);
      return res.send(csv);
    }

    res.json({ success: true, data: reportData, format, report_type: reportType });
  } catch (err) { next(err); }
}

/** GET /api/admin/reports/revenue-by-source — marketplace, subscriptions, ads, inspections, shipping */
export async function getRevenueBySource(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    const [marketplace, subscriptions, advertising, inspections, shipping] = await Promise.all([
      supabase.from('orders').select('commission_amount').eq('payment_status', 'paid').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString()),
      supabase.from('subscriptions').select('amount').eq('status', 'active').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString()),
      supabase.from('ad_payments').select('amount').eq('status', 'paid').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString()),
      supabase.from('inspections').select('fee').eq('status', 'completed').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString()),
      supabase.from('shipments').select('shipping_cost').gte('created_at', startDate || '2000-01-01').lte('created_at', endDate || new Date().toISOString()),
    ]);

    const sum = (rows, field) => (rows || []).reduce((s, r) => s + (parseFloat(r[field]) || 0), 0);

    const data = {
      marketplace: sum(marketplace.data, 'commission_amount'),
      subscriptions: sum(subscriptions.data, 'amount'),
      advertising: sum(advertising.data, 'amount'),
      inspections: sum(inspections.data, 'fee'),
      shipping: sum(shipping.data, 'shipping_cost'),
    };
    data.total = Object.values(data).reduce((a, b) => a + b, 0);

    res.json({ success: true, data });
  } catch (err) { next(err); }
}
