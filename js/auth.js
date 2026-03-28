/**
 * js/auth.js — Real Supabase Authentication module.
 *
 * Depends on:
 *   - Supabase CDN: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   - js/supabase.js (initializes window.supabaseClient)
 *   - js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexAuth.register(name, email, password, role?, country?)
 *   GlobexAuth.login(email, password)
 *   GlobexAuth.logout()
 *   GlobexAuth.getUser()
 *   GlobexAuth.getSession()
 *   GlobexAuth.isLoggedIn()
 *   GlobexAuth.onAuthStateChange(callback)
 *   GlobexAuth.updateNavUI()
 */

(function (global) {
  'use strict';

  function _client() {
    return global.supabaseClient ||
      (global.supabase && global.supabase.createClient &&
        global.supabase.createClient(
          'https://czpqbdkarwdvrnhtvysd.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E'
        ));
  }

  // ─── Navbar UI Update ──────────────────────────────────────────────────────

  function updateNavUI() {
    getUser().then(function (user) {
      // Elements visible when logged out
      document.querySelectorAll('.auth-logged-out, [data-auth="logged-out"]').forEach(function (el) {
        el.style.display = user ? 'none' : '';
      });
      // Elements visible when logged in
      document.querySelectorAll('.auth-logged-in, [data-auth="logged-in"]').forEach(function (el) {
        el.style.display = user ? '' : 'none';
      });
      if (user) {
        var name = (user.user_metadata && user.user_metadata.name) || user.email.split('@')[0];
        document.querySelectorAll('.user-display-name, [data-user-name]').forEach(function (el) {
          el.textContent = name;
        });
        document.querySelectorAll('.user-display-email, [data-user-email]').forEach(function (el) {
          el.textContent = user.email;
        });
      }
    }).catch(function () { });
  }

  // ─── Register ──────────────────────────────────────────────────────────────

  /**
   * Register a new account using Supabase Auth.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @param {string} [role]     buyer | supplier | admin
   * @param {string} [country]
   * @returns {Promise<object>}
   */
  function register(name, email, password, role, country) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: name || email.split('@')[0],
          role: role || 'buyer',
          country: country || '',
        },
      },
    }).then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    });
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  /**
   * Log in with email and password via Supabase Auth.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>}
   */
  function login(email, password) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        updateNavUI();
        return result.data;
      });
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  /**
   * Log out via Supabase Auth.
   * @returns {Promise<void>}
   */
  function logout() {
    var sb = _client();
    if (!sb) return Promise.resolve();
    return sb.auth.signOut().then(function () {
      updateNavUI();
    });
  }

  // ─── Get User ──────────────────────────────────────────────────────────────

  /**
   * Get the currently authenticated user.
   * @returns {Promise<object|null>}
   */
  function getUser() {
    var sb = _client();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getUser().then(function (result) {
      return (result.data && result.data.user) || null;
    });
  }

  /**
   * Get the current session.
   * @returns {Promise<object|null>}
   */
  function getSession() {
    var sb = _client();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (result) {
      return (result.data && result.data.session) || null;
    });
  }

  /**
   * Check if the user is logged in (synchronous via Supabase localStorage key).
   * @returns {boolean}
   */
  function isLoggedIn() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('sb-') && keys[i].endsWith('-auth-token')) {
          var sess = JSON.parse(localStorage.getItem(keys[i]) || 'null');
          if (sess && sess.access_token) return true;
        }
      }
    } catch (_) { }
    return false;
  }

  /**
   * Register a callback for auth state changes.
   * @param {function} callback  Called with (event, session)
   * @returns {object}  Subscription object
   */
  function onAuthStateChange(callback) {
    var sb = _client();
    if (!sb) return { data: { subscription: { unsubscribe: function () {} } } };
    return sb.auth.onAuthStateChange(function (event, session) {
      updateNavUI();
      if (typeof callback === 'function') callback(event, session);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavUI);
  } else {
    updateNavUI();
  }

  var _sb = _client();
  if (_sb) {
    _sb.auth.onAuthStateChange(function () { updateNavUI(); });
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexAuth = {
    register:          register,
    login:             login,
    logout:            logout,
    getUser:           getUser,
    getSession:        getSession,
    isLoggedIn:        isLoggedIn,
    onAuthStateChange: onAuthStateChange,
    updateNavUI:       updateNavUI,
  };

}(typeof window !== 'undefined' ? window : this));
