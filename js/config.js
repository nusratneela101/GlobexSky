/**
 * js/config.js — Supabase configuration.
 *
 * Provides Supabase URL, anon key, and a ready supabase client.
 * All other JS modules should import from this module.
 *
 * Load via CDN before this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * Usage:
 *   GlobexCfg.ready().then(cfg => console.log(cfg.supabaseUrl));
 *
 * Config shape:
 * {
 *   supabaseUrl     : string
 *   supabaseAnonKey : string
 *   defaultCurrency : string  — "USD"
 *   defaultLanguage : string  — "en"
 * }
 */

(function (global) {
  'use strict';

  var SUPABASE_URL     = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

  var _config = {
    supabaseUrl:      SUPABASE_URL,
    supabaseAnonKey:  SUPABASE_ANON_KEY,
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

    /** Get the Supabase client instance. */
    getClient: function () {
      return _initClient() || global.supabaseClient || null;
    },
  };

  global.GlobexCfg = GlobexCfg;

  // Also expose raw credentials for modules that need them directly
  global.SUPABASE_URL = SUPABASE_URL;
  global.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

}(typeof window !== 'undefined' ? window : this));
