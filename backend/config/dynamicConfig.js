/**
 * backend/config/dynamicConfig.js
 * Dynamic configuration loader.
 *
 * Reads platform settings from the `platform_settings` table in Supabase.
 * Falls back to `process.env` / env.js values when a DB setting is absent.
 * Results are cached in-memory for TTL_MS milliseconds to avoid hitting the
 * database on every request.
 *
 * Usage:
 *   import { getConfig, refreshConfig } from './dynamicConfig.js';
 *   const stripeKey = await getConfig('STRIPE_SECRET_KEY', 'stripe');
 */

import { createClient } from '@supabase/supabase-js';
import { createDecipheriv, createCipheriv, randomBytes, scryptSync } from 'crypto';

// ─── Encryption helpers ───────────────────────────────────────────────────────

const ENCRYPTION_KEY_RAW = process.env.SETTINGS_ENCRYPTION_KEY || 'globexsky-settings-default-key-32b';
const ALGORITHM = 'aes-256-cbc';

/** Derive a 32-byte key from the raw string. */
const _key = scryptSync(ENCRYPTION_KEY_RAW, 'globexsky-salt', 32);

/**
 * Encrypt a plaintext string.
 * @param {string} text
 * @returns {string}  iv:ciphertext  (hex:hex)
 */
export function encrypt(text) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, _key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an iv:ciphertext string produced by `encrypt`.
 * Returns `null` if decryption fails.
 * @param {string} data
 * @returns {string|null}
 */
export function decrypt(data) {
  try {
    const [ivHex, encHex] = data.split(':');
    if (!ivHex || !encHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const encBuf = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, _key, iv);
    return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, {value: string|null, expires: number}>} */
const _cache = new Map();

function _cacheKey(key, mode) {
  return `${key}::${mode}`;
}

// ─── Supabase client (service-role) ──────────────────────────────────────────

function _getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a platform setting value.
 * Checks the in-memory cache first, then the `platform_settings` table,
 * and finally falls back to `process.env[key]`.
 *
 * @param {string} key       Setting key, e.g. 'STRIPE_SECRET_KEY'.
 * @param {string} [category]  Optional category hint for DB lookup.
 * @param {string} [mode]    'test' | 'live' (defaults to current MODE env var).
 * @returns {Promise<string|null>}
 */
export async function getConfig(key, category = null, mode = null) {
  const resolvedMode = mode || (process.env.MODE || 'test').toLowerCase();
  const ck = _cacheKey(key, resolvedMode);

  // Cache hit
  const cached = _cache.get(ck);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  let value = null;

  // Try DB
  const supabase = _getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase
        .from('platform_settings')
        .select('setting_value, is_sensitive')
        .eq('setting_key', key)
        .eq('mode', resolvedMode)
        .eq('is_active', true);

      if (category) query = query.eq('category', category);

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        value = data.is_sensitive ? decrypt(data.setting_value) : data.setting_value;
      }
    } catch {
      // DB unavailable — fall through to env
    }
  }

  // Fallback to process.env
  if (value === null || value === undefined) {
    value = process.env[key] ?? null;
  }

  // Populate cache
  _cache.set(ck, { value, expires: Date.now() + TTL_MS });

  return value;
}

/**
 * Fetch all settings for a category and mode from the DB.
 * Returns an array of { setting_key, setting_value (decrypted), is_sensitive, mode }.
 *
 * @param {string} category
 * @param {string} [mode]
 * @returns {Promise<Array>}
 */
export async function getCategorySettings(category, mode = null) {
  const resolvedMode = mode || (process.env.MODE || 'test').toLowerCase();
  const supabase = _getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('platform_settings')
    .select('setting_key, setting_value, is_sensitive, mode, updated_at')
    .eq('category', category)
    .eq('mode', resolvedMode)
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map((row) => ({
    setting_key: row.setting_key,
    setting_value: row.is_sensitive ? '••••••••' : row.setting_value,
    is_sensitive: row.is_sensitive,
    mode: row.mode,
    updated_at: row.updated_at,
  }));
}

/**
 * Upsert one or more settings for a category/mode in the DB.
 *
 * @param {string}  category
 * @param {string}  mode         'test' | 'live'
 * @param {object}  kvPairs      { KEY: 'value', ... }
 * @param {Set}     sensitiveKeys  Set of key names that should be encrypted
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveSettings(category, mode, kvPairs, sensitiveKeys = new Set()) {
  const supabase = _getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not available.' };

  const rows = Object.entries(kvPairs)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([key, value]) => {
      const sensitive = sensitiveKeys.has(key);
      return {
        category,
        setting_key: key,
        setting_value: sensitive ? encrypt(String(value)) : String(value),
        mode,
        is_active: true,
        is_sensitive: sensitive,
        updated_at: new Date().toISOString(),
      };
    });

  if (rows.length === 0) return { success: true };

  const { error } = await supabase
    .from('platform_settings')
    .upsert(rows, { onConflict: 'category,setting_key,mode' });

  if (error) return { success: false, error: error.message };

  // Invalidate cache for updated keys
  rows.forEach(({ setting_key }) => {
    _cache.delete(_cacheKey(setting_key, mode));
  });

  return { success: true };
}

/**
 * Invalidate all cached settings, forcing the next `getConfig` call
 * to re-fetch from the database.
 */
export function refreshConfig() {
  _cache.clear();
}

/**
 * Get the current active mode ('test' | 'live').
 * Checks DB global mode setting first, then process.env.MODE.
 *
 * @returns {Promise<string>}
 */
export async function getActiveMode() {
  const dbMode = await getConfig('MODE', 'general');
  const mode = (dbMode || process.env.MODE || 'test').toLowerCase();
  return mode === 'live' ? 'live' : 'test';
}
