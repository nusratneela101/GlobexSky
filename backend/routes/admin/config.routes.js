/**
 * backend/routes/admin/config.routes.js
 * Admin configuration management endpoints.
 *
 * All routes require admin authentication.
 *
 * GET  /api/v1/admin/config              — Get all config (admin view)
 * PUT  /api/v1/admin/config              — Update writable config values
 * PUT  /api/v1/admin/config/secrets      — Update secret API keys
 * POST /api/v1/admin/config/toggle-mode  — Toggle between test/live mode
 * POST /api/v1/admin/config/test-connection — Test current API key connections
 * GET  /api/v1/admin/config/health       — Health status of all services
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

  // ── Cloudinary ──────────────────────────────────────────────────────────────
  if (env.cloudinary.apiKey && env.cloudinary.apiSecret && env.cloudinary.cloudName) {
    try {
      const cloudinary = await import('cloudinary');
      const v2 = cloudinary.v2 || cloudinary.default?.v2 || cloudinary;
      v2.config({
        cloud_name: env.cloudinary.cloudName,
        api_key:    env.cloudinary.apiKey,
        api_secret: env.cloudinary.apiSecret,
      });
      await v2.api.ping();
      results.cloudinary = { ok: true, message: 'Connected successfully.' };
    } catch (err) {
      results.cloudinary = { ok: false, message: err.message };
    }
  } else {
    results.cloudinary = { ok: false, message: 'Cloudinary credentials not fully configured.' };
  }

  // ── SMTP ─────────────────────────────────────────────────────────────────────
  if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: Number(env.smtp.port) || 587,
        secure: Number(env.smtp.port) === 465,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        connectionTimeout: 8000,
      });
      await transporter.verify();
      results.smtp = { ok: true, message: 'SMTP connection verified.' };
    } catch (err) {
      results.smtp = { ok: false, message: err.message };
    }
  } else {
    results.smtp = { ok: false, message: 'SMTP credentials not fully configured.' };
  }

  // ── PayPal ───────────────────────────────────────────────────────────────────
  if (env.paypal.clientId && env.paypal.clientSecret) {
    try {
      const paypalBase = env.paypal.mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
      const credentials = Buffer.from(
        `${env.paypal.clientId}:${env.paypal.clientSecret}`
      ).toString('base64');
      const ppRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (ppRes.ok) {
        results.paypal = { ok: true, message: `Connected (${env.paypal.mode} mode).` };
      } else {
        const body = await ppRes.json().catch(() => ({}));
        results.paypal = { ok: false, message: body.error_description || `HTTP ${ppRes.status}` };
      }
    } catch (err) {
      results.paypal = { ok: false, message: err.message };
    }
  } else {
    results.paypal = { ok: false, message: 'PayPal credentials not configured.' };
  }

  // ── bKash ────────────────────────────────────────────────────────────────────
  if (env.bkash.appKey && env.bkash.appSecret && env.bkash.username && env.bkash.password) {
    try {
      const bkashBase = env.bkash.baseUrl || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
      const bkRes = await fetch(`${bkashBase}/tokenized/checkout/token/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: env.bkash.username,
          password: env.bkash.password,
        },
        body: JSON.stringify({
          app_key: env.bkash.appKey,
          app_secret: env.bkash.appSecret,
        }),
      });
      if (bkRes.ok) {
        results.bkash = { ok: true, message: 'Connected successfully.' };
      } else {
        const body = await bkRes.json().catch(() => ({}));
        results.bkash = { ok: false, message: body.statusMessage || `HTTP ${bkRes.status}` };
      }
    } catch (err) {
      results.bkash = { ok: false, message: err.message };
    }
  } else {
    results.bkash = { ok: false, message: 'bKash credentials not configured.' };
  }

  // ── Nagad ────────────────────────────────────────────────────────────────────
  if (env.nagad.merchantId && env.nagad.publicKey && env.nagad.privateKey) {
    try {
      // Nagad requires a signed request; we just verify the base URL is reachable.
      const nagadBase = env.nagad.baseUrl || 'https://sandbox.mynagad.com:10080';
      const ngRes = await fetch(`${nagadBase}/remote-payment-gateway-1.0/api/dfs/check-out/initialize/${env.nagad.merchantId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KM-Api-Version': 'v-0.2.0' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
      });
      // Any HTTP response (even 4xx) means the server is reachable.
      results.nagad = { ok: ngRes.status < 500, message: ngRes.status < 500 ? 'Nagad endpoint reachable.' : `HTTP ${ngRes.status}` };
    } catch (err) {
      results.nagad = { ok: false, message: err.message };
    }
  } else {
    results.nagad = { ok: false, message: 'Nagad credentials not configured.' };
  }

  res.json({
    success: true,
    mode: env.mode,
    results,
  });
});

// ─── PUT /secrets — Update secret API keys ────────────────────────────────────

/**
 * PUT /api/v1/admin/config/secrets
 * Update secret API keys stored in the .env file.
 * Only whitelisted secret keys are permitted to prevent arbitrary env manipulation.
 * Values must be non-empty strings.
 */
const SECRET_KEYS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_TEST_WEBHOOK_SECRET',
  'STRIPE_LIVE_WEBHOOK_SECRET',
  'STRIPE_TEST_PUBLISHABLE_KEY',
  'STRIPE_LIVE_PUBLISHABLE_KEY',
  'PAYPAL_TEST_CLIENT_ID',
  'PAYPAL_TEST_CLIENT_SECRET',
  'PAYPAL_LIVE_CLIENT_ID',
  'PAYPAL_LIVE_CLIENT_SECRET',
  'BKASH_TEST_APP_KEY',
  'BKASH_TEST_APP_SECRET',
  'BKASH_TEST_USERNAME',
  'BKASH_TEST_PASSWORD',
  'BKASH_LIVE_APP_KEY',
  'BKASH_LIVE_APP_SECRET',
  'BKASH_LIVE_USERNAME',
  'BKASH_LIVE_PASSWORD',
  'NAGAD_TEST_MERCHANT_ID',
  'NAGAD_TEST_PUBLIC_KEY',
  'NAGAD_TEST_PRIVATE_KEY',
  'NAGAD_LIVE_MERCHANT_ID',
  'NAGAD_LIVE_PUBLIC_KEY',
  'NAGAD_LIVE_PRIVATE_KEY',
  'OPENAI_API_KEY',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'SMTP_PASS',
  'SMTP_USER',
  'SMTP_HOST',
  'SMTP_PORT',
  'EMAIL_FROM',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'AGORA_APP_ID',
  'AGORA_APP_CERTIFICATE',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'SUPABASE_URL',
]);

router.put(
  '/secrets',
  [body().isObject().withMessage('Request body must be a JSON object')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ success: false, errors: errors.array() });
      }

      const updates = req.body;

      // Reject any keys that are not in the whitelist
      const rejected = Object.keys(updates).filter((k) => !SECRET_KEYS.has(k));
      if (rejected.length > 0) {
        return res.status(400).json({
          success: false,
          error: `The following keys are not allowed: ${rejected.join(', ')}.`,
        });
      }

      // Validate values — must be non-empty strings
      const entriesWithBlankValues = Object.entries(updates).filter(([, v]) => v === '' || v === null || v === undefined);
      if (entriesWithBlankValues.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Values must not be empty. Blank keys: ${entriesWithBlankValues.map(([k]) => k).join(', ')}.`,
        });
      }

      let content = await readEnvFile();
      for (const [key, value] of Object.entries(updates)) {
        content = setEnvKey(content, key, String(value));
        process.env[key] = String(value);
      }
      await writeFile(ENV_FILE_PATH, content, 'utf8');

      res.json({
        success: true,
        message: 'Secret keys updated. Restart the server to fully apply the new values.',
        updated: Object.keys(updates),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /health — Health status of all services ──────────────────────────────

/**
 * GET /api/v1/admin/config/health
 * Returns a lightweight health summary for all configured services.
 * Unlike test-connection, this does NOT make live API calls — it simply
 * reports whether the credentials are present/absent and what the current
 * mode is, so the dashboard can display the state quickly.
 */
router.get('/health', (_req, res) => {
  const mode = (process.env.MODE || env.mode || 'test').toLowerCase();

  const present = (val) => !!(val && val.trim && val.trim());
  const masked  = (val) => (present(val) ? '••••••••' : null);

  res.json({
    success: true,
    mode,
    services: {
      supabase: {
        configured: present(env.supabase.url) && present(env.supabase.serviceRoleKey),
        url:        env.supabase.url || null,
        anonKey:    masked(env.supabase.anonKey),
        serviceKey: masked(env.supabase.serviceRoleKey),
      },
      stripe: {
        configured:      present(env.stripe.secretKey),
        publishableKey:  env.stripe.publishableKey || null,
        secretKey:       masked(env.stripe.secretKey),
        webhookSecret:   masked(env.stripe.webhookSecret),
        mode,
      },
      paypal: {
        configured: present(env.paypal.clientId) && present(env.paypal.clientSecret),
        clientId:   env.paypal.clientId || null,
        mode:       env.paypal.mode || mode,
      },
      bkash: {
        configured: present(env.bkash.appKey) && present(env.bkash.appSecret),
        username:   env.bkash.username || null,
        baseUrl:    env.bkash.baseUrl  || null,
      },
      nagad: {
        configured: present(env.nagad.merchantId) && present(env.nagad.privateKey),
        merchantId: env.nagad.merchantId || null,
        baseUrl:    env.nagad.baseUrl    || null,
      },
      openai: {
        configured: present(env.openai.apiKey),
        apiKey:     masked(env.openai.apiKey),
      },
      cloudinary: {
        configured: present(env.cloudinary.cloudName) && present(env.cloudinary.apiKey),
        cloudName:  env.cloudinary.cloudName || null,
        apiKey:     masked(env.cloudinary.apiKey),
      },
      smtp: {
        configured: present(env.smtp.host) && present(env.smtp.user) && present(env.smtp.pass),
        host:       env.smtp.host || null,
        port:       env.smtp.port || null,
        user:       env.smtp.user || null,
        from:       env.smtp.from || null,
      },
      google: {
        configured: present(env.google.clientId) && present(env.google.clientSecret),
        clientId:   env.google.clientId || null,
      },
      facebook: {
        configured: present(env.facebook.appId) && present(env.facebook.appSecret),
        appId:      env.facebook.appId || null,
      },
    },
  });
});

export default router;
