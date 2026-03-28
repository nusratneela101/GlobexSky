/**
 * js/admin.js — Admin panel module.
 *
 * Provides helpers for all admin panel pages.  Requires admin authentication —
 * redirects to login if not authenticated or not an admin.
 *
 * Depends on: js/config.js (GlobexCfg), js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexAdmin.requireAdmin()
 *   GlobexAdmin.getDashboardStats()       → GET  /api/v1/admin/dashboard  (or /admin/stats)
 *   GlobexAdmin.getConfig()               → GET  /api/v1/admin/config
 *   GlobexAdmin.updateConfig(data)        → PUT  /api/v1/admin/config
 *   GlobexAdmin.updateSecrets(data)       → PUT  /api/v1/admin/config/secrets
 *   GlobexAdmin.testConnections(cat?)     → POST /api/v1/admin/config/test-connection
 *   GlobexAdmin.toggleMode()              → POST /api/v1/admin/config/toggle-mode
 *   GlobexAdmin.getHealth()               → GET  /api/v1/admin/config/health
 *   GlobexAdmin.getUsers(params?)         → GET  /api/v1/admin/users
 *   GlobexAdmin.getProducts(params?)      → GET  /api/v1/admin/products
 *   GlobexAdmin.showModeIndicator()       — Injects mode badge into all admin topbars
 */

(function (global) {
  'use strict';

  function _api(method, path, data) {
    if (global.GlobexUtils && global.GlobexUtils.apiCall) {
      return global.GlobexUtils.apiCall(method, path, data);
    }
    return Promise.reject(new Error('GlobexUtils not loaded'));
  }

  function _qs(obj) {
    if (!obj) return '';
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  // ─── Auth guard ────────────────────────────────────────────────────────────

  /**
   * Redirect to login if not authenticated or not an admin.
   * Call at the top of every admin page script.
   */
  function requireAdmin() {
    if (!global.GlobexUtils) return;
    return global.GlobexUtils.requireAuth(true);
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  /**
   * Fetch admin dashboard statistics.
   * @returns {Promise<{totalUsers, totalProducts, totalOrders, totalRevenue, ...}>}
   */
  function getDashboardStats() {
    return _api('GET', '/admin/dashboard')
      .catch(function () {
        // Fallback path some backends use
        return _api('GET', '/admin/stats');
      });
  }

  // ─── Config management ─────────────────────────────────────────────────────

  /**
   * Get all admin config (secrets masked).
   * @returns {Promise<object>}
   */
  function getConfig() {
    return _api('GET', '/admin/config');
  }

  /**
   * Update writable config values (non-secret only).
   * @param {object} data  Key-value pairs of writable config keys
   * @returns {Promise<object>}
   */
  function updateConfig(data) {
    return _api('PUT', '/admin/config', data);
  }

  /**
   * Update secret API keys (requires extra validation on backend).
   * @param {object} data  { SERVICE_KEY: value, ... }
   * @returns {Promise<object>}
   */
  function updateSecrets(data) {
    return _api('PUT', '/admin/config/secrets', data);
  }

  /**
   * Test connections to one or all services.
   * @param {string} [category]  Specific service name, or omit to test all
   * @returns {Promise<{results: object}>}
   */
  function testConnections(category) {
    var body = category ? { category: category } : {};
    return _api('POST', '/admin/config/test-connection', body);
  }

  /**
   * Toggle between test and live mode.
   * @returns {Promise<{currentMode: string, previousMode: string}>}
   */
  function toggleMode() {
    return _api('POST', '/admin/config/toggle-mode', {});
  }

  /**
   * Get health status of all services.
   * @returns {Promise<{services: object, mode: string}>}
   */
  function getHealth() {
    return _api('GET', '/admin/config/health');
  }

  // ─── Users & Products ──────────────────────────────────────────────────────

  /**
   * List all users (admin).
   * @param {object} [params]  { page, limit, role, search }
   * @returns {Promise<object>}
   */
  function getUsers(params) {
    return _api('GET', '/admin/users' + _qs(params));
  }

  /**
   * List all products (admin).
   * @param {object} [params]  { page, limit, category, status }
   * @returns {Promise<object>}
   */
  function getProducts(params) {
    return _api('GET', '/admin/products' + _qs(params));
  }

  // ─── Mode indicator ────────────────────────────────────────────────────────

  /**
   * Inject the current TEST/LIVE mode badge into the admin topbar.
   * Also stores the mode in sessionStorage for fast access.
   */
  function showModeIndicator() {
    function _render(mode) {
      // Update all elements that carry a mode indicator
      var isLive = mode === 'live';
      var badge = document.getElementById('admin-mode-badge') || _createBadge();
      if (badge) {
        badge.textContent = isLive ? '🟢 LIVE MODE' : '🟡 TEST MODE';
        badge.style.background  = isLive ? '#d1fae5' : '#fef9c3';
        badge.style.color       = isLive ? '#065f46' : '#854d0e';
        badge.style.border      = isLive ? '1px solid #6ee7b7' : '1px solid #fde68a';
      }
      // Update globalModeIndicator if it exists (admin settings page)
      var gmi = document.getElementById('globalModeIndicator');
      if (gmi) {
        gmi.textContent       = isLive ? '🟢 Live Mode' : '🔧 Test Mode';
        gmi.style.background  = isLive ? '#d1fae5' : '#fff7ed';
        gmi.style.color       = isLive ? '#059669' : '#f97316';
      }
    }

    function _createBadge() {
      var topbar = document.querySelector('.admin-topbar-right, .admin-topbar');
      if (!topbar) return null;
      var badge = document.createElement('span');
      badge.id = 'admin-mode-badge';
      badge.style.cssText = 'padding:4px 12px;border-radius:20px;font-size:.78rem;font-weight:600;' +
        'font-family:Inter,sans-serif;letter-spacing:.3px;margin-right:8px;white-space:nowrap';
      topbar.insertBefore(badge, topbar.firstChild);
      return badge;
    }

    // Try to get mode from cached config first
    var cached = global.GlobexCfg && global.GlobexCfg.get && global.GlobexCfg.get();
    if (cached && cached.mode) {
      _render(cached.mode);
      return;
    }
    if (global.GlobexCfg && global.GlobexCfg.ready) {
      global.GlobexCfg.ready().then(function (cfg) {
        _render(cfg.mode);
      }).catch(function () { _render('test'); });
    }
  }

  // ─── Init helper ──────────────────────────────────────────────────────────

  /**
   * Convenience initializer for admin pages.
   * Call once on DOMContentLoaded.  Checks auth and injects mode indicator.
   */
  function init() {
    requireAdmin();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        showModeIndicator();
      });
    } else {
      showModeIndicator();
    }
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexAdmin = {
    requireAdmin:      requireAdmin,
    getDashboardStats: getDashboardStats,
    getConfig:         getConfig,
    updateConfig:      updateConfig,
    updateSecrets:     updateSecrets,
    testConnections:   testConnections,
    toggleMode:        toggleMode,
    getHealth:         getHealth,
    getUsers:          getUsers,
    getProducts:       getProducts,
    showModeIndicator: showModeIndicator,
    init:              init,
  };

}(typeof window !== 'undefined' ? window : this));
