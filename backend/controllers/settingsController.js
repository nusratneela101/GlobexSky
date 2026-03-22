/**
 * Settings Controller
 * Manages all system settings stored in the settings table.
 */

import supabase from '../config/supabase.js';

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
