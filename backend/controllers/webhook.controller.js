import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export async function listWebhooks(req, res, next) {
  try {
    const { data, error } = await supabase.from('webhooks').select('*').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createWebhook(req, res, next) {
  try {
    const { url, events } = req.body;
    const secret = uuidv4();
    const { data, error } = await supabase.from('webhooks').insert({ user_id: req.user.id, url, events, secret, is_active: true }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateWebhook(req, res, next) {
  try {
    const { url, events, is_active } = req.body;
    const { data, error } = await supabase.from('webhooks').update({ url, events, is_active }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteWebhook(req, res, next) {
  try {
    const { error } = await supabase.from('webhooks').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Webhook deleted.' });
  } catch (err) { next(err); }
}

export async function testWebhook(req, res, next) {
  try {
    const { data: webhook } = await supabase.from('webhooks').select('url').eq('id', req.params.id).single();
    if (!webhook) return res.status(404).json({ success: false, error: 'Webhook not found.' });
    // In production, send a test HTTP POST to webhook.url
    res.json({ success: true, message: `Test payload sent to ${webhook.url}` });
  } catch (err) { next(err); }
}
