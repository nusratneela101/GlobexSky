/**
 * Globex Sky — envManager.js
 * Reads APP_MODE from environment and returns the correct set of API keys.
 * Supports in-memory runtime override so the server doesn't need to restart
 * when the admin toggles between test and live mode.
 */

// In-memory override — starts as null (falls back to process.env.APP_MODE)
let _runtimeMode = null;

/**
 * Returns the current app mode: "test" or "live".
 * The in-memory override (set via setMode()) takes precedence over the env var.
 */
export const getMode = () => {
  const mode = _runtimeMode ?? process.env.APP_MODE ?? 'test';
  return mode === 'live' ? 'live' : 'test';
};

/**
 * Override the mode at runtime (does not restart the server).
 * @param {'test'|'live'} mode
 */
export const setMode = (mode) => {
  if (mode !== 'test' && mode !== 'live') {
    throw new Error('APP_MODE must be "test" or "live"');
  }
  _runtimeMode = mode;
};

/**
 * Returns the full environment config object based on the current mode.
 */
const getEnvConfig = () => {
  const mode = getMode();
  const isLive = mode === 'live';

  return {
    mode,
    isLive,
    supabase: {
      url: isLive ? process.env.LIVE_SUPABASE_URL : process.env.TEST_SUPABASE_URL,
      anonKey: isLive ? process.env.LIVE_SUPABASE_ANON_KEY : process.env.TEST_SUPABASE_ANON_KEY,
      serviceKey: isLive ? process.env.LIVE_SUPABASE_SERVICE_KEY : process.env.TEST_SUPABASE_SERVICE_KEY,
    },
    stripe: {
      publishableKey: isLive ? process.env.LIVE_STRIPE_PUBLISHABLE_KEY : process.env.TEST_STRIPE_PUBLISHABLE_KEY,
      secretKey: isLive ? process.env.LIVE_STRIPE_SECRET_KEY : process.env.TEST_STRIPE_SECRET_KEY,
      webhookSecret: isLive ? process.env.LIVE_STRIPE_WEBHOOK_SECRET : process.env.TEST_STRIPE_WEBHOOK_SECRET,
    },
    openai: {
      apiKey: isLive ? process.env.LIVE_OPENAI_API_KEY : process.env.TEST_OPENAI_API_KEY,
    },
    agora: {
      appId: isLive ? process.env.LIVE_AGORA_APP_ID : process.env.TEST_AGORA_APP_ID,
      appCertificate: isLive ? process.env.LIVE_AGORA_APP_CERTIFICATE : process.env.TEST_AGORA_APP_CERTIFICATE,
    },
    bkash: {
      appKey: isLive ? process.env.LIVE_BKASH_APP_KEY : process.env.TEST_BKASH_APP_KEY,
      appSecret: isLive ? process.env.LIVE_BKASH_APP_SECRET : process.env.TEST_BKASH_APP_SECRET,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  };
};

export default getEnvConfig;
