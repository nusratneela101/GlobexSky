/**
 * backend/config/env.js
 * Environment configuration loader.
 *
 * - Loads variables from .env via dotenv (already done by `import 'dotenv/config'`
 *   in server.js, but calling config() here too ensures standalone imports work).
 * - Validates all required environment variables are present.
 * - Exports a single `env` config object.
 * - Throws clear errors if critical env vars are missing.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from backend directory (safe to call multiple times; dotenv skips
// already-set variables unless { override: true } is passed).
config({ path: resolve(__dirname, '../.env') });

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Asserts that each variable name in `keys` is set in process.env.
 * Throws with a clear message listing every missing variable.
 * @param {string[]} keys
 */
function requireVars(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Copy backend/.env.example to backend/.env and fill in the values.',
    );
  }
}

// ─── Required variables ───────────────────────────────────────────────────────
requireVars([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
]);

// ─── Mode resolution ──────────────────────────────────────────────────────────
const rawMode = (process.env.MODE || 'test').toLowerCase();
const MODE = rawMode === 'live' ? 'live' : 'test';
const isLive = MODE === 'live';

// ─── Payment key selectors ────────────────────────────────────────────────────
// Returns the TEST or LIVE variant of the requested key based on current MODE.
const stripe = {
  secretKey: isLive
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY,
  publishableKey: isLive
    ? process.env.STRIPE_LIVE_PUBLISHABLE_KEY
    : process.env.STRIPE_TEST_PUBLISHABLE_KEY,
  webhookSecret: isLive
    ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
    : process.env.STRIPE_TEST_WEBHOOK_SECRET,
};

const paypal = {
  clientId: isLive
    ? process.env.PAYPAL_LIVE_CLIENT_ID
    : process.env.PAYPAL_TEST_CLIENT_ID,
  clientSecret: isLive
    ? process.env.PAYPAL_LIVE_CLIENT_SECRET
    : process.env.PAYPAL_TEST_CLIENT_SECRET,
  mode: MODE,
};

const bkash = {
  appKey: isLive
    ? process.env.BKASH_LIVE_APP_KEY
    : process.env.BKASH_TEST_APP_KEY,
  appSecret: isLive
    ? process.env.BKASH_LIVE_APP_SECRET
    : process.env.BKASH_TEST_APP_SECRET,
  username: isLive
    ? process.env.BKASH_LIVE_USERNAME
    : process.env.BKASH_TEST_USERNAME,
  password: isLive
    ? process.env.BKASH_LIVE_PASSWORD
    : process.env.BKASH_TEST_PASSWORD,
  baseUrl: isLive
    ? process.env.BKASH_LIVE_BASE_URL
    : process.env.BKASH_TEST_BASE_URL,
};

const nagad = {
  merchantId: isLive
    ? process.env.NAGAD_LIVE_MERCHANT_ID
    : process.env.NAGAD_TEST_MERCHANT_ID,
  publicKey: isLive
    ? process.env.NAGAD_LIVE_PUBLIC_KEY
    : process.env.NAGAD_TEST_PUBLIC_KEY,
  privateKey: isLive
    ? process.env.NAGAD_LIVE_PRIVATE_KEY
    : process.env.NAGAD_TEST_PRIVATE_KEY,
  baseUrl: isLive
    ? process.env.NAGAD_LIVE_BASE_URL
    : process.env.NAGAD_TEST_BASE_URL,
};

// ─── Exported config object ───────────────────────────────────────────────────

/**
 * Clean configuration object derived from environment variables.
 * Import this instead of accessing `process.env` directly.
 */
const env = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Current API mode: "test" | "live" */
  mode: MODE,

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  },

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // Email / SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'info@globexsky.com',
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'https://globexsky.com',
  frontendUrlWww: process.env.FRONTEND_URL_WWW || 'https://www.globexsky.com',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Payment gateways (MODE-aware)
  stripe,
  paypal,
  bkash,
  nagad,

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Agora
  agora: {
    appId: process.env.AGORA_APP_ID,
    appCertificate: process.env.AGORA_APP_CERTIFICATE,
  },

  // SMS (Twilio)
  twilio: {
    sid: process.env.TWILIO_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phone: process.env.TWILIO_PHONE,
  },

  // Currency API
  exchangeRate: {
    apiKey: process.env.EXCHANGE_RATE_API_KEY,
  },

  // Web Push / VAPID
  vapid: {
    email: process.env.VAPID_EMAIL || 'admin@globexsky.com',
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },

  // Social OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },

  // Company
  company: {
    name: process.env.COMPANY_NAME || 'Globex International Trade Co., Ltd.',
    nameCn: process.env.COMPANY_NAME_CN,
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL || 'info@globexsky.com',
  },
};

export default env;
