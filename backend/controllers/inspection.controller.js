import supabase from '../config/supabase.js';

export async function listInspections(req, res, next) {
  try {
    const role = req.user.profile?.role;
    let query = supabase.from('inspections').select('*').order('created_at', { ascending: false });
    if (role === 'buyer') query = query.eq('buyer_id', req.user.id);
    else if (role === 'supplier') query = query.eq('supplier_id', req.user.profile?.id);
    else if (role === 'inspector') query = query.eq('inspector_id', req.user.profile?.id);
    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getInspection(req, res, next) {
  try {
    const { data, error } = await supabase.from('inspections').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Inspection not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function requestInspection(req, res, next) {
  try {
    const { order_id, type, factory_address, scheduled_date } = req.body;
    const { data: pricing } = await supabase.from('inspection_pricing').select('price').eq('type', type).single();
    const { data, error } = await supabase.from('inspections').insert({
      order_id, buyer_id: req.user.id, type, status: 'requested', factory_address, scheduled_date, fee: pricing?.price || 0,
    }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateInspectionStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('inspections').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submitInspectionReport(req, res, next) {
  try {
    const { result, report_url, photos } = req.body;
    const { data, error } = await supabase.from('inspections').update({ result, report_url, photos, status: 'completed' }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
