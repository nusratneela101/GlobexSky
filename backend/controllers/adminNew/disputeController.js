/**
 * Admin Dispute Controller
 * Manages disputes, mediator assignments, resolutions, and escalations.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/disputes — list all disputes with filters */
export async function getDisputes(req, res, next) {
  try {
    const { page = 1, limit = 50, status, type, from_date, to_date } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('disputes')
      .select(
        '*, claimant:profiles!claimant_id(id, full_name, email), respondent:profiles!respondent_id(id, full_name, email), order:orders(id, order_number)',
        { count: 'exact' },
      )
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('dispute_type', type);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/disputes/:id — detailed dispute info */
export async function getDisputeById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('disputes')
      .select(
        '*, claimant:profiles!claimant_id(id, full_name, email, phone), respondent:profiles!respondent_id(id, full_name, email, phone), order:orders(id, order_number, total_amount), mediator:profiles!mediator_id(id, full_name, email), dispute_messages(*)',
      )
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ success: false, error: 'Dispute not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/disputes/:id/assign — assign mediator to dispute */
export async function assignMediator(req, res, next) {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ success: false, error: 'adminId is required.' });

    const { data, error } = await supabase
      .from('disputes')
      .update({
        mediator_id: adminId,
        status: 'in_mediation',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/disputes/:id/resolve — add resolution with optional refund */
export async function addResolution(req, res, next) {
  try {
    const { resolution, refundAmount } = req.body;
    if (!resolution) return res.status(400).json({ success: false, error: 'resolution is required.' });

    const { data, error } = await supabase
      .from('disputes')
      .update({
        resolution,
        refund_amount: refundAmount || 0,
        status: 'resolved',
        resolved_by: req.user?.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/disputes/:id/escalate — escalate dispute */
export async function escalateDispute(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required.' });

    const { data, error } = await supabase
      .from('disputes')
      .update({
        status: 'escalated',
        escalation_reason: reason,
        escalated_by: req.user?.id,
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/disputes/stats — resolution times, outcomes */
export async function getDisputeStats(req, res, next) {
  try {
    const [total, open, resolved, escalated, closedRes] = await Promise.all([
      supabase.from('disputes').select('id', { count: 'exact', head: true }),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('disputes').select('id, created_at, resolved_at', { count: 'exact' }).eq('status', 'resolved'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'escalated'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
    ]);

    // Average resolution time in hours
    const resolvedData = resolved.data || [];
    let avgResolutionHours = 0;
    if (resolvedData.length > 0) {
      const totalMs = resolvedData.reduce((sum, d) => {
        const created = new Date(d.created_at).getTime();
        const resolvedAt = new Date(d.resolved_at).getTime();
        return sum + (resolvedAt - created);
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolvedData.length / 3600000) * 10) / 10;
    }

    res.json({
      success: true,
      data: {
        total_disputes: total.count || 0,
        open_disputes: open.count || 0,
        resolved_disputes: resolved.count || 0,
        escalated_disputes: escalated.count || 0,
        closed_disputes: closedRes.count || 0,
        avg_resolution_hours: avgResolutionHours,
      },
    });
  } catch (err) { next(err); }
}

/** POST /api/admin/disputes/:id/close — close a dispute */
export async function closeDispute(req, res, next) {
  try {
    const { outcome } = req.body;
    if (!outcome) return res.status(400).json({ success: false, error: 'outcome is required.' });

    const { data, error } = await supabase
      .from('disputes')
      .update({
        status: 'closed',
        outcome,
        closed_by: req.user?.id,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
