import supabase from '../config/supabase.js';

export async function listActiveCampaigns(req, res, next) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('campaigns').select('*').eq('is_active', true).lte('start_date', now).gte('end_date', now).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCampaign(req, res, next) {
  try {
    const { data, error } = await supabase.from('campaigns').select('*, products:campaign_products(*, product:products(*))').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Campaign not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCampaign(req, res, next) {
  try {
    const { data, error } = await supabase.from('campaigns').insert(req.body).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateCampaign(req, res, next) {
  try {
    const { data, error } = await supabase.from('campaigns').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteCampaign(req, res, next) {
  try {
    const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Campaign deleted.' });
  } catch (err) { next(err); }
}

export async function addCampaignProducts(req, res, next) {
  try {
    const { products } = req.body; // [{ product_id, original_price, discounted_price }]
    const rows = products.map((p) => ({ ...p, campaign_id: req.params.id }));
    const { data, error } = await supabase.from('campaign_products').insert(rows).select();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
