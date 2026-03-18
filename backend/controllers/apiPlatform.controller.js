import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export async function listApiKeys(req, res, next) {
  try {
    const { data, error } = await supabase.from('api_keys').select('id,api_key,plan_id,status,requests_used,created_at,expires_at').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createApiKey(req, res, next) {
  try {
    const { plan_id } = req.body;
    const apiKey = `gsk_${uuidv4().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('api_keys').insert({ user_id: req.user.id, api_key: apiKey, plan_id, status: 'active', requests_used: 0, expires_at: expiresAt }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function revokeApiKey(req, res, next) {
  try {
    const { error } = await supabase.from('api_keys').update({ status: 'revoked' }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'API key revoked.' });
  } catch (err) { next(err); }
}

export async function getApiUsage(req, res, next) {
  try {
    const { data, error } = await supabase.from('api_keys').select('requests_used,api_plans(request_limit)').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getApiPlans(req, res, next) {
  try {
    const { data, error } = await supabase.from('api_plans').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getApiLogs(req, res, next) {
  try {
    const { data: keys } = await supabase.from('api_keys').select('id').eq('user_id', req.user.id);
    const keyIds = (keys || []).map((k) => k.id);
    if (!keyIds.length) return res.json({ success: true, data: [] });
    const { data, error } = await supabase.from('api_logs').select('*').in('api_key_id', keyIds).order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

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

export async function deleteWebhook(req, res, next) {
  try {
    const { error } = await supabase.from('webhooks').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Webhook deleted.' });
  } catch (err) { next(err); }
}
