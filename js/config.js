/**
 * js/config.js — Frontend public config loader.
 *
 * Fetches non-sensitive runtime config from GET /api/v1/config/public on page
 * load, then caches the result in localStorage with a 10-minute TTL so that
 * subsequent page loads are instant.  All other JS modules that need Supabase
 * URL/keys, Stripe publishable key, mode (test/live), etc. should read from
 * this module instead of hard-coding values.
 *
 * Usage (plain <script> tag):
 *   GlobexCfg.ready().then(cfg => console.log(cfg.mode));
 *
 * The resolved config shape:
 * {
 *   apiBaseUrl          : string   — e.g. "http://localhost:5000/api/v1"
 *   supabaseUrl         : string | null
 *   supabaseAnonKey     : string | null
 *   stripePublishableKey: string | null
 *   agoraAppId          : string | null
 *   cloudinaryCloudName : string | null
 *   defaultCurrency     : string  — e.g. "USD"
 *   defaultLanguage     : string  — e.g. "en"
 *   mode                : "test" | "live"
 * }
 */

(function (global) {
  'use strict';

  // ─── API Base URL ──────────────────────────────────────────────────────────

  var hostname = global.location && global.location.hostname;
  var isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  var API_BASE_URL = isLocal
    ? 'http://localhost:5000/api/v1'
    : 'https://globexsky-backend.up.railway.app/api/v1';

  // Allow the environment variable or a window-level override to take precedence.
  if (global.GLOBEX_API_BASE) API_BASE_URL = global.GLOBEX_API_BASE;

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  var CACHE_KEY = 'gsky_pub_cfg';
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  function _readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || Date.now() - entry.ts > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return entry.data;
    } catch (_) {
      return null;
    }
  }

  function _writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_) { /* quota exceeded — ignore */ }
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  var _config = null;
  var _promise = null;

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  function _fetchConfig() {
    if (_promise) return _promise;

    _promise = fetch(API_BASE_URL + '/config/public')
      .then(function (res) {
        if (!res.ok) throw new Error('Config fetch failed: HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var d = (json && json.data) || {};
        _config = {
          apiBaseUrl:           API_BASE_URL,
          supabaseUrl:          d.supabaseUrl          || null,
          supabaseAnonKey:      d.supabaseAnonKey      || null,
          stripePublishableKey: d.stripePublishableKey || null,
          agoraAppId:           d.agoraAppId           || null,
          cloudinaryCloudName:  d.cloudinaryCloudName  || null,
          defaultCurrency:      d.defaultCurrency      || 'USD',
          defaultLanguage:      d.defaultLanguage      || 'en',
          mode:                 d.mode                 || 'test',
        };
        _writeCache(_config);
        return _config;
      })
      .catch(function (err) {
        console.warn('[GlobexCfg] Could not load public config:', err.message);
        // Return a safe fallback so pages can still function partially.
        _config = {
          apiBaseUrl:           API_BASE_URL,
          supabaseUrl:          null,
          supabaseAnonKey:      null,
          stripePublishableKey: null,
          agoraAppId:           null,
          cloudinaryCloudName:  null,
          defaultCurrency:      'USD',
          defaultLanguage:      'en',
          mode:                 'test',
        };
        return _config;
      });

    return _promise;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  var GlobexCfg = {
    /**
     * Returns a Promise that resolves with the config object.
     * Cached in localStorage for CACHE_TTL ms; safe to call on every page load.
     */
    ready: function () {
      var cached = _readCache();
      if (cached) {
        _config = cached;
        return Promise.resolve(cached);
      }
      if (_config) return Promise.resolve(_config);
      return _fetchConfig();
    },

    /**
     * Synchronous accessor — only valid AFTER ready() has resolved.
     * Returns null if the config has not been fetched yet.
     */
    get: function () {
      return _config;
    },

    /** The API base URL (available immediately, no async needed). */
    apiBaseUrl: API_BASE_URL,

    /** Invalidate the cache and force a re-fetch on next ready() call. */
    invalidate: function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (_) { }
      _config = null;
      _promise = null;
    },
  };

  // Expose globally
  global.GlobexCfg = GlobexCfg;

  // Start fetching immediately on script load so it's ready by DOMContentLoaded.
  GlobexCfg.ready();

}(typeof window !== 'undefined' ? window : this));
