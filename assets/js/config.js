/**
 * Globex Sky — config.js
 * Environment/API URL configuration.
 *
 * - Detects dev vs. production automatically from window.location.
 * - Public runtime config (Supabase URL/anon key, etc.) is fetched from the
 *   backend at /api/v1/config/public so that no secrets are hardcoded here.
 * - Call `GlobexConfig.getConfig()` once on page load to hydrate the config.
 */

const GlobexConfig = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  const API_BASE_URL = isLocalhost
    ? 'http://localhost:5000/api/v1'
    : 'https://globexsky-backend.up.railway.app/api/v1';

  // Mutable runtime config populated by getConfig().
  let _config = {
    API_BASE_URL,
    SUPABASE_URL: null,
    SUPABASE_ANON_KEY: null,
    CLOUDINARY_CLOUD_NAME: null,
    DEFAULT_CURRENCY: 'USD',
    DEFAULT_LANGUAGE: 'en',
    MODE: 'test',
  };

  /**
   * Fetch public (non-sensitive) configuration from the backend.
   * Safe to call multiple times — subsequent calls return the cached value.
   *
   * @returns {Promise<object>} Resolved config object.
   */
  async function getConfig() {
    // Return cached config if already fetched.
    if (_config.SUPABASE_URL) return _config;

    try {
      const response = await fetch(`${API_BASE_URL}/config/public`);
      if (!response.ok) {
        throw new Error(`Config endpoint returned ${response.status}`);
      }
      const { data } = await response.json();

      _config = {
        ..._config,
        SUPABASE_URL: data.supabaseUrl || null,
        SUPABASE_ANON_KEY: data.supabaseAnonKey || null,
        CLOUDINARY_CLOUD_NAME: data.cloudinaryCloudName || null,
        DEFAULT_CURRENCY: data.defaultCurrency || 'USD',
        DEFAULT_LANGUAGE: data.defaultLanguage || 'en',
        MODE: data.mode || 'test',
      };
    } catch (err) {
      console.warn('[GlobexConfig] Failed to load public config from backend:', err.message);
    }

    return _config;
  }

  return {
    /** Backend API base URL (auto-detected). */
    get API_BASE_URL() { return _config.API_BASE_URL; },

    /** Returns current Supabase URL (null until getConfig() resolves). */
    get SUPABASE_URL() { return _config.SUPABASE_URL; },

    /** Returns current Supabase anon key (null until getConfig() resolves). */
    get SUPABASE_ANON_KEY() { return _config.SUPABASE_ANON_KEY; },

    /** Returns Cloudinary cloud name (null until getConfig() resolves). */
    get CLOUDINARY_CLOUD_NAME() { return _config.CLOUDINARY_CLOUD_NAME; },

    /** Default currency code. */
    get DEFAULT_CURRENCY() { return _config.DEFAULT_CURRENCY; },

    /** Default language code. */
    get DEFAULT_LANGUAGE() { return _config.DEFAULT_LANGUAGE; },

    /** Current API mode: "test" | "live". */
    get MODE() { return _config.MODE; },

    /**
     * Fetch public config from the backend and hydrate this object.
     * @returns {Promise<object>}
     */
    getConfig,
  };
})();

window.GlobexConfig = GlobexConfig;
