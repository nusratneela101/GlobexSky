/**
 * js/config.js — Supabase + API configuration.
 *
 * Provides Supabase URL, anon key, a ready supabase client,
 * and the canonical API_BASE_URL for all backend requests.
 * All other JS modules should import from this module.
 *
 * Load via CDN before this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * Usage:
 *   GlobexCfg.ready().then(cfg => console.log(cfg.apiBaseUrl));
 *
 * Config shape:
 * {
 *   supabaseUrl     : string
 *   supabaseAnonKey : string
 *   apiBaseUrl      : string
 *   defaultCurrency : string  — "USD"
 *   defaultLanguage : string  — "en"
 * }
 */

(function (global) {
  'use strict';

  var SUPABASE_URL     = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

  // ─── Backend API base URL (auto-detect environment) ────────────────────────
  var API_BASE_URL = (function () {
    var h = (typeof window !== 'undefined') ? window.location.hostname : '';
    if (h === 'localhost' || h === '127.0.0.1') {
      return 'http://localhost:5000/api/v1';
    }
    return 'https://globexsky-production.up.railway.app/api/v1';
  })();

  var _config = {
    supabaseUrl:      SUPABASE_URL,
    supabaseAnonKey:  SUPABASE_ANON_KEY,
    apiBaseUrl:       API_BASE_URL,
    defaultCurrency:  'USD',
    defaultLanguage:  'en',
  };

  // Initialize Supabase client when library is available
  function _initClient() {
    if (global.supabase && global.supabase.createClient && !global.supabaseClient) {
      global.supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      _config.client = global.supabaseClient;
    }
    return _config.client || null;
  }

  _initClient();

  var GlobexCfg = {
    /**
     * Returns a Promise that resolves with the config object.
     */
    ready: function () {
      _initClient();
      return Promise.resolve(_config);
    },

    /**
     * Synchronous accessor.
     */
    get: function () {
      _initClient();
      return _config;
    },

    /** Supabase URL (available immediately). */
    supabaseUrl: SUPABASE_URL,

    /** Supabase anon key (available immediately). */
    supabaseAnonKey: SUPABASE_ANON_KEY,

    /** Backend API base URL (available immediately). */
    API_BASE_URL: API_BASE_URL,

    /** Get the Supabase client instance. */
    getClient: function () {
      return _initClient() || global.supabaseClient || null;
    },
  };

  global.GlobexCfg = GlobexCfg;

  // Also expose raw credentials for modules that need them directly
  global.SUPABASE_URL = SUPABASE_URL;
  global.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  global.API_BASE_URL = API_BASE_URL;

}(typeof window !== 'undefined' ? window : this));
