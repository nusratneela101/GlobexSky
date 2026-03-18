import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function listRFQs(req, res, next) {
  try {
    const { page = 1, limit = 20, category_id } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('rfqs').select('*, buyer:profiles!buyer_id(full_name)', { count: 'exact' }).eq('status', 'open').range(from, to);
    if (category_id) query = query.eq('category_id', category_id);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getRFQ(req, res, next) {
  try {
    const { data, error } = await supabase.from('rfqs').select('*, quotes:rfq_quotes(*, supplier:supplier_profiles(*))').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'RFQ not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createRFQ(req, res, next) {
  try {
    const { product_name, description, quantity, unit, target_price, category_id, attachments } = req.body;
    const { data, error } = await supabase.from('rfqs').insert({
      buyer_id: req.user.id, product_name, description, quantity, unit, target_price, category_id, attachments, status: 'open',
    }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submitQuote(req, res, next) {
  try {
    const { price, moq, lead_time, notes } = req.body;
    const { data: supplierProfile } = await supabase.from('supplier_profiles').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase.from('rfq_quotes').insert({
      rfq_id: req.params.id, supplier_id: supplierProfile?.id, price, moq, lead_time, notes, status: 'pending',
    }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    // Update RFQ status
    await supabase.from('rfqs').update({ status: 'quoted' }).eq('id', req.params.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateRFQStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('rfqs').update({ status }).eq('id', req.params.id).eq('buyer_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateQuoteStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('rfq_quotes').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
