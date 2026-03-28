/**
 * js/init.js — Page initializer.
 *
 * Include this script (after js/config.js and js/utils.js) on EVERY page.
 * It:
 *   1. Loads the public config from the backend (or cache) via GlobexCfg.
 *   2. Updates the cart badge count.
 *   3. Updates the navbar to reflect the current login state (name, avatar).
 *   4. On admin pages, calls GlobexAdmin.init() to check auth + show mode badge.
 *   5. Sets up the search bar to call the backend search endpoint.
 *   6. Wires newsletter form to the backend API.
 *
 * Depends on: js/config.js, js/utils.js, (optionally) js/auth.js, js/cart.js, js/admin.js
 */

(function (global) {
  'use strict';

  // ─── Detect page type ──────────────────────────────────────────────────────

  var pathname = global.location ? global.location.pathname : '';
  var isAdminPage = pathname.indexOf('/pages/admin/') !== -1 ||
    pathname.indexOf('/admin/') !== -1;
  var isAuthPage  = pathname.indexOf('/pages/auth/') !== -1;

  // ─── Update navbar auth state ──────────────────────────────────────────────

  function updateNavAuth() {
    var user = global.GlobexUtils && global.GlobexUtils.getUser
      ? global.GlobexUtils.getUser()
      : null;

    // Elements that should be hidden when logged in
    document.querySelectorAll('[data-auth="guest"], .nav-login-btn, .nav-register-btn').forEach(function (el) {
      el.style.display = user ? 'none' : '';
    });

    // Elements that should be visible when logged in
    document.querySelectorAll('[data-auth="user"], .nav-user-menu').forEach(function (el) {
      el.style.display = user ? '' : 'none';
    });

    // Update user name / avatar
    if (user) {
      document.querySelectorAll('[data-user-name]').forEach(function (el) {
        el.textContent = user.name || user.email || 'Account';
      });
      document.querySelectorAll('[data-user-avatar]').forEach(function (el) {
        if (user.avatar) el.src = user.avatar;
      });
    }
  }

  // ─── Cart badge ────────────────────────────────────────────────────────────

  function updateCartBadge() {
    if (global.GlobexCart && global.GlobexCart.updateBadge) {
      global.GlobexCart.updateBadge();
    }
  }

  // ─── Search bar wiring ─────────────────────────────────────────────────────

  function wireSearchBar() {
    var form = document.getElementById('search-form') ||
      document.querySelector('form[role="search"], .search-form, [data-search-form]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="search"], input[type="text"], .search-input');
      var q = input ? input.value.trim() : '';
      if (!q) return;
      var searchPage = pathname.startsWith('/pages/') ? '../../pages/search/index.html' : '/pages/search/index.html';
      global.location.href = searchPage + '?q=' + encodeURIComponent(q);
    });
  }

  // ─── Newsletter form ───────────────────────────────────────────────────────

  function wireNewsletter() {
    var form = document.getElementById('newsletter-form') ||
      document.querySelector('.newsletter-form, [data-newsletter-form]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = input ? input.value.trim() : '';
      if (!email) return;

      var baseUrl = (global.GlobexCfg && global.GlobexCfg.apiBaseUrl) || '/api/v1';
      fetch(baseUrl + '/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var msg = (data && (data.message || data.error)) || 'Thank you for subscribing!';
          if (global.GlobexUtils && global.GlobexUtils.showToast) {
            global.GlobexUtils.showToast(msg, data && !data.success ? 'error' : 'success');
          }
          if (data && data.success) form.reset();
        })
        .catch(function () {
          if (global.GlobexUtils && global.GlobexUtils.showToast) {
            global.GlobexUtils.showToast('Subscription failed. Please try again.', 'error');
          }
        });
    });
  }

  // ─── Logout buttons ───────────────────────────────────────────────────────

  function wireLogout() {
    document.querySelectorAll('[data-logout], .btn-logout, #logout-btn').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (global.GlobexAuth && global.GlobexAuth.logout) {
          global.GlobexAuth.logout().then(function () {
            global.location.href = '/index.html';
          });
        } else if (global.GlobexUtils) {
          global.GlobexUtils.clearSession();
          global.location.href = '/index.html';
        }
      });
    });
  }

  // ─── Admin page guard & mode indicator ────────────────────────────────────

  function initAdmin() {
    if (!isAdminPage) return;
    if (global.GlobexAdmin && global.GlobexAdmin.init) {
      global.GlobexAdmin.init();
    }
  }

  // ─── Run all init tasks ────────────────────────────────────────────────────

  function run() {
    // Load config (starts immediately, but hook into readiness)
    var cfgPromise = global.GlobexCfg && global.GlobexCfg.ready
      ? global.GlobexCfg.ready()
      : Promise.resolve({});

    cfgPromise.then(function () {
      updateNavAuth();
      updateCartBadge();
      wireSearchBar();
      wireNewsletter();
      wireLogout();
      initAdmin();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

}(typeof window !== 'undefined' ? window : this));
