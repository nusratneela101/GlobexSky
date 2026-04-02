/**
 * assets/js/auth-guard.js
 * Lightweight auth guard — immediately redirects unauthenticated users to the
 * login page, preserving the current URL as the post-login redirect target.
 *
 * Include this script on any protected page (account, supplier, dropshipping,
 * admin). It runs synchronously so the redirect fires before page content renders.
 *
 * Token detection order (matches api-service.js and existing inline guards):
 *   1. globexSession.token  (JSON object in localStorage)
 *   2. globexToken          (direct localStorage key)
 *   3. token                (direct localStorage / sessionStorage key)
 *   4. Supabase sb-*-auth-token keys
 */
(function () {
  'use strict';

  function getToken() {
    try {
      var session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session && session.token) return session.token;
    } catch (_) {}

    var direct =
      localStorage.getItem('globexToken') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');
    if (direct) return direct;

    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('sb-') && keys[i].endsWith('-auth-token')) {
          var sess = JSON.parse(localStorage.getItem(keys[i]) || 'null');
          if (sess && sess.access_token) return sess.access_token;
        }
      }
    } catch (_) {}

    return null;
  }

  if (!getToken()) {
    var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('/pages/auth/login.html?redirect=' + returnUrl);
  }
}());
