import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/** POST /api/v1/disputes */
export async function createDispute(req, res, next) {
  try {
    const { order_id, type, reason, description } = req.body;
    const userId = req.user.id;

    // Verify the order belongs to this buyer
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, buyer_id, status')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    if (order.buyer_id !== userId) {
      return res.status(403).json({ success: false, error: 'You can only dispute your own orders.' });
    }

    const { data, error } = await supabase
      .from('disputes')
      .insert({
        order_id,
        user_id: userId,
        type,
        reason,
        description,
        status: 'open',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/disputes */
export async function getDisputes(req, res, next) {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const { from, to } = buildPagination(page, limit);
    const role = req.user.profile?.role;

    let query = supabase
      .from('disputes')
      .select('*, order:orders(id,tracking_number,total), messages:dispute_messages(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role !== 'admin') {
      query = query.eq('user_id', req.user.id);
    }
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/disputes/:id */
export async function getDisputeById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('disputes')
      .select('*, order:orders(*), messages:dispute_messages(*, sender:profiles(*))')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Dispute not found.' });

    const role = req.user.profile?.role;
    if (role !== 'admin' && data.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/disputes/:id */
export async function updateDispute(req, res, next) {
  try {
    const { reason, description } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('disputes')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ success: false, error: 'Dispute not found.' });
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    if (!['open', 'pending'].includes(existing.status)) {
      return res.status(400).json({ success: false, error: 'Only open or pending disputes can be updated.' });
    }

    const { data, error } = await supabase
      .from('disputes')
      .update({ reason, description, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/disputes/:id/resolve  (admin) */
export async function resolveDispute(req, res, next) {
  try {
    const { resolution } = req.body;

    const { data, error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Dispute not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/disputes/:id/escalate */
export async function escalateDispute(req, res, next) {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('disputes')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ success: false, error: 'Dispute not found.' });

    const role = req.user.profile?.role;
    if (role !== 'admin' && existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    if (existing.status === 'escalated') {
      return res.status(400).json({ success: false, error: 'Dispute is already escalated.' });
    }

    const { data, error } = await supabase
      .from('disputes')
      .update({ status: 'escalated', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/disputes/:id/messages */
export async function addDisputeMessage(req, res, next) {
  try {
    const { message, attachments } = req.body;
    const senderId = req.user.id;

    // Verify access to this dispute
    const { data: dispute, error: fetchErr } = await supabase
      .from('disputes')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !dispute) return res.status(404).json({ success: false, error: 'Dispute not found.' });

    const role = req.user.profile?.role;
    if (role !== 'admin' && dispute.user_id !== senderId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    if (dispute.status === 'closed') {
      return res.status(400).json({ success: false, error: 'Cannot add messages to a closed dispute.' });
    }

    const { data, error } = await supabase
      .from('dispute_messages')
      .insert({
        dispute_id: req.params.id,
        sender_id: senderId,
        message,
        attachments: attachments || [],
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
