/**
 * Globex Sky — api-service.js
 * Thin, simple API service wrapper exposing global helper functions.
 *
 * This is intentionally lightweight — for advanced features such as token
 * refresh, retry logic, request interceptors, or domain-specific methods,
 * use api-client.js (window.ApiClient) instead.
 *
 * Exposes:
 *   window.ApiService  — object with all helpers (see bottom of file)
 *   window.apiGet      — shorthand for ApiService.get()
 *   window.apiPost     — shorthand for ApiService.post()
 *   window.apiPut      — shorthand for ApiService.put()
 *   window.apiDelete   — shorthand for ApiService.del()
 */

const ApiService = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIGURATION
  ───────────────────────────────────────────── */

  /** Resolve base URL from runtime config or fall back to /api/v1. */
  function _getBaseUrl() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL)
      ? window.GlobexConfig.API_BASE_URL
      : '/api/v1';
  }

  /**
   * Resolve current mode ('test' | 'live').
   * Reads from GlobexConfig first; falls back to 'test'.
   * A background fetch against /api/v1/config/public hydrates GlobexConfig
   * when available, so subsequent calls will return the live value.
   */
  function _getMode() {
    if (window.GlobexConfig && window.GlobexConfig.MODE) {
      return window.GlobexConfig.MODE;
    }
    if (window.GlobexConfig && window.GlobexConfig.mode) {
      return window.GlobexConfig.mode;
    }
    // Kick off a background fetch to hydrate GlobexConfig if it exposes getConfig()
    if (window.GlobexConfig && typeof window.GlobexConfig.getConfig === 'function') {
      window.GlobexConfig.getConfig().catch(function () { /* silent */ });
    }
    return 'test';
  }

  /* ─────────────────────────────────────────────
     TOKEN HELPERS
  ───────────────────────────────────────────── */

  /**
   * Read the JWT from localStorage.
   * Priority: globexSession.token → globexToken → token
   * This matches the storage strategy used by api-client.js.
   */
  function getAuthToken() {
    try {
      var session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session && session.token) return session.token;
    } catch (_) { /* ignore parse errors */ }

    var direct = localStorage.getItem('globexToken');
    if (direct) return direct;

    var generic = localStorage.getItem('token');
    if (generic) return generic;

    return null;
  }

  /** Returns true when a JWT is present in localStorage. */
  function isAuthenticated() {
    return getAuthToken() !== null;
  }

  /**
   * Redirect the browser to the login page, preserving the current URL
   * as a `redirect` query parameter so the user lands back here after login.
   */
  function redirectToLogin() {
    var redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/pages/auth/login.html?redirect=' + redirect;
  }

  /* ─────────────────────────────────────────────
     CORE FETCH WRAPPER
  ───────────────────────────────────────────── */

  /**
   * Internal fetch wrapper that:
   *   - Builds the full URL from BASE + path
   *   - Appends query-string params for GET requests
   *   - Attaches Authorization header when a token is present
   *   - Normalises responses to { success, data, message }
   *
   * @param {string} method   HTTP verb
   * @param {string} path     Path relative to API_BASE (e.g. '/products')
   * @param {object|null} body     JSON body (ignored for GET)
   * @param {object|null} params   Query-string key/value pairs (GET only)
   * @returns {Promise<{success: boolean, data: any, message: string}>}
   */
  function _request(method, path, body, params) {
    var base = _getBaseUrl();
    var url  = base + path;

    // Append query string for GET (or any caller that passes params)
    if (params && typeof params === 'object' && Object.keys(params).length) {
      url += '?' + new URLSearchParams(params).toString();
    }

    var headers = { 'Content-Type': 'application/json' };

    var token = getAuthToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var fetchOptions = { method: method, headers: headers };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    return fetch(url, fetchOptions)
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            // Normalise server error into the standard shape
            return {
              success: false,
              data: null,
              message: data.error || data.message || ('HTTP ' + res.status),
            };
          }
          // Server already returns { success, data, message } — pass through;
          // otherwise wrap bare payloads for consistency.
          if (Object.prototype.hasOwnProperty.call(data, 'success')) {
            return data;
          }
          return { success: true, data: data, message: '' };
        });
      })
      .catch(function (err) {
        return {
          success: false,
          data: null,
          message: err.message || 'Network error — please check your connection.',
        };
      });
  }

  /* ─────────────────────────────────────────────
     HTTP VERB METHODS
  ───────────────────────────────────────────── */

  /**
   * GET request.
   * @param {string} path
   * @param {object} [params]  Optional query-string parameters.
   */
  function get(path, params) {
    return _request('GET', path, null, params || null);
  }

  /**
   * POST request.
   * @param {string} path
   * @param {object} [body]  JSON body.
   */
  function post(path, body) {
    return _request('POST', path, body || null, null);
  }

  /**
   * PUT request.
   * @param {string} path
   * @param {object} [body]  JSON body.
   */
  function put(path, body) {
    return _request('PUT', path, body || null, null);
  }

  /**
   * DELETE request.
   * @param {string} path
   */
  function del(path) {
    return _request('DELETE', path, null, null);
  }

  /* ─────────────────────────────────────────────
     LOADING STATE HELPERS
  ───────────────────────────────────────────── */

  /**
   * Show a loading spinner / skeleton inside `elementId`.
   * If the element already has a `data-original-html` attribute the content
   * has already been replaced — skip to avoid nesting loaders.
   *
   * @param {string} elementId  ID of the container element (without #).
   */
  function showLoader(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (el.dataset.originalHtml !== undefined) return; // already loading
    el.dataset.originalHtml = el.innerHTML;
    el.innerHTML =
      '<div class="api-loader" role="status" aria-live="polite">' +
        '<span class="api-loader__spinner"></span>' +
        '<span class="api-loader__text">Loading…</span>' +
      '</div>';
  }

  /**
   * Remove the loading state injected by showLoader() and restore original
   * content (if any was saved).
   *
   * @param {string} elementId
   */
  function hideLoader(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (el.dataset.originalHtml !== undefined) {
      el.innerHTML = el.dataset.originalHtml;
      delete el.dataset.originalHtml;
    }
  }

  /** Alias kept for backwards-compat with callers using the page-level names. */
  function showPageLoader() {
    showLoader('page-loader') ||
    document.body.classList.add('page-loading');
  }

  function hidePageLoader() {
    hideLoader('page-loader');
    document.body.classList.remove('page-loading');
  }

  /* ─────────────────────────────────────────────
     UI FEEDBACK HELPERS
  ───────────────────────────────────────────── */

  /**
   * Render a user-friendly error message inside `elementId`.
   *
   * @param {string} elementId
   * @param {string} [message]  Human-readable error text.
   */
  function showError(elementId, message) {
    var el = document.getElementById(elementId);
    if (!el) return;
    // Clear any saved original HTML so hideLoader() won't re-inject a stale state
    delete el.dataset.originalHtml;
    el.innerHTML =
      '<div class="api-state api-state--error" role="alert">' +
        '<span class="api-state__icon" aria-hidden="true">⚠</span>' +
        '<p class="api-state__message">' +
          _escapeHtml(message || 'Something went wrong. Please try again.') +
        '</p>' +
      '</div>';
  }

  /**
   * Render an empty-state message inside `elementId`.
   *
   * @param {string} elementId
   * @param {string} [message]  Text to show when there is no data.
   */
  function showEmpty(elementId, message) {
    var el = document.getElementById(elementId);
    if (!el) return;
    delete el.dataset.originalHtml;
    el.innerHTML =
      '<div class="api-state api-state--empty" role="status">' +
        '<span class="api-state__icon" aria-hidden="true">📭</span>' +
        '<p class="api-state__message">' +
          _escapeHtml(message || 'No results found.') +
        '</p>' +
      '</div>';
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */

  /** Escape HTML special characters to prevent XSS in injected messages. */
  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    // HTTP methods
    get:  get,
    post: post,
    put:  put,
    del:  del,

    // Auth helpers
    isAuthenticated: isAuthenticated,
    getToken:        getAuthToken,
    redirectToLogin: redirectToLogin,

    // UI helpers
    showLoader:     showLoader,
    hideLoader:     hideLoader,
    showPageLoader: showPageLoader,
    hidePageLoader: hidePageLoader,
    showError:      showError,
    showEmpty:      showEmpty,

    // Misc
    getMode: _getMode,
  };
})();

/* ─────────────────────────────────────────────
   GLOBAL EXPORTS
───────────────────────────────────────────── */
window.ApiService = ApiService;

/** Convenience globals that delegate to ApiService. */
window.apiGet    = function (path, params) { return ApiService.get(path, params); };
window.apiPost   = function (path, body)   { return ApiService.post(path, body);  };
window.apiPut    = function (path, body)   { return ApiService.put(path, body);   };
window.apiDelete = function (path)         { return ApiService.del(path);          };
