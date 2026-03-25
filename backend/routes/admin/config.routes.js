/**
 * backend/routes/admin/config.routes.js
 * Admin configuration management endpoints.
 *
 * All routes require admin authentication.
 *
 * GET  /api/v1/admin/config              — Get all config (admin view)
 * PUT  /api/v1/admin/config              — Update writable config values
 * POST /api/v1/admin/config/toggle-mode  — Toggle between test/live mode
 * POST /api/v1/admin/config/test-connection — Test current API key connections
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { writeFile, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roleCheck.js';
import env from '../../config/env.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_FILE_PATH = resolve(__dirname, '../../.env');

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the current .env file content.
 * Returns an empty string if the file does not exist.
 */
async function readEnvFile() {
  try {
    return await readFile(ENV_FILE_PATH, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Update a single key in the .env file content string.
 * If the key exists it is updated in place; otherwise it is appended.
 *
 * @param {string} content  Current .env file content.
 * @param {string} key      Variable name (e.g. "MODE").
 * @param {string} value    New value.
 * @returns {string}        Updated .env file content.
 */
function setEnvKey(content, key, value) {
  // Only allow env var names (uppercase letters, digits, underscores) to prevent
  // regex injection via the key parameter.
  if (!/^[A-Z0-9_]+$/.test(key)) {
    throw new Error(`Invalid environment variable name: ${key}`);
  }
  const regex = new RegExp(`^(${key}=.*)$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    return content.replace(regex, line);
  }
  return content ? `${content}\n${line}` : line;
}

// ─── GET /  — Return all config (admin view) ─────────────────────────────────

/**
 * GET /api/v1/admin/config
 * Returns all configuration values visible to admins.
 * Secret keys are masked — only their presence is indicated.
 */
router.get('/', (_req, res) => {
  const mask = (val) => (val ? '••••••••' : null);

  res.json({
    success: true,
    data: {
      server: {
        port: env.port,
        nodeEnv: env.nodeEnv,
        mode: env.mode,
      },
      supabase: {
        url: env.supabase.url,
        anonKey: env.supabase.anonKey,          // public key — safe to show
        serviceRoleKey: mask(env.supabase.serviceRoleKey),
        jwtSecret: mask(env.supabase.jwtSecret),
      },
      cloudinary: {
        cloudName: env.cloudinary.cloudName,
        apiKey: mask(env.cloudinary.apiKey),
        apiSecret: mask(env.cloudinary.apiSecret),
      },
      smtp: {
        host: env.smtp.host,
        port: env.smtp.port,
        user: env.smtp.user,
        pass: mask(env.smtp.pass),
        from: env.smtp.from,
      },
      jwt: {
        secret: mask(env.jwt.secret),
        expiresIn: env.jwt.expiresIn,
        refreshSecret: mask(env.jwt.refreshSecret),
        refreshExpiresIn: env.jwt.refreshExpiresIn,
      },
      stripe: {
        secretKey: mask(env.stripe.secretKey),
        publishableKey: env.stripe.publishableKey,
        webhookSecret: mask(env.stripe.webhookSecret),
      },
      paypal: {
        clientId: env.paypal.clientId,
        clientSecret: mask(env.paypal.clientSecret),
        mode: env.paypal.mode,
      },
      bkash: {
        appKey: mask(env.bkash.appKey),
        appSecret: mask(env.bkash.appSecret),
        username: env.bkash.username,
        password: mask(env.bkash.password),
        baseUrl: env.bkash.baseUrl,
      },
      nagad: {
        merchantId: env.nagad.merchantId,
        publicKey: env.nagad.publicKey,
        privateKey: mask(env.nagad.privateKey),
        baseUrl: env.nagad.baseUrl,
      },
      openai: {
        apiKey: mask(env.openai.apiKey),
      },
      agora: {
        appId: env.agora.appId,
        appCertificate: mask(env.agora.appCertificate),
      },
      twilio: {
        sid: env.twilio.sid,
        authToken: mask(env.twilio.authToken),
        phone: env.twilio.phone,
      },
      vapid: {
        email: env.vapid.email,
        publicKey: env.vapid.publicKey,
        privateKey: mask(env.vapid.privateKey),
      },
      google: {
        clientId: env.google.clientId,
        clientSecret: mask(env.google.clientSecret),
      },
      facebook: {
        appId: env.facebook.appId,
        appSecret: mask(env.facebook.appSecret),
      },
    },
  });
});

// ─── PUT /  — Update config values ───────────────────────────────────────────

/**
 * PUT /api/v1/admin/config
 * Update one or more writable config values in the .env file.
 * Only whitelisted, non-critical keys may be updated via this endpoint.
 * Secret keys cannot be changed here to prevent accidental exposure in logs.
 */
const WRITABLE_KEYS = new Set([
  'MODE',
  'DEFAULT_CURRENCY',
  'DEFAULT_LANGUAGE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'EMAIL_FROM',
  'FRONTEND_URL',
  'FRONTEND_URL_WWW',
  'COMPANY_NAME',
  'COMPANY_PHONE',
  'COMPANY_EMAIL',
  'VAPID_EMAIL',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
]);

router.put(
  '/',
  [body().isObject().withMessage('Request body must be a JSON object')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ success: false, errors: errors.array() });
      }

      const updates = req.body;
      const rejected = Object.keys(updates).filter((k) => !WRITABLE_KEYS.has(k));
      if (rejected.length > 0) {
        return res.status(400).json({
          success: false,
          error: `The following keys are not writable via this endpoint: ${rejected.join(', ')}.`,
        });
      }

      // Validate MODE value if provided
      if (updates.MODE !== undefined && !['test', 'live'].includes(updates.MODE)) {
        return res.status(400).json({
          success: false,
          error: 'MODE must be "test" or "live".',
        });
      }

      let content = await readEnvFile();
      for (const [key, value] of Object.entries(updates)) {
        content = setEnvKey(content, key, String(value));
        // Also apply to current process so the running server reflects the change.
        process.env[key] = String(value);
      }
      await writeFile(ENV_FILE_PATH, content, 'utf8');

      res.json({
        success: true,
        message: 'Configuration updated. Restart the server to apply all changes.',
        updated: Object.keys(updates),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /toggle-mode — Toggle test/live mode ────────────────────────────────

/**
 * POST /api/v1/admin/config/toggle-mode
 * Toggle the API mode between "test" and "live".
 * The new mode is persisted to the .env file.
 */
router.post('/toggle-mode', async (req, res, next) => {
  try {
    // Read directly from process.env so we see the most recent value even if
    // toggle-mode was called before on this running process without a restart.
    const currentMode = (process.env.MODE || env.mode || 'test').toLowerCase();
    const newMode = currentMode === 'live' ? 'test' : 'live';

    let content = await readEnvFile();
    content = setEnvKey(content, 'MODE', newMode);
    await writeFile(ENV_FILE_PATH, content, 'utf8');

    // Apply immediately to running process
    process.env.MODE = newMode;

    res.json({
      success: true,
      message: `API mode switched to "${newMode}". Restart the server to fully apply all MODE-dependent keys.`,
      previousMode: currentMode,
      currentMode: newMode,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /test-connection — Test current API key connections ─────────────────

/**
 * POST /api/v1/admin/config/test-connection
 * Tests whether the currently configured API keys can successfully connect
 * to their respective services.
 *
 * Returns an object with a result per service: { ok: boolean, message: string }
 */
router.post('/test-connection', async (_req, res, next) => {
  const results = {};

  // ── Supabase ────────────────────────────────────────────────────────────────
  // Uses the 'profiles' table which is created by the default GlobexSky schema.
  // If that table doesn't exist yet, the error message will still confirm whether
  // the credentials are valid (auth error vs. table-not-found error).
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
    results.supabase = error
      ? { ok: false, message: error.message }
      : { ok: true, message: 'Connected successfully.' };
  } catch (err) {
    results.supabase = { ok: false, message: err.message };
  }

  // ── Stripe ──────────────────────────────────────────────────────────────────
  if (env.stripe.secretKey) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(env.stripe.secretKey, { apiVersion: '2023-10-16' });
      await stripe.balance.retrieve();
      results.stripe = { ok: true, message: `Connected (${env.mode} mode).` };
    } catch (err) {
      results.stripe = { ok: false, message: err.message };
    }
  } else {
    results.stripe = { ok: false, message: 'No Stripe secret key configured.' };
  }

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  if (env.openai.apiKey) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: env.openai.apiKey });
      await openai.models.list();
      results.openai = { ok: true, message: 'Connected successfully.' };
    } catch (err) {
      results.openai = { ok: false, message: err.message };
    }
  } else {
    results.openai = { ok: false, message: 'No OpenAI API key configured.' };
  }

  res.json({
    success: true,
    mode: env.mode,
    results,
  });
});

export default router;
