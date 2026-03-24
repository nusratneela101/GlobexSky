/**
 * Admin Content Moderation Controller
 * Manages moderation queue, banned words, auto-moderation rules, and stats.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/moderation/queue — items awaiting moderation (reviews, messages, images) */
export async function getModerationQueue(req, res, next) {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('moderation_queue')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .range(from, to)
      .order('created_at', { ascending: true });

    if (type) query = query.eq('content_type', type);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/moderation/:id/approve */
export async function approveContent(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('moderation_queue')
      .update({
        status: 'approved',
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/moderation/:id/reject */
export async function rejectContent(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required.' });

    const { data, error } = await supabase
      .from('moderation_queue')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/moderation/:id/flag — flag for review */
export async function flagContent(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required.' });

    const { data, error } = await supabase
      .from('moderation_queue')
      .update({
        status: 'flagged',
        flag_reason: reason,
        flagged_by: req.user?.id,
        flagged_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/moderation/reported — user-reported content with filters */
export async function getReportedContent(req, res, next) {
  try {
    const { page = 1, limit = 50, type, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('content_reports')
      .select('*, reporter:profiles!reporter_id(id, full_name, email)', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (type) query = query.eq('content_type', type);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/moderation/banned-words — list of banned words/phrases */
export async function getBannedWords(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('banned_words')
      .select('*')
      .order('word', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** PUT /api/admin/moderation/banned-words — add/remove banned words */
export async function updateBannedWords(req, res, next) {
  try {
    const { add = [], remove = [] } = req.body;

    const promises = [];

    if (add.length > 0) {
      const toInsert = add.map((word) => ({
      word: word.toLowerCase(),
      added_by: req.user?.id,
      created_at: new Date().toISOString(),
    }));
      promises.push(supabase.from('banned_words').upsert(toInsert, { onConflict: 'word' }));
    }

    if (remove.length > 0) {
      const lowerRemove = remove.map((w) => w.toLowerCase());
      promises.push(supabase.from('banned_words').delete().in('word', lowerRemove));
    }

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error).map((r) => r.error.message);
    if (errors.length > 0) return res.status(400).json({ success: false, error: errors.join('; ') });

    res.json({ success: true, message: `Added ${add.length} word(s), removed ${remove.length} word(s).` });
  } catch (err) { next(err); }
}

/** GET /api/admin/moderation/auto-rules — automated content filtering rules */
export async function getAutoModerationRules(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('auto_moderation_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/admin/moderation/auto-rules — set auto-moderation rule */
export async function setAutoModerationRule(req, res, next) {
  try {
    const { name, trigger_type, trigger_value, action, is_active = true } = req.body;
    if (!name || !trigger_type || !action) {
      return res.status(400).json({ success: false, error: 'name, trigger_type, and action are required.' });
    }

    const { data, error } = await supabase
      .from('auto_moderation_rules')
      .insert({ name, trigger_type, trigger_value, action, is_active, created_by: req.user?.id, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/moderation/stats — approval/rejection rates */
export async function getModerationStats(req, res, next) {
  try {
    const [total, approved, rejected, flagged, pending] = await Promise.all([
      supabase.from('moderation_queue').select('id', { count: 'exact', head: true }),
      supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('status', 'flagged'),
      supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const totalCount = total.count || 0;
    const approvedCount = approved.count || 0;
    const rejectedCount = rejected.count || 0;

    res.json({
      success: true,
      data: {
        total: totalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        flagged: flagged.count || 0,
        pending: pending.count || 0,
        approval_rate_percent: totalCount > 0 ? Math.round((approvedCount / totalCount) * 100 * 10) / 10 : 0,
        rejection_rate_percent: totalCount > 0 ? Math.round((rejectedCount / totalCount) * 100 * 10) / 10 : 0,
      },
    });
  } catch (err) { next(err); }
}
