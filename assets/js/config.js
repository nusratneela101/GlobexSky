/**
 * Globex Sky — config.js
 * Environment/API URL configuration. Detects dev vs. production automatically.
 * Fetches live public keys (Supabase URL, anon key, Stripe publishable key,
 * Agora app ID) from the backend on page load, with a hardcoded fallback if
 * the backend is unreachable.
 */

const Config = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  const API_BASE_URL = isLocalhost
    ? 'http://localhost:5000/api/v1'
    : 'https://globexsky-backend.up.railway.app/api/v1';

  // Hardcoded fallback defaults (used when backend is unreachable)
  const defaults = {
    API_BASE_URL,
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',
    STRIPE_PUBLISHABLE_KEY: '',
    AGORA_APP_ID: '',
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    APP_MODE: 'test',
    DEFAULT_CURRENCY: 'USD',
    DEFAULT_LANGUAGE: 'en',
  };

  // Merge remote config over defaults
  const applyRemoteConfig = (remote) => {
    if (remote.supabase?.url)          window.GlobexConfig.SUPABASE_URL          = remote.supabase.url;
    if (remote.supabase?.anonKey)      window.GlobexConfig.SUPABASE_ANON_KEY     = remote.supabase.anonKey;
    if (remote.stripe?.publishableKey) window.GlobexConfig.STRIPE_PUBLISHABLE_KEY = remote.stripe.publishableKey;
    if (remote.agora?.appId)           window.GlobexConfig.AGORA_APP_ID          = remote.agora.appId;
    if (remote.cloudinary?.cloudName)  window.GlobexConfig.CLOUDINARY_CLOUD_NAME = remote.cloudinary.cloudName;
    if (remote.mode)                   window.GlobexConfig.APP_MODE              = remote.mode;
  };

  /**
   * Fetch public config from backend and update GlobexConfig in-place.
   * Results are cached in sessionStorage for the duration of the browser session.
   */
  const loadRemoteConfig = async () => {
    const CACHE_KEY = 'globex_public_config';
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        applyRemoteConfig(JSON.parse(cached));
        return;
      }

      const res = await fetch(`${API_BASE_URL}/config/public`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(json.data));
        applyRemoteConfig(json.data);
      }
    } catch (_err) {
      // Backend unreachable — silently keep hardcoded fallback values
    }
  };

  // Start fetching immediately (non-blocking)
  loadRemoteConfig();

  return defaults;
})();

window.GlobexConfig = Config;
