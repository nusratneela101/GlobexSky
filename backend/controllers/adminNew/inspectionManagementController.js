/**
 * Admin Inspection Management Controller
 * Manages inspection queue, inspectors, pricing, reports, and stats.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/inspections/queue — pending inspection requests */
export async function getInspectionQueue(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('inspections')
      .select('*, requester:profiles!requester_id(id, full_name, email), product:products(id, name)', { count: 'exact' })
      .eq('status', 'pending')
      .range(from, to)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/inspections/:id/assign — assign inspector to inspection request */
export async function assignInspector(req, res, next) {
  try {
    const { inspectorId } = req.body;
    if (!inspectorId) return res.status(400).json({ success: false, error: 'inspectorId is required.' });

    const { data, error } = await supabase
      .from('inspections')
      .update({
        inspector_id: inspectorId,
        status: 'assigned',
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

/** GET /api/admin/inspectors — list all inspectors with availability */
export async function getInspectors(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('inspectors')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/inspectors — add new inspector profile */
export async function createInspector(req, res, next) {
  try {
    const { user_id, name, email, phone, certifications, regions, is_available = true } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: 'name and email are required.' });

    const { data, error } = await supabase
      .from('inspectors')
      .insert({ user_id, name, email, phone, certifications, regions, is_available, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/inspectors/:id/availability — update inspector availability/schedule */
export async function updateInspectorAvailability(req, res, next) {
  try {
    const { is_available, schedule } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (is_available !== undefined) updates.is_available = is_available;
    if (schedule !== undefined) updates.schedule = schedule;

    const { data, error } = await supabase
      .from('inspectors')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/inspections/pricing — current pricing by type */
export async function getInspectionPricing(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('inspection_pricing')
      .select('*')
      .order('inspection_type', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** PUT /api/admin/inspections/pricing/:type — admin sets prices */
export async function updateInspectionPricing(req, res, next) {
  try {
    const { type } = req.params;
    const { base_price, currency = 'USD', description } = req.body;
    if (!base_price) return res.status(400).json({ success: false, error: 'base_price is required.' });

    const { data, error } = await supabase
      .from('inspection_pricing')
      .upsert(
        { inspection_type: type, base_price, currency, description, updated_at: new Date().toISOString() },
        { onConflict: 'inspection_type' },
      )
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/inspections/reports — completed inspection reports with filters */
export async function getInspectionReports(req, res, next) {
  try {
    const { page = 1, limit = 50, inspector_id, from_date, to_date } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('inspections')
      .select('*, inspector:inspectors(id, name), product:products(id, name)', { count: 'exact' })
      .eq('status', 'completed')
      .range(from, to)
      .order('completed_at', { ascending: false });

    if (inspector_id) query = query.eq('inspector_id', inspector_id);
    if (from_date) query = query.gte('completed_at', from_date);
    if (to_date) query = query.lte('completed_at', to_date);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/inspections/stats — completion rates, average scores, revenue */
export async function getInspectionStats(req, res, next) {
  try {
    const [totalRes, completedRes, pendingRes, revenueRes] = await Promise.all([
      supabase.from('inspections').select('id', { count: 'exact', head: true }),
      supabase.from('inspections').select('id, score', { count: 'exact' }).eq('status', 'completed'),
      supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inspections').select('fee').eq('status', 'completed'),
    ]);

    const total = totalRes.count || 0;
    const completed = completedRes.count || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const scores = (completedRes.data || []).map((i) => i.score).filter(Boolean);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalRevenue = (revenueRes.data || []).reduce((sum, i) => sum + (parseFloat(i.fee) || 0), 0);

    res.json({
      success: true,
      data: {
        total_inspections: total,
        completed_inspections: completed,
        pending_inspections: pendingRes.count || 0,
        completion_rate_percent: completionRate,
        average_score: Math.round(avgScore * 10) / 10,
        total_revenue: totalRevenue,
      },
    });
  } catch (err) { next(err); }
}
