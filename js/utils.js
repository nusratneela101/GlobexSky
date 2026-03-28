/**
 * js/utils.js — Shared utility helpers used across all GlobexSky JS modules.
 *
 * Depends on: js/config.js (GlobexCfg)
 *
 * Exposes: window.GlobexUtils
 */

(function (global) {
  'use strict';

  // ─── Auth token helpers ────────────────────────────────────────────────────

  function getToken() {
    try {
      var session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session && session.token) return session.token;
    } catch (_) { }
    return (
      localStorage.getItem('globexToken') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      null
    );
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('globexUser') || 'null');
    } catch (_) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    var user = getUser();
    return user && (user.role === 'admin' || user.role === 'super_admin');
  }

  function clearSession() {
    localStorage.removeItem('globexSession');
    localStorage.removeItem('globexUser');
    localStorage.removeItem('globexToken');
    localStorage.removeItem('token');
  }

  // ─── authFetch — fetch wrapper that auto-attaches Bearer token ────────────

  /**
   * Drop-in replacement for fetch() that automatically adds the Authorization
   * header when the user is logged in, and redirects to /login on 401.
   *
   * @param {string} url
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  function authFetch(url, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      options = Object.assign({}, options, { body: JSON.stringify(options.body), headers: headers });
    } else {
      options = Object.assign({}, options, { headers: headers });
    }

    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        clearSession();
        var loginUrl = '/pages/auth/login.html?redirect=' + encodeURIComponent(global.location.href);
        global.location.href = loginUrl;
      }
      return res;
    });
  }

  // ─── API helper ────────────────────────────────────────────────────────────

  /**
   * Make an authenticated API call.
   * @param {string} method  GET | POST | PUT | PATCH | DELETE
   * @param {string} path    Relative path, e.g. '/products'
   * @param {object} [data]  Body data for POST/PUT/PATCH
   * @returns {Promise<object>}  Parsed JSON response
   */
  function apiCall(method, path, data) {
    var baseUrl = (global.GlobexCfg && global.GlobexCfg.apiBaseUrl) || '/api/v1';
    var url = baseUrl + path;
    var options = {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
    };
    if (data !== undefined && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(data);
    }
    return authFetch(url, options).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          var msg = (body && (body.error || body.message)) || ('API Error ' + res.status);
          throw new Error(msg);
        });
      }
      return res.json();
    });
  }

  // ─── Formatting helpers ────────────────────────────────────────────────────

  function formatCurrency(amount, currency) {
    currency = currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch (_) {
      return currency + ' ' + (Number(amount) || 0).toFixed(2);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) {
      return dateStr;
    }
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type]
   * @param {number} [duration] ms
   */
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var colors = {
      success: '#059669',
      error:   '#ef4444',
      warning: '#f97316',
      info:    '#0052CC',
    };
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'padding:12px 20px',
      'background:' + (colors[type] || colors.info),
      'color:#fff',
      'border-radius:10px',
      'font-family:Inter,sans-serif',
      'font-size:.875rem',
      'font-weight:500',
      'z-index:99999',
      'box-shadow:0 4px 12px rgba(0,0,0,.2)',
      'transition:opacity .3s',
      'max-width:360px',
      'word-break:break-word',
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, duration);
  }

  /**
   * Show or hide an element.
   * @param {HTMLElement|string} el Element or CSS selector.
   * @param {boolean} visible
   */
  function setVisible(el, visible) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  /**
   * Set the text content of an element safely.
   * @param {HTMLElement|string} el
   * @param {string} text
   */
  function setText(el, text) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.textContent = text;
  }

  /**
   * Redirect to the login page, preserving current URL as redirect target.
   */
  function redirectToLogin() {
    global.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(global.location.href);
  }

  /**
   * Redirect to login if not authenticated.
   * @param {boolean} [adminRequired] Also check for admin role.
   */
  function requireAuth(adminRequired) {
    if (!isLoggedIn()) {
      redirectToLogin();
      return false;
    }
    if (adminRequired && !isAdmin()) {
      global.location.href = '/index.html';
      return false;
    }
    return true;
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexUtils = {
    getToken:        getToken,
    getUser:         getUser,
    isLoggedIn:      isLoggedIn,
    isAdmin:         isAdmin,
    clearSession:    clearSession,
    authFetch:       authFetch,
    apiCall:         apiCall,
    formatCurrency:  formatCurrency,
    formatDate:      formatDate,
    formatNumber:    formatNumber,
    showToast:       showToast,
    setVisible:      setVisible,
    setText:         setText,
    redirectToLogin: redirectToLogin,
    requireAuth:     requireAuth,
  };

}(typeof window !== 'undefined' ? window : this));
