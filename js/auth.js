/**
 * js/auth.js — Authentication module.
 *
 * Depends on: js/config.js (GlobexCfg), js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexAuth.register(name, email, password, role?, country?)
 *   GlobexAuth.login(email, password)
 *   GlobexAuth.logout()
 *   GlobexAuth.getProfile()
 *   GlobexAuth.refreshToken()
 *   GlobexAuth.isLoggedIn()
 *   GlobexAuth.getUser()
 *   GlobexAuth.getToken()
 *
 * All methods return Promises. JWT token stored in localStorage under
 * 'globexSession' as { token, refresh_token }.
 */

(function (global) {
  'use strict';

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function _baseUrl() {
    return (global.GlobexCfg && global.GlobexCfg.apiBaseUrl) || '/api/v1';
  }

  function _getToken() {
    return global.GlobexUtils ? global.GlobexUtils.getToken() : null;
  }

  function _headers(json) {
    var h = {};
    if (json !== false) h['Content-Type'] = 'application/json';
    var token = _getToken();
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function _saveSession(token, refreshToken, user) {
    try {
      localStorage.setItem('globexSession', JSON.stringify({
        token: token,
        refresh_token: refreshToken || null,
      }));
      if (user) {
        localStorage.setItem('globexUser', JSON.stringify({
          id:          user.id          || null,
          name:        user.full_name   || user.name  || (user.email || '').split('@')[0],
          email:       user.email       || '',
          role:        user.role        || 'buyer',
          avatar:      user.avatar_url  || user.avatar || '',
          loggedInAt:  new Date().toISOString(),
        }));
      }
    } catch (_) { }
  }

  // ─── Register ──────────────────────────────────────────────────────────────

  /**
   * Register a new account.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @param {string} [role]     buyer | supplier | admin
   * @param {string} [country]
   * @returns {Promise<object>}  API response data
   */
  function register(name, email, password, role, country) {
    return fetch(_baseUrl() + '/auth/register', {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify({
        name: name,
        email: email,
        password: password,
        role: role || 'buyer',
        country: country || '',
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');
          return data;
        });
      });
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  /**
   * Log in with email and password.
   * Stores the JWT session in localStorage automatically.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>}  { token, refresh_token, user }
   */
  function login(email, password) {
    return fetch(_baseUrl() + '/auth/login', {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
          return data;
        });
      })
      .then(function (data) {
        var payload = data.data || data;
        var token   = payload.token || payload.access_token;
        var refresh = payload.refresh_token;
        var user    = payload.user || {};
        var profile = (user.profile) || user;
        _saveSession(token, refresh, profile);
        return payload;
      });
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  /**
   * Log out — calls backend and clears local session.
   * @returns {Promise<void>}
   */
  function logout() {
    var token = _getToken();
    var req = token
      ? fetch(_baseUrl() + '/auth/logout', { method: 'POST', headers: _headers() })
      : Promise.resolve();
    return req.finally(function () {
      if (global.GlobexUtils) global.GlobexUtils.clearSession();
      else {
        localStorage.removeItem('globexSession');
        localStorage.removeItem('globexUser');
      }
    });
  }

  // ─── Get profile ────────────────────────────────────────────────────────────

  /**
   * Fetch the logged-in user's profile from the API.
   * @returns {Promise<object>}  User/profile object
   */
  function getProfile() {
    return fetch(_baseUrl() + '/users/profile', { headers: _headers() })
      .then(function (res) {
        if (res.status === 401) {
          if (global.GlobexUtils) global.GlobexUtils.clearSession();
          throw new Error('Session expired');
        }
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || data.message || 'Failed to load profile');
          return data.data || data;
        });
      });
  }

  // ─── Refresh token ─────────────────────────────────────────────────────────

  /**
   * Use the stored refresh token to obtain a new access token.
   * @returns {Promise<string>}  New access token
   */
  function refreshToken() {
    var session = {};
    try { session = JSON.parse(localStorage.getItem('globexSession') || '{}'); } catch (_) { }
    var rt = session.refresh_token;
    if (!rt) return Promise.reject(new Error('No refresh token'));
    return fetch(_baseUrl() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Refresh failed');
          return data;
        });
      })
      .then(function (data) {
        var newToken = data.token || data.access_token;
        session.token = newToken;
        localStorage.setItem('globexSession', JSON.stringify(session));
        return newToken;
      });
  }

  // ─── Convenience getters ───────────────────────────────────────────────────

  function isLoggedIn()  { return !!(global.GlobexUtils ? global.GlobexUtils.getToken() : _getToken()); }
  function getUser()     { return global.GlobexUtils ? global.GlobexUtils.getUser() : null; }
  function getToken()    { return _getToken(); }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexAuth = {
    register:     register,
    login:        login,
    logout:       logout,
    getProfile:   getProfile,
    refreshToken: refreshToken,
    isLoggedIn:   isLoggedIn,
    getUser:      getUser,
    getToken:     getToken,
  };

}(typeof window !== 'undefined' ? window : this));
