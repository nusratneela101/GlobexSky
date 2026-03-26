import supabase from '../config/supabase.js';
import {
  createCodOrderRecord,
  confirmDelivery,
  confirmCollection,
  markFraudulent,
  buildReconciliationReport,
  getCodAnalyticsData,
} from '../services/cod.service.js';

/** In-memory COD settings store.
 *  NOTE: For production, persist these in a `cod_settings` database table
 *  so settings survive server restarts and sync across multiple instances.
 */
let codSettings = {
  enabled: true,
  surcharge_pct: 2.5,
  surcharge_fixed: 1.50,
  min_order_amount: 10,
  max_order_amount: 5000,
  allowed_regions: [],
  blocked_regions: [],
  updated_at: new Date().toISOString(),
};

/** POST /api/v1/cod — Create a new COD order */
export async function createCodOrder(req, res, next) {
  try {
    const { order_id, carrier_id, amount, address, notes } = req.body;
    const buyer_id = req.user.id;

    if (!order_id || !amount) {
      return res.status(400).json({ success: false, error: 'order_id and amount are required.' });
    }

    const codOrder = await createCodOrderRecord({ order_id, buyer_id, carrier_id, amount, address, notes });
    res.status(201).json({ success: true, data: codOrder });
  } catch (err) { next(err); }
}

/** GET /api/v1/cod — List COD orders (admin sees all; carrier sees their own) */
export async function getCodOrders(req, res, next) {
  try {
    const { status, flagged, page = 1, limit = 20 } = req.query;
    const role = req.user.profile?.role;
    const userId = req.user.id;

    let query = supabase
      .from('cod_orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((+page - 1) * +limit, +page * +limit - 1);

    if (role !== 'admin') {
      query = query.eq('carrier_id', userId);
    }
    if (status) query = query.eq('status', status);
    if (flagged === 'true') query = query.eq('is_flagged', true);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, total: count, page: +page, limit: +limit });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/cod/:id/confirm-delivery — Carrier confirms delivery */
export async function confirmCodDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const carrierId = req.user.id;
    const role = req.user.profile?.role;

    let updated;
    if (role === 'admin') {
      const { data, error } = await supabase
        .from('cod_orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(400).json({ success: false, error: error.message });
      updated = data;
    } else {
      updated = await confirmDelivery(id, carrierId);
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/cod/:id/confirm-collection — Admin confirms cash collected */
export async function confirmCodCollection(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await confirmCollection(id);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** GET /api/v1/cod/report — Reconciliation report */
export async function getCodReport(req, res, next) {
  try {
    const { start, end } = req.query;
    const report = await buildReconciliationReport({ start, end });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/cod/:id/flag — Flag a COD order as fraudulent */
export async function flagFraudulent(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const updated = await markFraudulent(id, reason);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** GET /api/v1/cod/analytics — COD analytics */
export async function getCodAnalytics(req, res, next) {
  try {
    const { start, end } = req.query;
    const analytics = await getCodAnalyticsData({ start, end });
    res.json({ success: true, data: analytics });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/cod/:id/status — Update status of a single COD order (admin) */
export async function updateCodStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered', 'redelivery_scheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const extra = {};
    if (notes !== undefined) extra.notes = notes;
    if (status === 'delivered') extra.delivered_at = new Date().toISOString();
    if (status === 'collected') extra.collected_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('cod_orders')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/cod/bulk-status — Bulk update status for multiple COD orders (admin) */
export async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array.' });
    }

    const validStatuses = ['pending', 'delivered', 'collected', 'returned', 'flagged', 'undelivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const extra = {};
    if (status === 'delivered') extra.delivered_at = new Date().toISOString();
    if (status === 'collected') extra.collected_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('cod_orders')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .in('id', ids)
      .select();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, updated: data?.length ?? 0, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/cod/export — Export COD orders as CSV (admin) */
export async function exportCodReport(req, res, next) {
  try {
    const { start, end, status } = req.query;

    let query = supabase
      .from('cod_orders')
      .select('id,order_id,buyer_id,carrier_id,amount,surcharge,status,address,notes,fraud_score,is_flagged,delivered_at,collected_at,remitted_at,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const rows = data || [];
    const headers = ['id', 'order_id', 'buyer_id', 'carrier_id', 'amount', 'surcharge', 'status', 'address', 'notes', 'fraud_score', 'is_flagged', 'delivered_at', 'collected_at', 'remitted_at', 'created_at', 'updated_at'];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cod-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

/** GET /api/v1/cod/settings — Get COD settings (admin) */
export async function getCodSettings(req, res) {
  res.json({ success: true, data: codSettings });
}

/** PUT /api/v1/cod/settings — Update COD settings (admin) */
export async function updateCodSettings(req, res) {
  const allowed = ['enabled', 'surcharge_pct', 'surcharge_fixed', 'min_order_amount', 'max_order_amount', 'allowed_regions', 'blocked_regions'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  codSettings = { ...codSettings, ...updates, updated_at: new Date().toISOString() };
  res.json({ success: true, data: codSettings });
}
