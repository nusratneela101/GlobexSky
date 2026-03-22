/**
 * Globex Sky — api-client.js
 * Central API client with JWT management, token refresh, retry logic,
 * request/response interceptors, rate limiting, and error handling.
 */

const ApiClient = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIGURATION
  ───────────────────────────────────────────── */
  const BASE_URL = (() => {
    if (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) {
      return window.GlobexConfig.API_BASE_URL;
    }
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1')
      ? 'http://localhost:5000/api/v1'
      : 'https://globexsky-backend.up.railway.app/api/v1';
  })();

  const RETRY_ATTEMPTS   = 3;
  const RETRY_DELAY_MS   = 500;
  const RATE_LIMIT_WINDOW = 1000; // ms
  const RATE_LIMIT_MAX    = 30;   // requests per window

  /* ─────────────────────────────────────────────
     RATE LIMITER
  ───────────────────────────────────────────── */
  const _rateWindow = [];

  function _checkRateLimit() {
    const now = Date.now();
    while (_rateWindow.length && now - _rateWindow[0] > RATE_LIMIT_WINDOW) {
      _rateWindow.shift();
    }
    if (_rateWindow.length >= RATE_LIMIT_MAX) {
      throw Object.assign(new Error('Too many requests — please slow down'), { code: 'RATE_LIMITED' });
    }
    _rateWindow.push(now);
  }

  /* ─────────────────────────────────────────────
     REQUEST INTERCEPTORS
  ───────────────────────────────────────────── */
  const _requestInterceptors  = [];
  const _responseInterceptors = [];

  function addRequestInterceptor(fn)  { _requestInterceptors.push(fn);  }
  function addResponseInterceptor(fn) { _responseInterceptors.push(fn); }

  /* ─────────────────────────────────────────────
     TOKEN MANAGEMENT
  ───────────────────────────────────────────── */
  function _getTokens() {
    try {
      return JSON.parse(localStorage.getItem('globexSession') || 'null') || {};
    } catch (_) { return {}; }
  }

  function _saveTokens(tokens) {
    const existing = _getTokens();
    localStorage.setItem('globexSession', JSON.stringify({ ...existing, ...tokens }));
  }

  function getAccessToken()  { return _getTokens().token || null; }
  function getRefreshToken() { return _getTokens().refresh_token || null; }

  function _isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp && payload.exp * 1000 < Date.now() + 30_000; // 30 s buffer
    } catch (_) { return false; }
  }

  let _refreshPromise = null;

  async function _refreshAccessToken() {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error('Token refresh failed');

      const data = await res.json();
      _saveTokens({ token: data.token, refresh_token: data.refresh_token || refreshToken });
      return data.token;
    })().finally(() => { _refreshPromise = null; });

    return _refreshPromise;
  }

  function _clearSession() {
    localStorage.removeItem('globexSession');
    localStorage.removeItem('globexUser');
    if (window.GlobexSky && typeof window.GlobexSky.updateNavUI === 'function') {
      window.GlobexSky.updateNavUI();
    }
  }

  /* ─────────────────────────────────────────────
     CORE REQUEST
  ───────────────────────────────────────────── */
  async function _request(method, path, body = null, options = {}, attempt = 1) {
    _checkRateLimit();

    let config = {
      method,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal,
    };

    // Attach access token — refresh proactively if close to expiry
    let token = getAccessToken();
    if (token) {
      if (_isTokenExpired(token)) {
        try { token = await _refreshAccessToken(); } catch (_) { _clearSession(); }
      }
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Run request interceptors
    for (const fn of _requestInterceptors) {
      config = (await fn(config)) || config;
    }

    if (body && method !== 'GET') config.body = JSON.stringify(body);

    const url = `${BASE_URL}${path}`;

    let res;
    try {
      res = await fetch(url, config);
    } catch (networkErr) {
      // Retry on network errors (offline, DNS fail)
      if (attempt < RETRY_ATTEMPTS) {
        await _sleep(RETRY_DELAY_MS * attempt);
        return _request(method, path, body, options, attempt + 1);
      }
      throw Object.assign(networkErr, { code: 'NETWORK_ERROR' });
    }

    // Run response interceptors
    let data;
    try { data = await res.json(); } catch (_) { data = {}; }

    for (const fn of _responseInterceptors) {
      await fn(res, data);
    }

    if (res.status === 401) {
      // Try token refresh once
      const refreshToken = getRefreshToken();
      if (refreshToken && attempt === 1) {
        try {
          await _refreshAccessToken();
          return _request(method, path, body, options, 2);
        } catch (_) {
          _clearSession();
          const loginUrl = `/pages/auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
          if (!window.location.pathname.includes('/auth/')) {
            window.location.href = loginUrl;
          }
        }
      } else {
        _clearSession();
      }
    }

    if (res.status === 429 && attempt < RETRY_ATTEMPTS) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10) * 1000;
      await _sleep(retryAfter || RETRY_DELAY_MS * attempt);
      return _request(method, path, body, options, attempt + 1);
    }

    if (!res.ok) {
      throw Object.assign(
        new Error(data.error || data.message || `HTTP ${res.status}`),
        { status: res.status, data }
      );
    }

    return data;
  }

  async function _upload(path, formData, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = { ...options.headers };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'POST', headers, body: formData });
    let data;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Upload failed'), { status: res.status, data });
    return data;
  }

  function _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    get:    (path, options)       => _request('GET',    path, null, options),
    post:   (path, body, options) => _request('POST',   path, body, options),
    put:    (path, body, options) => _request('PUT',    path, body, options),
    patch:  (path, body, options) => _request('PATCH',  path, body, options),
    delete: (path, options)       => _request('DELETE', path, null, options),
    upload: _upload,

    addRequestInterceptor,
    addResponseInterceptor,
    getAccessToken,
    getRefreshToken,

    // ─── Auth ────────────────────────────────────────────────────
    auth: {
      login:         (email, password) => _request('POST', '/auth/login',            { email, password }),
      register:      (payload)         => _request('POST', '/auth/register',          payload),
      logout:        ()                => _request('POST', '/auth/logout'),
      forgotPassword:(email)           => _request('POST', '/auth/forgot-password',  { email }),
      resetPassword: (token, password) => _request('POST', '/auth/reset-password',   { token, password }),
      refresh:       (refresh_token)   => _request('POST', '/auth/refresh',           { refresh_token }),
      verify2FA:     (code, tempToken) => _request('POST', '/auth/2fa/verify',        { code, temp_token: tempToken }),
      me:            ()                => _request('GET',  '/auth/me'),
    },

    // ─── Products ───────────────────────────────────────────────
    products: {
      list:       (params = {}) => _request('GET', `/products?${new URLSearchParams(params)}`),
      search:     (q, params={})=> _request('GET', `/products/search?q=${encodeURIComponent(q)}&${new URLSearchParams(params)}`),
      get:        (id)          => _request('GET', `/products/${id}`),
      featured:   ()            => _request('GET', '/products/featured'),
      trending:   ()            => _request('GET', '/products/trending'),
      categories: ()            => _request('GET', '/products/categories'),
      reviews:    (id, params={})=> _request('GET', `/products/${id}/reviews?${new URLSearchParams(params)}`),
      suggest:    (q)           => _request('GET', `/products/suggest?q=${encodeURIComponent(q)}`),
    },

    // ─── Cart ───────────────────────────────────────────────────
    cart: {
      get:     ()     => _request('GET',   '/cart'),
      add:     (body) => _request('POST',  '/cart/items', body),
      update:  (id, body) => _request('PATCH', `/cart/items/${id}`, body),
      remove:  (id)   => _request('DELETE',`/cart/items/${id}`),
      clear:   ()     => _request('DELETE','/cart'),
      applyCoupon: (code) => _request('POST', '/cart/coupon', { code }),
    },

    // ─── Orders ─────────────────────────────────────────────────
    orders: {
      list:    (params = {}) => _request('GET',  `/orders?${new URLSearchParams(params)}`),
      get:     (id)          => _request('GET',  `/orders/${id}`),
      create:  (body)        => _request('POST', '/orders', body),
      cancel:  (id)          => _request('POST', `/orders/${id}/cancel`),
      track:   (id)          => _request('GET',  `/orders/${id}/tracking`),
    },

    // ─── User ───────────────────────────────────────────────────
    user: {
      getProfile:       ()     => _request('GET',   '/users/profile'),
      updateProfile:    (body) => _request('PUT',   '/users/profile', body),
      getAddresses:     ()     => _request('GET',   '/users/addresses'),
      addAddress:       (body) => _request('POST',  '/users/addresses', body),
      getNotifications: ()     => _request('GET',   '/notifications'),
      getUnreadCount:   ()     => _request('GET',   '/notifications/unread-count'),
      markAllRead:      ()     => _request('PATCH', '/notifications/mark-all-read'),
      getWishlist:      ()     => _request('GET',   '/users/wishlist'),
      addToWishlist:    (id)   => _request('POST',  '/users/wishlist', { product_id: id }),
      removeFromWishlist:(id)  => _request('DELETE',`/users/wishlist/${id}`),
    },

    // ─── Pricing ────────────────────────────────────────────────
    pricing: {
      shippingRates:       ()     => _request('GET',  '/pricing/shipping-rates'),
      supplierPlans:       ()     => _request('GET',  '/pricing/supplier-plans'),
      calculateShipping:   (body) => _request('POST', '/pricing/calculate/shipping', body),
      calculateCommission: (body) => _request('POST', '/pricing/calculate/commission', body),
    },

    // ─── Currency ───────────────────────────────────────────────
    currency: {
      rates: (base = 'USD') => _request('GET', `/currency/rates?base=${base}`),
    },

    // ─── Analytics ──────────────────────────────────────────────
    analytics: {
      dashboard: () => _request('GET', '/analytics/dashboard'),
      sales:     (params = {}) => _request('GET', `/analytics/sales?${new URLSearchParams(params)}`),
    },

    // ─── Admin ──────────────────────────────────────────────────
    admin: {
      stats:      ()           => _request('GET',  '/admin/stats'),
      orders:     (params={})  => _request('GET',  `/admin/orders?${new URLSearchParams(params)}`),
      users:      (params={})  => _request('GET',  `/admin/users?${new URLSearchParams(params)}`),
      products:   (params={})  => _request('GET',  `/admin/products?${new URLSearchParams(params)}`),
      exportCSV:  (resource)   => _request('GET',  `/admin/export/${resource}?format=csv`),
    },
  };
})();

window.ApiClient = ApiClient;
