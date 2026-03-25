/**
 * Globex Sky — config.js
 * Environment/API URL configuration. Detects dev vs. production automatically.
 */

const Config = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isDev = isLocalhost || hostname.includes('staging') || hostname.includes('dev');

  // Base API URL - auto-detect environment
  const API_BASE_URL = isLocalhost
    ? 'http://localhost:5000/api/v1'
    : 'https://globexsky-backend.up.railway.app/api/v1';

  return {
    // Core API
    API_BASE_URL,
    API_TIMEOUT: 30000,

    // Environment
    ENV: isDev ? 'development' : 'production',
    IS_DEV: isDev,
    IS_PRODUCTION: !isDev,
    DEBUG: isDev,

    // Supabase (frontend anon key only - safe for client)
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',

    // Cloudinary (public cloud name only)
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_UPLOAD_PRESET: 'globexsky_unsigned',

    // Stripe (publishable key only - safe for client)
    STRIPE_PUBLISHABLE_KEY: isLocalhost
      ? 'pk_test_your-test-key'
      : 'pk_live_your-live-key',

    // Agora (app ID only - safe for client)
    AGORA_APP_ID: 'your-agora-app-id',

    // Defaults
    DEFAULT_CURRENCY: 'USD',
    DEFAULT_LANGUAGE: 'en',
    DEFAULT_PAGE_SIZE: 20,
    MAX_UPLOAD_SIZE_MB: 10,

    // WebSocket
    WS_URL: isLocalhost
      ? 'ws://localhost:5000'
      : 'wss://globexsky-backend.up.railway.app',

    // Feature Flags
    FEATURES: {
      LIVE_STREAMING: true,
      AI_SEARCH: true,
      VR_SHOWROOM: true,
      VIDEO_MEETINGS: true,
      PUSH_NOTIFICATIONS: true,
      SOCIAL_AUTH: true,
    },

    // API Endpoints helper
    endpoints: {
      auth: `${API_BASE_URL}/auth`,
      products: `${API_BASE_URL}/products`,
      cart: `${API_BASE_URL}/cart`,
      orders: `${API_BASE_URL}/orders`,
      users: `${API_BASE_URL}/users`,
      payments: `${API_BASE_URL}/payments`,
      notifications: `${API_BASE_URL}/notifications`,
      chat: `${API_BASE_URL}/chat`,
      admin: `${API_BASE_URL}/admin`,
      analytics: `${API_BASE_URL}/analytics`,
      reviews: `${API_BASE_URL}/reviews`,
      suppliers: `${API_BASE_URL}/suppliers`,
      shipments: `${API_BASE_URL}/shipments`,
      wishlist: `${API_BASE_URL}/users/wishlist`,
      search: `${API_BASE_URL}/products/search`,
      rfq: `${API_BASE_URL}/rfq`,
      campaigns: `${API_BASE_URL}/campaigns`,
      livestreams: `${API_BASE_URL}/livestreams`,
      warehouses: `${API_BASE_URL}/warehouses`,
    },

    // Helper to check if backend is reachable
    async checkBackendHealth() {
      try {
        const res = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return { online: data.success === true, data };
      } catch (e) {
        return { online: false, error: e.message };
      }
    },
  };
})();

window.GlobexConfig = Config;

// Log config in dev mode
if (Config.IS_DEV) {
  console.log('[GlobexSky] Config loaded:', {
    env: Config.ENV,
    api: Config.API_BASE_URL,
    ws: Config.WS_URL,
  });
}
