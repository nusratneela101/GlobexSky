/**
 * Globex Sky — admin-config.js
 * Admin configuration panel: TEST/LIVE mode toggle and API key management.
 *
 * Exposes:
 *   window.AdminConfig — object with all helpers (see bottom of file)
 *
 * Patterns mirror admin-settings.js:
 *   - Token read via globexSession.token → globexToken → token
 *   - API base from window.GlobexConfig.API_BASE_URL or /api/v1
 *   - Delegates to window.ApiService when available, else raw fetch
 */

const AdminConfig = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIGURATION
  ───────────────────────────────────────────── */

  function _baseUrl() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
  }

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */

  var MASKED_VALUE = '••••••••';

  /* ─────────────────────────────────────────────
     AUTH TOKEN
  ───────────────────────────────────────────── */

  function _getToken() {
    try {
      var session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session && session.token) return session.token;
    } catch (_) { /* ignore */ }
    return localStorage.getItem('globexToken') || localStorage.getItem('token') || null;
  }

  function _authHeaders() {
    var token = _getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  /* ─────────────────────────────────────────────
     INTERNAL FETCH (delegates to ApiService when available)
  ───────────────────────────────────────────── */

  async function _get(path) {
    if (window.ApiService && typeof window.ApiService.get === 'function') {
      return window.ApiService.get(path);
    }
    var res = await fetch(_baseUrl() + path, { headers: _authHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function _post(path, body) {
    if (window.ApiService && typeof window.ApiService.post === 'function') {
      return window.ApiService.post(path, body);
    }
    var res = await fetch(_baseUrl() + path, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function _put(path, body) {
    if (window.ApiService && typeof window.ApiService.put === 'function') {
      return window.ApiService.put(path, body);
    }
    var res = await fetch(_baseUrl() + path, {
      method: 'PUT',
      headers: _authHeaders(),
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */

  var _state = {
    mode: 'test',
    services: {},        // { [serviceName]: { mode, settings } }
    testResults: {},     // { [serviceName]: true|false }
    requiredServices: [],
  };

  /* ─────────────────────────────────────────────
     TEST MODE BANNER
  ───────────────────────────────────────────── */

  /**
   * Show a fixed yellow TEST MODE banner at the top of the page when the
   * platform is in test/sandbox mode, or remove it when in live mode.
   */
  function renderTestModeBar() {
    var BANNER_ID = 'admin-config-test-banner';
    var existing  = document.getElementById(BANNER_ID);

    if (_state.mode !== 'test') {
      if (existing) existing.remove();
      return;
    }

    if (existing) return; // already rendered

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.textContent = '⚠️ TEST MODE — Platform is using sandbox/test credentials';
    banner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:9999',
      'background:#fef08a',
      'color:#78350f',
      'text-align:center',
      'font-size:.8rem',
      'font-weight:600',
      'padding:8px 16px',
      'letter-spacing:.01em',
      'border-bottom:1px solid #fde047',
      'pointer-events:none',
    ].join(';');

    document.body.insertBefore(banner, document.body.firstChild);
  }

  /* ─────────────────────────────────────────────
     LOAD CONFIG
  ───────────────────────────────────────────── */

  /**
   * Fetch all platform settings from the backend and populate the form.
   * Populates inputs via [data-service][data-mode] attribute selectors.
   */
  async function loadConfig() {
    try {
      var json = await _get('/admin/settings/platform');
      if (!json.success) {
        _showToast(json.error || 'Failed to load platform settings.', 'error');
        return;
      }

      _state.mode = json.mode || 'test';
      renderTestModeBar();
      _updateGlobalModeIndicator(_state.mode);

      var data = json.data || {};
      Object.entries(data).forEach(function(entry) {
        var service  = entry[0];
        var rows     = entry[1];
        var svcMode  = (rows.length > 0 && rows[0].mode) ? rows[0].mode : _state.mode;

        _state.services[service] = { mode: svcMode, settings: {} };

        rows.forEach(function(row) {
          _state.services[service].settings[row.setting_key] = row.setting_value;

          // Populate [data-service="X"][data-mode="Y"] input with matching key
          var el = document.querySelector(
            '[data-service="' + service + '"][data-mode="' + svcMode + '"][data-key="' + row.setting_key + '"]'
          );
          if (el && row.setting_value && row.setting_value !== MASKED_VALUE) {
            el.value = row.setting_value;
          }
        });

        // Update any mode-toggle radio/checkbox for this service
        var modeToggle = document.querySelector('[data-service="' + service + '"][data-mode-toggle]');
        if (modeToggle) {
          if (modeToggle.type === 'checkbox') {
            modeToggle.checked = svcMode === 'live';
          } else if (modeToggle.tagName === 'SELECT') {
            modeToggle.value = svcMode;
          }
        }

        _updateServiceModeLabel(service, svcMode);
      });

      // Collect required services from DOM (data-required-service attributes)
      _state.requiredServices = Array.from(
        document.querySelectorAll('[data-required-service]')
      ).map(function(el) { return el.getAttribute('data-required-service'); });

      _updateGoLiveButton();
    } catch (err) {
      console.error('[AdminConfig] loadConfig error:', err);
      _showToast('Network error loading config: ' + err.message, 'error');
    }
  }

  /* ─────────────────────────────────────────────
     SAVE SERVICE CONFIG
  ───────────────────────────────────────────── */

  /**
   * Gather inputs for a service and persist them.
   *
   * @param {string} service  — service name (e.g. "stripe")
   * @param {string} mode     — "test" or "live"
   * @param {object} settings — { key: value } pairs; if omitted, reads DOM
   */
  async function saveServiceConfig(service, mode, settings) {
    var resolved = settings || _collectInputs(service, mode);

    if (!resolved || Object.keys(resolved).length === 0) {
      _showToast('No values to save for ' + service + '.', 'warning');
      return;
    }

    _setStatusIcon(service, 'loading');
    _showToast('Saving ' + service + '…', 'info');

    try {
      var json = await _put('/admin/settings/platform/' + service, { mode: mode, settings: resolved });
      if (json.success) {
        _showToast(service + ' settings saved (' + mode + ' mode).', 'success');
        _setStatusIcon(service, 'saved');
        if (_state.services[service]) {
          _state.services[service].mode = mode;
          Object.assign(_state.services[service].settings, resolved);
        }
      } else {
        _showToast(json.error || 'Save failed.', 'error');
        _setStatusIcon(service, 'error');
      }
    } catch (err) {
      _showToast('Network error: ' + err.message, 'error');
      _setStatusIcon(service, 'error');
    }
  }

  /** Read all [data-service][data-mode][data-key] inputs for a service/mode. */
  function _collectInputs(service, mode) {
    var settings = {};
    var selector = '[data-service="' + service + '"][data-mode="' + mode + '"][data-key]';
    document.querySelectorAll(selector).forEach(function(el) {
      var key = el.getAttribute('data-key');
      var val = el.value.trim();
      if (val && val !== MASKED_VALUE) settings[key] = val;
    });
    return settings;
  }

  /* ─────────────────────────────────────────────
     TEST CONNECTION
  ───────────────────────────────────────────── */

  /**
   * Test connectivity for a service.
   * Shows ✅ / ❌ next to the "Test Connection" button.
   *
   * @param {string} service — service name (e.g. "stripe")
   */
  async function testConnection(service) {
    var mode = (_state.services[service] && _state.services[service].mode) || _state.mode;
    _setStatusIcon(service, 'loading');
    _showToast('Testing ' + service + ' connection…', 'info');

    try {
      var json = await _post('/admin/settings/platform/test-connection', { category: service, mode: mode });
      var ok   = json.result && json.result.ok;
      var msg  = (json.result && json.result.message) || (ok ? 'Connected.' : 'Failed.');

      _setStatusIcon(service, ok ? 'ok' : 'error');
      _showToast(service + ': ' + msg, ok ? 'success' : 'error');

      _state.testResults[service] = !!ok;
      _updateGoLiveButton();
    } catch (err) {
      _showToast('Network error: ' + err.message, 'error');
      _setStatusIcon(service, 'error');
      _state.testResults[service] = false;
      _updateGoLiveButton();
    }
  }

  /* ─────────────────────────────────────────────
     TOGGLE MODE
  ───────────────────────────────────────────── */

  /**
   * Toggle the global platform mode between test and live.
   * Reloads config after a successful toggle.
   */
  async function toggleMode() {
    try {
      var json = await _post('/admin/settings/platform/toggle-mode', {});
      if (json.success) {
        _state.mode = json.currentMode || (_state.mode === 'test' ? 'live' : 'test');
        _showToast('Switched to ' + _state.mode + ' mode.', 'success');
        renderTestModeBar();
        _updateGlobalModeIndicator(_state.mode);
      } else {
        _showToast(json.error || 'Failed to toggle mode.', 'error');
      }
    } catch (err) {
      _showToast('Network error: ' + err.message, 'error');
    }
  }

  /* ─────────────────────────────────────────────
     GO LIVE BUTTON
  ───────────────────────────────────────────── */

  /**
   * Evaluate whether all required services have passed their connection test.
   * Enables or disables the [data-go-live-btn] button accordingly.
   */
  function _updateGoLiveButton() {
    var btn = document.querySelector('[data-go-live-btn]');
    if (!btn) return;

    if (_state.requiredServices.length === 0) {
      btn.disabled = false;
      btn.title = '';
      return;
    }

    var failed = _state.requiredServices.filter(function(s) {
      return !_state.testResults[s];
    });

    if (failed.length === 0) {
      btn.disabled = false;
      btn.title = 'All required services verified — ready to go live!';
      btn.style.opacity = '1';
    } else {
      btn.disabled = true;
      btn.title = 'Still failing: ' + failed.join(', ');
      btn.style.opacity = '0.5';
    }
  }

  /**
   * Called by the Go LIVE button's onclick handler.
   * Validates all required services, then calls toggleMode().
   */
  async function goLive() {
    var failed = _state.requiredServices.filter(function(s) {
      return !_state.testResults[s];
    });

    if (failed.length > 0) {
      _showToast('Cannot go live — failing services: ' + failed.join(', '), 'error');
      return;
    }

    await toggleMode();
  }

  /* ─────────────────────────────────────────────
     UI HELPERS
  ───────────────────────────────────────────── */

  function _setStatusIcon(service, state) {
    var el = document.getElementById('status-icon-' + service) ||
             document.querySelector('[data-status-icon="' + service + '"]');
    if (!el) return;
    var map = {
      ok:      { icon: '✅', color: '#059669' },
      error:   { icon: '❌', color: '#ef4444' },
      loading: { icon: '⏳', color: '#94a3b8' },
      saved:   { icon: '💾', color: '#0052CC' },
    };
    var s = map[state] || map.loading;
    el.textContent = s.icon;
    el.style.color = s.color;
  }

  function _updateServiceModeLabel(service, mode) {
    var el = document.getElementById('mode-label-' + service) ||
             document.querySelector('[data-mode-label="' + service + '"]');
    if (!el) return;
    if (mode === 'live') {
      el.textContent = '🟢 Live';
      el.style.color = '#059669';
    } else {
      el.textContent = '🔧 Test';
      el.style.color = '#f97316';
    }
  }

  function _updateGlobalModeIndicator(mode) {
    var el = document.getElementById('globalModeIndicator') ||
             document.querySelector('[data-global-mode-indicator]');
    if (!el) return;
    el.textContent       = mode === 'live' ? '🟢 Live Mode' : '🔧 Test Mode';
    el.style.background  = mode === 'live' ? '#d1fae5' : '#fff7ed';
    el.style.color       = mode === 'live' ? '#059669'  : '#f97316';
  }

  function _showToast(message, type) {
    var colors = { success: '#059669', error: '#ef4444', warning: '#f97316', info: '#0052CC' };
    var bg = colors[type] || colors.info;
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;background:' + bg +
      ';color:#fff;border-radius:10px;font-size:.875rem;font-weight:500;z-index:9999;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s';
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */

  /**
   * Initialize the admin config panel.
   * Call once on DOMContentLoaded (or earlier if the DOM is already ready).
   */
  function init() {
    renderTestModeBar();
    loadConfig();

    // Wire up the global mode toggle button if present
    var toggleBtn = document.querySelector('[data-toggle-mode-btn]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() { toggleMode(); });
    }

    // Wire up the Go LIVE button
    var goLiveBtn = document.querySelector('[data-go-live-btn]');
    if (goLiveBtn) {
      goLiveBtn.addEventListener('click', function() { goLive(); });
    }

    // Wire up per-service "Test Connection" buttons
    document.querySelectorAll('[data-test-connection]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        testConnection(btn.getAttribute('data-test-connection'));
      });
    });

    // Wire up per-service "Save" buttons
    document.querySelectorAll('[data-save-service]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var svc  = btn.getAttribute('data-save-service');
        var mode = (_state.services[svc] && _state.services[svc].mode) || _state.mode;
        saveServiceConfig(svc, mode, null);
      });
    });

    // Wire up per-service mode toggles (checkbox or select)
    document.querySelectorAll('[data-service][data-mode-toggle]').forEach(function(el) {
      el.addEventListener('change', function() {
        var svc = el.getAttribute('data-service');
        var mode;
        if (el.type === 'checkbox') {
          mode = el.checked ? 'live' : 'test';
        } else {
          mode = el.value;
        }
        if (_state.services[svc]) _state.services[svc].mode = mode;
        _updateServiceModeLabel(svc, mode);
      });
    });
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */

  return {
    init:              init,
    loadConfig:        loadConfig,
    saveServiceConfig: saveServiceConfig,
    toggleMode:        toggleMode,
    testConnection:    testConnection,
    renderTestModeBar: renderTestModeBar,
    goLive:            goLive,
    // Expose internal state for debugging
    getState: function() { return _state; },
  };
})();

window.AdminConfig = AdminConfig;

document.addEventListener('DOMContentLoaded', function() {
  AdminConfig.init();
});
