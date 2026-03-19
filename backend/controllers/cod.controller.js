import supabase from '../config/supabase.js';
import {
  createCodOrderRecord,
  confirmDelivery,
  confirmCollection,
  markFraudulent,
  buildReconciliationReport,
  getCodAnalyticsData,
} from '../services/cod.service.js';

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
