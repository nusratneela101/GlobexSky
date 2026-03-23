import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function listAds(req, res, next) {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase
      .from('advertisements')
      .select('*, supplier:suppliers(id,company_name)', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('ad_type', type);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getMyAds(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', req.user.id).single();
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier profile not found.' });
    let query = supabase
      .from('advertisements')
      .select('*', { count: 'exact' })
      .eq('supplier_id', supplier.id)
      .range(from, to)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getAd(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('advertisements')
      .select('*, supplier:suppliers(id,company_name)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Advertisement not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAd(req, res, next) {
  try {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', req.user.id).single();
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier profile not found.' });
    const adData = { ...req.body, supplier_id: supplier.id, status: 'pending' };
    const { data, error } = await supabase.from('advertisements').insert(adData).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateAd(req, res, next) {
  try {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase
      .from('advertisements')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('supplier_id', supplier?.id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Advertisement not found or unauthorized.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteAd(req, res, next) {
  try {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', req.user.id).single();
    const { error } = await supabase
      .from('advertisements')
      .delete()
      .eq('id', req.params.id)
      .eq('supplier_id', supplier?.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Advertisement deleted.' });
  } catch (err) { next(err); }
}

export async function approveAd(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('advertisements')
      .update({ status: 'active', approved_at: new Date().toISOString(), approved_by: req.user.id })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Advertisement not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function rejectAd(req, res, next) {
  try {
    const { reason } = req.body;
    const { data, error } = await supabase
      .from('advertisements')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Advertisement not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function recordImpression(req, res, next) {
  try {
    const { ad_id } = req.body;
    await supabase.rpc('increment_ad_impressions', { p_ad_id: ad_id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function recordClick(req, res, next) {
  try {
    const { ad_id } = req.body;
    await supabase.rpc('increment_ad_clicks', { p_ad_id: ad_id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getAdAnalytics(req, res, next) {
  try {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase
      .from('advertisements')
      .select('id,title,ad_type,impressions,clicks,budget,spent,status')
      .eq('supplier_id', supplier?.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    const summary = {
      total_ads: data.length,
      active_ads: data.filter(a => a.status === 'active').length,
      total_impressions: data.reduce((s, a) => s + (a.impressions || 0), 0),
      total_clicks: data.reduce((s, a) => s + (a.clicks || 0), 0),
      total_spent: data.reduce((s, a) => s + (a.spent || 0), 0),
      total_budget: data.reduce((s, a) => s + (a.budget || 0), 0),
    };
    res.json({ success: true, data, summary });
  } catch (err) { next(err); }
}
