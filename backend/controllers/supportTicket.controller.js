/**
 * Globex Sky — Support Ticket Admin Controller
 * Handles: ticket management, KB articles, FAQs
 */

import supabase from '../config/supabase.js';
import { buildPagination, buildMeta } from '../utils/pagination.js';

/* ═══════════════════════════════════════════════════════════════
   HELPER
═══════════════════════════════════════════════════════════════ */
function isAdmin(req) {
  return req.user?.profile?.role === 'admin';
}

/* ═══════════════════════════════════════════════════════════════
   TICKETS
═══════════════════════════════════════════════════════════════ */

/** GET /api/v1/admin/tickets — paginated, filtered ticket list */
export async function getAllTickets(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assigned_to,
      search,
      date_from,
      date_to,
    } = req.query;

    const { from, to, page: p, limit: l } = buildPagination(page, limit);

    let query = supabase
      .from('support_tickets')
      .select(
        `id, subject, status, priority, created_at, updated_at,
         user:profiles!support_tickets_user_id_fkey(id, full_name, email, avatar_url),
         assigned:profiles!support_tickets_assigned_to_fkey(id, full_name),
         messages:support_ticket_messages(count)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status)      query = query.eq('status', status);
    if (priority)    query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (date_from)   query = query.gte('created_at', date_from);
    if (date_to)     query = query.lte('created_at', date_to);
    if (search) {
      query = query.or(`subject.ilike.%${search}%,id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: buildMeta(count, p, l) });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/tickets/:id — full ticket with conversation */
export async function getTicketById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select(
        `*,
         user:profiles!support_tickets_user_id_fkey(id, full_name, email, avatar_url, created_at),
         assigned:profiles!support_tickets_assigned_to_fkey(id, full_name, email),
         messages:support_ticket_messages(
           id, body, is_internal, created_at, attachments,
           sender:profiles(id, full_name, avatar_url, role:profiles(role))
         ),
         history:support_ticket_history(id, action, changed_by, old_value, new_value, created_at,
           actor:profiles(full_name))`,
      )
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Ticket not found.' });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/tickets/:id/reply — admin reply */
export async function replyToTicket(req, res, next) {
  try {
    const { body, is_internal = false, attachments = [] } = req.body;
    const ticketId = req.params.id;

    const { data: ticket, error: ticketErr } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) return res.status(404).json({ success: false, error: 'Ticket not found.' });

    const { data: message, error: msgErr } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: req.user.id,
        body,
        is_internal: Boolean(is_internal),
        attachments,
      })
      .select()
      .single();

    if (msgErr) return res.status(400).json({ success: false, error: msgErr.message });

    // Move ticket to in_progress if still open
    if (ticket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      await _logHistory(ticketId, req.user.id, 'status_changed', 'open', 'in_progress');
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/tickets/:id/assign */
export async function assignTicket(req, res, next) {
  try {
    const { assigned_to } = req.body;
    const ticketId = req.params.id;

    const { data, error } = await supabase
      .from('support_tickets')
      .update({ assigned_to, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await _logHistory(ticketId, req.user.id, 'assigned', null, assigned_to);

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/tickets/:id/priority */
export async function updateTicketPriority(req, res, next) {
  try {
    const { priority } = req.body;
    const allowed = ['low', 'medium', 'high', 'urgent'];
    if (!allowed.includes(priority)) {
      return res.status(422).json({ success: false, error: 'Invalid priority value.' });
    }

    const { data: old } = await supabase
      .from('support_tickets')
      .select('priority')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabase
      .from('support_tickets')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await _logHistory(req.params.id, req.user.id, 'priority_changed', old?.priority, priority);

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/tickets/:id/status */
export async function updateTicketStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['open', 'pending', 'in_progress', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(422).json({ success: false, error: 'Invalid status value.' });
    }

    const { data: old } = await supabase
      .from('support_tickets')
      .select('status')
      .eq('id', req.params.id)
      .single();

    const updatePayload = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved' || status === 'closed') {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await _logHistory(req.params.id, req.user.id, 'status_changed', old?.status, status);

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/tickets/:id/notes — add internal note */
export async function addInternalNote(req, res, next) {
  try {
    const { body } = req.body;

    const { data, error } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: req.params.id,
        sender_id: req.user.id,
        body,
        is_internal: true,
        attachments: [],
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/tickets/stats */
export async function getTicketStats(req, res, next) {
  try {
    const statuses = ['open', 'pending', 'in_progress', 'resolved', 'closed'];
    const counts = {};

    for (const s of statuses) {
      const { count } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', s);
      counts[s] = count || 0;
    }

    res.json({ success: true, data: counts });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════
   KNOWLEDGE BASE ARTICLES
═══════════════════════════════════════════════════════════════ */

/** GET /api/v1/admin/kb/articles */
export async function getKBArticles(req, res, next) {
  try {
    const { page = 1, limit = 20, category, search, status } = req.query;
    const { from, to, page: p, limit: l } = buildPagination(page, limit);

    let query = supabase
      .from('kb_articles')
      .select('id, title, category, tags, status, views, created_at, updated_at, author:profiles(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category) query = query.eq('category', category);
    if (status)   query = query.eq('status', status);
    if (search)   query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: buildMeta(count, p, l) });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/kb/articles/:id */
export async function getKBArticleById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('kb_articles')
      .select('*, author:profiles(full_name, avatar_url)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Article not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/kb/articles */
export async function createKBArticle(req, res, next) {
  try {
    const { title, content, category, tags = [], status = 'draft' } = req.body;

    const { data, error } = await supabase
      .from('kb_articles')
      .insert({
        title,
        content,
        category,
        tags,
        status,
        author_id: req.user.id,
        views: 0,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/kb/articles/:id */
export async function updateKBArticle(req, res, next) {
  try {
    const { title, content, category, tags, status } = req.body;

    const { data, error } = await supabase
      .from('kb_articles')
      .update({ title, content, category, tags, status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/admin/kb/articles/:id */
export async function deleteKBArticle(req, res, next) {
  try {
    const { error } = await supabase
      .from('kb_articles')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Article deleted.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/kb/categories */
export async function getKBCategories(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('kb_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/kb/categories */
export async function createKBCategory(req, res, next) {
  try {
    const { name, description, sort_order = 0 } = req.body;

    const { data, error } = await supabase
      .from('kb_categories')
      .insert({ name, description, sort_order })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/kb/categories/:id */
export async function updateKBCategory(req, res, next) {
  try {
    const { name, description, sort_order } = req.body;

    const { data, error } = await supabase
      .from('kb_categories')
      .update({ name, description, sort_order })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/admin/kb/categories/:id */
export async function deleteKBCategory(req, res, next) {
  try {
    const { error } = await supabase
      .from('kb_categories')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════
   FAQs
═══════════════════════════════════════════════════════════════ */

/** GET /api/v1/admin/kb/faqs */
export async function getFAQs(req, res, next) {
  try {
    const { category, search } = req.query;

    let query = supabase
      .from('faqs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (category) query = query.eq('category', category);
    if (search)   query = query.ilike('question', `%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/kb/faqs */
export async function createFAQ(req, res, next) {
  try {
    const { question, answer, category = 'General', sort_order = 0, is_visible = true } = req.body;

    const { data, error } = await supabase
      .from('faqs')
      .insert({ question, answer, category, sort_order, is_visible })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/kb/faqs/:id */
export async function updateFAQ(req, res, next) {
  try {
    const { question, answer, category, sort_order, is_visible } = req.body;

    const { data, error } = await supabase
      .from('faqs')
      .update({ question, answer, category, sort_order, is_visible, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/admin/kb/faqs/:id */
export async function deleteFAQ(req, res, next) {
  try {
    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'FAQ deleted.' });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/kb/faqs/reorder — bulk sort_order update */
export async function reorderFAQs(req, res, next) {
  try {
    const { items } = req.body; // [{ id, sort_order }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ success: false, error: 'items array is required.' });
    }

    const updates = items.map(({ id, sort_order }) =>
      supabase.from('faqs').update({ sort_order }).eq('id', id),
    );

    await Promise.all(updates);
    res.json({ success: true, message: 'FAQs reordered.' });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL HELPER
═══════════════════════════════════════════════════════════════ */
async function _logHistory(ticketId, actorId, action, oldValue, newValue) {
  try {
    await supabase.from('support_ticket_history').insert({
      ticket_id: ticketId,
      changed_by: actorId,
      action,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch (_) {
    // Non-critical — swallow error
  }
}
