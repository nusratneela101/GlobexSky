/**
 * js/utils.js — Shared utility helpers for GlobexSky.
 *
 * Depends on:
 *   - Supabase CDN: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   - js/supabase.js (window.supabaseClient)
 *
 * Exposes: window.GlobexUtils
 */

(function (global) {
  'use strict';

  function _client() {
    return global.supabaseClient || null;
  }

  // ─── Auth helpers (Supabase-backed) ───────────────────────────────────────

  /**
   * Get the current Supabase user synchronously by checking localStorage.
   * Returns null if not logged in.
   * @returns {object|null}
   */
  function getUser() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('sb-') && keys[i].endsWith('-auth-token')) {
          var sess = JSON.parse(localStorage.getItem(keys[i]) || 'null');
          if (sess && sess.user) return sess.user;
        }
      }
    } catch (_) { }
    return null;
  }

  /**
   * Get the current access token from Supabase localStorage session.
   * @returns {string|null}
   */
  function getToken() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('sb-') && keys[i].endsWith('-auth-token')) {
          var sess = JSON.parse(localStorage.getItem(keys[i]) || 'null');
          if (sess && sess.access_token) return sess.access_token;
        }
      }
    } catch (_) { }
    return null;
  }

  /**
   * Check if user is logged in (synchronous).
   * @returns {boolean}
   */
  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * Check if the current user has admin role.
   * @returns {boolean}
   */
  function isAdmin() {
    var user = getUser();
    if (!user) return false;
    var meta = user.user_metadata || {};
    return meta.role === 'admin' || meta.role === 'super_admin';
  }

  /**
   * Clear Supabase session from localStorage.
   */
  function clearSession() {
    try {
      var keys = Object.keys(localStorage);
      keys.forEach(function (k) {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
    } catch (_) { }
  }

  // ─── Redirect helpers ──────────────────────────────────────────────────────

  function redirectToLogin() {
    global.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(global.location.href);
  }

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

  // ─── Supabase fetch helper ─────────────────────────────────────────────────

  /**
   * Authenticated fetch with Supabase token.
   * @param {string} url
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  function authFetch(url, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    options = Object.assign({}, options, { headers: headers });
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        clearSession();
        redirectToLogin();
      }
      return res;
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

  function showLoading(el, text) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:40px">' +
      '<i class="fas fa-spinner fa-spin fa-2x" style="color:#0052CC"></i>' +
      (text ? '<p style="margin-top:12px;color:#64748b">' + text + '</p>' : '') +
      '</div>';
  }

  function hideLoading(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.innerHTML = '';
  }

  function setVisible(el, visible) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  function setText(el, text) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.textContent = text;
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexUtils = {
    getUser:         getUser,
    getToken:        getToken,
    isLoggedIn:      isLoggedIn,
    isAdmin:         isAdmin,
    clearSession:    clearSession,
    authFetch:       authFetch,
    formatCurrency:  formatCurrency,
    formatDate:      formatDate,
    formatNumber:    formatNumber,
    showToast:       showToast,
    showLoading:     showLoading,
    hideLoading:     hideLoading,
    setVisible:      setVisible,
    setText:         setText,
    redirectToLogin: redirectToLogin,
    requireAuth:     requireAuth,
  };

}(typeof window !== 'undefined' ? window : this));
