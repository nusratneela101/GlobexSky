import supabase from '../config/supabase.js';
import {
  createStreamSession,
  startStreamSession,
  endStreamSession,
  getActiveLivestreams,
  getStreamById,
  addProductToStream,
  sendChatMessage,
  getStreamAnalytics,
} from '../services/livestream.service.js';

export async function createStream(req, res, next) {
  try {
    const { title, description, category, scheduled_at, thumbnail } = req.body;
    const data = await createStreamSession({
      hostId: req.user.id,
      title,
      description,
      category,
      scheduledAt: scheduled_at,
      thumbnail,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function startStream(req, res, next) {
  try {
    const data = await startStreamSession(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function endStream(req, res, next) {
  try {
    const data = await endStreamSession(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getActiveStreams(req, res, next) {
  try {
    const data = await getActiveLivestreams();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getStreamDetails(req, res, next) {
  try {
    const data = await getStreamById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function addStreamProduct(req, res, next) {
  try {
    const { product_id, featured_price } = req.body;
    const data = await addProductToStream(req.params.id, product_id, featured_price ?? null);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function sendStreamMessage(req, res, next) {
  try {
    const { message } = req.body;
    const data = await sendChatMessage(req.params.id, req.user.id, message);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getStreamAnalyticsHandler(req, res, next) {
  try {
    const data = await getStreamAnalytics(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Legacy handlers (kept for backward compatibility) ──────────────────────

export async function listLivestreams(req, res, next) {
  try {
    const { data, error } = await supabase.from('livestreams').select('*, supplier:supplier_profiles(company_name)').order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLivestream(req, res, next) {
  try {
    const { data, error } = await supabase.from('livestreams').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Livestream not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createLivestream(req, res, next) {
  try {
    const { title, description, thumbnail, scheduled_at } = req.body;
    const { data: supplierProfile } = await supabase.from('supplier_profiles').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase.from('livestreams').insert({
      supplier_id: supplierProfile?.id, title, description, thumbnail, scheduled_at, status: 'scheduled',
    }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function startLivestream(req, res, next) {
  try {
    const { data, error } = await supabase.from('livestreams').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function endLivestream(req, res, next) {
  try {
    const { data, error } = await supabase.from('livestreams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteLivestream(req, res, next) {
  try {
    const { error } = await supabase.from('livestreams').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Livestream deleted.' });
  } catch (err) { next(err); }
}
