/**
 * Globex Sky — csrf.js (frontend)
 * Fetches and caches the CSRF token, injects it into all state-changing fetch calls.
 */
(function(window) {
  'use strict';

  var _token = null;
  var _promise = null;
  var API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';

  /** Fetch or return cached CSRF token */
  function getToken() {
    if (_token) return Promise.resolve(_token);
    if (_promise) return _promise;
    _promise = fetch(API_BASE + '/csrf/token', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(j) {
        _token = j.data && j.data.token;
        _promise = null;
        return _token;
      })
      .catch(function() {
        _promise = null;
        return null;
      });
    return _promise;
  }

  /** Reset cached token (e.g. after a 403) */
  function resetToken() {
    _token = null;
    _promise = null;
  }

  /**
   * csrf.fetch(url, options) — like fetch() but adds CSRF token header.
   * Use for POST/PUT/PATCH/DELETE requests from forms.
   */
  function csrfFetch(url, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].indexOf(method) !== -1) {
      return fetch(url, options);
    }
    return getToken().then(function(token) {
      options.headers = options.headers || {};
      if (token) options.headers['X-CSRF-Token'] = token;
      options.credentials = options.credentials || 'include';
      return fetch(url, options).then(function(res) {
        if (res.status === 403) resetToken();
        return res;
      });
    });
  }

  window.GlobexCSRF = { getToken: getToken, fetch: csrfFetch, reset: resetToken };

})(window);
