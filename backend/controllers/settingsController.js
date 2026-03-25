/**
 * Settings Controller
 * Manages all system settings stored in the settings table, plus the new
 * platform_settings table for dynamic API key / service configuration.
 */

import supabase from '../config/supabase.js';
import {
  getCategorySettings,
  saveSettings,
  refreshConfig,
  getActiveMode,
  getConfig,
} from '../config/dynamicConfig.js';

// ─── Sensitive keys per service (encrypted at rest) ──────────────────────────
const SENSITIVE = {
  stripe:   new Set(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET']),
  paypal:   new Set(['PAYPAL_CLIENT_SECRET']),
  bkash:    new Set(['BKASH_APP_SECRET', 'BKASH_PASSWORD']),
  nagad:    new Set(['NAGAD_MERCHANT_PRIVATE_KEY']),
  supabase: new Set(['SUPABASE_SERVICE_ROLE_KEY']),
  openai:   new Set(['OPENAI_API_KEY']),
  agora:    new Set(['AGORA_APP_CERTIFICATE']),
  smtp:     new Set(['SMTP_PASS']),
  general:  new Set([]),
};

const VALID_CATEGORIES = new Set(Object.keys(SENSITIVE));

// ─── Platform Settings CRUD ───────────────────────────────────────────────────

/** GET /api/v1/admin/settings/platform
 *  Returns all platform settings grouped by category (sensitive values masked). */
export async function getPlatformSettings(req, res, next) {
  try {
    const mode = await getActiveMode();
    const categories = [...VALID_CATEGORIES];
    const result = {};
    await Promise.all(
      categories.map(async (cat) => {
        result[cat] = await getCategorySettings(cat, mode);
      }),
    );
    res.json({ success: true, mode, data: result });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/settings/platform/:category
 *  Returns platform settings for a single category. */
export async function getPlatformCategory(req, res, next) {
  try {
    const { category } = req.params;
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, error: `Unknown category: ${category}` });
    }
    const mode = req.query.mode || await getActiveMode();
    const data = await getCategorySettings(category, mode);
    res.json({ success: true, category, mode, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/admin/settings/platform/:category
 *  Upsert settings for a category. Body: { mode: 'test'|'live', settings: { KEY: value } } */
export async function updatePlatformCategory(req, res, next) {
  try {
    const { category } = req.params;
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, error: `Unknown category: ${category}` });
    }

    const { mode = 'test', settings: kvPairs } = req.body;
    if (!['test', 'live'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'mode must be "test" or "live".' });
    }
    if (!kvPairs || typeof kvPairs !== 'object') {
      return res.status(400).json({ success: false, error: 'settings object is required.' });
    }

    const result = await saveSettings(category, mode, kvPairs, SENSITIVE[category] || new Set());
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    refreshConfig();
    res.json({ success: true, message: `${category} settings saved for ${mode} mode.` });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/settings/platform/toggle-mode
 *  Toggle global mode between test and live.
 *  Optionally accepts { category } to toggle a per-category mode setting. */
export async function togglePlatformMode(req, res, next) {
  try {
    const currentMode = await getActiveMode();
    const newMode = currentMode === 'live' ? 'test' : 'live';

    // Persist new global MODE to the general category
    await saveSettings('general', 'test', { MODE: newMode }, new Set());
    // Also update process.env so the running server reflects the change immediately
    process.env.MODE = newMode;
    refreshConfig();

    res.json({
      success: true,
      message: `Switched to ${newMode} mode.`,
      previousMode: currentMode,
      currentMode: newMode,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/settings/platform/:category/toggle-mode
 *  Toggle the active mode for a specific service category.
 *  Stores a per-category MODE key in the DB (mode column = 'test' as a
 *  convention for meta/global settings that are not mode-specific). */
export async function toggleCategoryMode(req, res, next) {
  try {
    const { category } = req.params;
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, error: `Unknown category: ${category}` });
    }

    // Read the current per-category mode, then fall back to global MODE
    const modeKey = `${category.toUpperCase()}_MODE`;
    const categoryModeValue = await getConfig(modeKey, category);
    const globalMode = await getActiveMode();
    const currentMode = categoryModeValue || globalMode;
    const newMode = currentMode === 'live' ? 'test' : 'live';

    // Persist the new per-category mode.
    // We store it with mode='test' as a convention for meta/config settings
    // (they need a valid mode column value but are not tied to test/live key sets).
    await saveSettings(category, 'test', { [modeKey]: newMode }, new Set());
    refreshConfig();

    res.json({
      success: true,
      message: `${category} mode switched to "${newMode}".`,
      category,
      previousMode: currentMode,
      currentMode: newMode,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/settings/platform/test-connection
 *  Tests connectivity for a given service using its currently stored keys.
 *  Body: { category: 'stripe'|'paypal'|'supabase'|'openai'|'smtp'|'agora', mode: 'test'|'live' } */
export async function testPlatformConnection(req, res, next) {
  try {
    const { category, mode: reqMode } = req.body;
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, error: `Unknown category: ${category}` });
    }
    const mode = reqMode || await getActiveMode();
    let result;

    switch (category) {
      case 'supabase':
        result = await _testSupabase(mode);
        break;
      case 'stripe':
        result = await _testStripe(mode);
        break;
      case 'openai':
        result = await _testOpenAI(mode);
        break;
      case 'smtp':
        result = await _testSmtp(mode);
        break;
      case 'agora':
        result = await _testAgora(mode);
        break;
      default:
        result = { ok: true, message: `No automated test for ${category}. Keys saved successfully.` };
    }

    res.json({ success: true, category, mode, result });
  } catch (err) { next(err); }
}

// ─── Connection testers ───────────────────────────────────────────────────────

async function _testSupabase(mode) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = await getConfig('SUPABASE_URL', 'supabase', mode) || process.env.SUPABASE_URL;
    const key = await getConfig('SUPABASE_SERVICE_ROLE_KEY', 'supabase', mode) || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { ok: false, message: 'Supabase URL or service role key not configured.' };
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
    return error ? { ok: false, message: error.message } : { ok: true, message: 'Supabase connected successfully.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function _testStripe(mode) {
  try {
    const Stripe = (await import('stripe')).default;
    // In the DB, keys are stored as STRIPE_SECRET_KEY with a mode column.
    // For .env fallback, the naming convention uses STRIPE_{LIVE|TEST}_SECRET_KEY.
    const secretKey =
      (await getConfig('STRIPE_SECRET_KEY', 'stripe', mode)) ||
      process.env[mode === 'live' ? 'STRIPE_LIVE_SECRET_KEY' : 'STRIPE_TEST_SECRET_KEY'];
    if (!secretKey) return { ok: false, message: 'Stripe secret key not configured.' };
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    await stripe.balance.retrieve();
    return { ok: true, message: `Stripe connected (${mode} mode).` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function _testOpenAI(mode) {
  try {
    const { default: OpenAI } = await import('openai');
    const apiKey = await getConfig('OPENAI_API_KEY', 'openai', mode) || process.env.OPENAI_API_KEY;
    if (!apiKey) return { ok: false, message: 'OpenAI API key not configured.' };
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    return { ok: true, message: 'OpenAI connected successfully.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function _testSmtp(mode) {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const host = await getConfig('SMTP_HOST', 'smtp', mode) || process.env.SMTP_HOST;
    const port = parseInt(await getConfig('SMTP_PORT', 'smtp', mode) || process.env.SMTP_PORT || '587', 10);
    const user = await getConfig('SMTP_USER', 'smtp', mode) || process.env.SMTP_USER;
    const pass = await getConfig('SMTP_PASS', 'smtp', mode) || process.env.SMTP_PASS;
    if (!host) return { ok: false, message: 'SMTP host not configured.' };
    const transporter = nodemailer.createTransport({ host, port, auth: user && pass ? { user, pass } : undefined });
    await transporter.verify();
    return { ok: true, message: `SMTP connected to ${host}:${port}.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function _testAgora(mode) {
  const appId = await getConfig('AGORA_APP_ID', 'agora', mode) || process.env.AGORA_APP_ID;
  const cert  = await getConfig('AGORA_APP_CERTIFICATE', 'agora', mode) || process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !cert) return { ok: false, message: 'Agora App ID or Certificate not configured.' };
  // Agora has no lightweight REST ping — confirm credentials are present
  return { ok: true, message: 'Agora credentials present. Token generation will validate on first use.' };
}

// Helper: get settings by group
async function getGroup(group) {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value, type')
    .eq('group', group);
  if (error) throw error;
  // Convert array to key-value object
  return (data || []).reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
}

// Helper: upsert multiple settings for a group
async function upsertGroup(group, kvPairs) {
  const rows = Object.entries(kvPairs).map(([key, value]) => ({
    key: `${group}.${key}`,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
    group,
    type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
    updated_at: new Date().toISOString(),
  }));
  return supabase.from('settings').upsert(rows, { onConflict: 'key' }).select();
}

/** GET /api/admin/settings — all settings */
export async function getAllSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('settings').select('*').order('group').order('key');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/general */
export async function updateGeneralSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('general', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'General settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/email */
export async function updateEmailSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('email', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Email settings updated.' });
  } catch (err) { next(err); }
}

/** POST /api/admin/settings/email/test — send test email */
export async function sendTestEmail(req, res, next) {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, error: 'Recipient email (to) is required.' });
    // In a real implementation, this would use the email service
    res.json({ success: true, message: `Test email queued for ${to}.` });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/sms */
export async function updateSmsSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('sms', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'SMS settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/payment */
export async function updatePaymentSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('payment', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Payment settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/shipping */
export async function updateShippingSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('shipping', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Shipping settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/storage */
export async function updateStorageSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('storage', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Storage settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/security */
export async function updateSecuritySettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('security', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Security settings updated.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/settings/seo */
export async function updateSeoSettings(req, res, next) {
  try {
    const { data, error } = await upsertGroup('seo', req.body);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'SEO settings updated.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/settings/languages */
export async function getLanguages(req, res, next) {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('group', 'languages');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/settings/languages */
export async function addLanguage(req, res, next) {
  try {
    const { code, name, is_rtl = false, is_active = true } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, error: 'Language code and name are required.' });

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key: `lang.${code}`,
        value: JSON.stringify({ code, name, is_rtl, is_active }),
        group: 'languages',
        type: 'json',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/settings/currencies */
export async function getCurrencies(req, res, next) {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('group', 'currencies');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/settings/currencies */
export async function addCurrency(req, res, next) {
  try {
    const { code, name, symbol, exchange_rate, is_active = true } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, error: 'Currency code and name are required.' });

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key: `currency.${code}`,
        value: JSON.stringify({ code, name, symbol, exchange_rate, is_active }),
        group: 'currencies',
        type: 'json',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/settings/backup */
export async function createBackup(req, res, next) {
  try {
    const { type = 'full' } = req.body;
    const filename = `backup_${type}_${Date.now()}.sql`;

    const { data, error } = await supabase
      .from('backups')
      .insert({
        filename,
        size: 0,
        type,
        status: 'pending',
        created_by: req.user?.profile?.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data, message: 'Backup job created.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/settings/backups */
export async function listBackups(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/settings/restore/:id */
export async function restoreBackup(req, res, next) {
  try {
    const { data: backup } = await supabase
      .from('backups')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!backup) return res.status(404).json({ success: false, error: 'Backup not found.' });
    if (backup.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Only completed backups can be restored.' });
    }

    // Update status to indicate restore is in progress
    await supabase.from('backups').update({ status: 'restoring' }).eq('id', req.params.id);

    res.json({ success: true, message: 'Restore job started.', backup_id: req.params.id });
  } catch (err) { next(err); }
}
