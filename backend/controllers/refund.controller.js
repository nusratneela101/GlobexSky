import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/** POST /api/v1/refunds  — buyer initiates a refund request */
export async function initiateRefund(req, res, next) {
  try {
    const { order_id, dispute_id, amount, reason } = req.body;
    const userId = req.user.id;

    // Verify the order belongs to this buyer
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, buyer_id, total, payment_status')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    if (order.buyer_id !== userId) {
      return res.status(403).json({ success: false, error: 'You can only request refunds for your own orders.' });
    }
    if (amount > order.total) {
      return res.status(400).json({ success: false, error: 'Refund amount cannot exceed the order total.' });
    }

    const { data, error } = await supabase
      .from('refunds')
      .insert({
        order_id,
        dispute_id: dispute_id || null,
        amount,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/refunds */
export async function getRefunds(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    const role = req.user.profile?.role;

    let query = supabase
      .from('refunds')
      .select('*, order:orders(id, tracking_number, total, buyer_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role !== 'admin') {
      // Join through orders to filter by buyer
      query = supabase
        .from('refunds')
        .select('*, order:orders!inner(id, tracking_number, total, buyer_id)', { count: 'exact' })
        .eq('order.buyer_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
    }
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/refunds/:id */
export async function getRefundById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select('*, order:orders(*), dispute:disputes(*), processor:profiles(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Refund not found.' });

    const role = req.user.profile?.role;
    if (role !== 'admin' && data.order?.buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/refunds/:id/approve  (admin) */
export async function approveRefund(req, res, next) {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('refunds')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ success: false, error: 'Refund not found.' });
    if (existing.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending refunds can be approved.' });
    }

    const { data, error } = await supabase
      .from('refunds')
      .update({
        status: 'approved',
        processed_by: req.user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/refunds/:id/reject  (admin) */
export async function rejectRefund(req, res, next) {
  try {
    const { reason } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('refunds')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ success: false, error: 'Refund not found.' });
    if (existing.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending refunds can be rejected.' });
    }

    const { data, error } = await supabase
      .from('refunds')
      .update({
        status: 'rejected',
        reason: reason || existing.reason,
        processed_by: req.user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/refunds/:id/process  (admin) */
export async function processRefund(req, res, next) {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('refunds')
      .select('id, status, order_id, amount')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ success: false, error: 'Refund not found.' });
    if (existing.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Only approved refunds can be processed.' });
    }

    // Update refund status to processed
    const { data: refund, error } = await supabase
      .from('refunds')
      .update({
        status: 'processed',
        processed_by: req.user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Update corresponding order payment status to refunded
    await supabase
      .from('orders')
      .update({ payment_status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', existing.order_id);

    res.json({ success: true, data: refund });
  } catch (err) { next(err); }
}
