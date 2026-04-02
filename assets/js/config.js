/**
 * Globex Sky — config.js
 * Frontend configuration: Supabase credentials + Backend API base URL.
 *
 * Provides Supabase URL, anon key, client initialization,
 * and the canonical API_BASE_URL used by all API modules.
 *
 * Load via CDN before this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

const SUPABASE_URL     = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

// ─── Backend API base URL (auto-detect environment) ──────────────────────────
const API_BASE_URL = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return 'http://localhost:5000/api/v1';
  }
  return 'https://globexsky-production.up.railway.app/api/v1';
})();

// Initialize Supabase client when library is available
function _initSupabaseClient() {
  if (window.supabase && window.supabase.createClient && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return window.supabaseClient || null;
}

const GlobexConfig = (() => {
  let _client = null;

  function getClient() {
    if (!_client) _client = _initSupabaseClient();
    return _client;
  }

  /**
   * Returns config object with Supabase credentials, API URL, and client.
   * @returns {Promise<object>}
   */
  async function getConfig() {
    return {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      API_BASE_URL,
      DEFAULT_CURRENCY: 'USD',
      DEFAULT_LANGUAGE: 'en',
      client: getClient(),
    };
  }

  return { getConfig, getClient, SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL };
})();

// Try to initialize immediately
_initSupabaseClient();

// Expose globally
window.GlobexConfig = GlobexConfig;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.API_BASE_URL = API_BASE_URL;

// GLOBEX_CONFIG — canonical config object accessible by all modules
window.GLOBEX_CONFIG = {
  API_BASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ENV: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'development' : 'production',
};
