/**
 * Globex Sky — config.js
 * Supabase configuration for the frontend.
 *
 * Provides Supabase URL, anon key, and client initialization.
 * Load via CDN before this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

const SUPABASE_URL     = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

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
   * Returns config object with Supabase credentials and client.
   * @returns {Promise<object>}
   */
  async function getConfig() {
    return {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      DEFAULT_CURRENCY: 'USD',
      DEFAULT_LANGUAGE: 'en',
      client: getClient(),
    };
  }

  return { getConfig, getClient, SUPABASE_URL, SUPABASE_ANON_KEY };
})();

// Try to initialize immediately
_initSupabaseClient();

// Expose globally
window.GlobexConfig = GlobexConfig;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
