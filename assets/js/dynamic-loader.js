/**
 * Globex Sky — dynamic-loader.js
 * Generic page-section data loader.
 *
 * Exposes:
 *   window.DynamicLoader — object with all helpers (see bottom of file)
 *
 * Each load helper handles:
 *   - Loading spinner while fetching
 *   - Rendering via caller-supplied render function
 *   - Empty-state friendly message
 *   - Error-state with Retry button
 *   - Auth token read from localStorage (globexSession.token → globexToken → token)
 */

const DynamicLoader = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIGURATION
  ───────────────────────────────────────────── */

  function _baseUrl() {
    return (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
  }

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
     SPINNER / STATE HTML HELPERS
  ───────────────────────────────────────────── */

  function _spinnerHtml() {
    return '<div class="loading-placeholder" style="display:flex;align-items:center;gap:8px;padding:24px;color:#94a3b8;font-size:.875rem">' +
      '<span class="spinner" style="display:inline-block;width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#0052CC;border-radius:50%;animation:dl-spin .7s linear infinite"></span>' +
      '<span>Loading…</span>' +
      '</div>';
  }

  function _ensureSpinnerKeyframes() {
    if (document.getElementById('dl-keyframes')) return;
    var style = document.createElement('style');
    style.id = 'dl-keyframes';
    style.textContent = '@keyframes dl-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  function _emptyHtml(msg) {
    return '<div class="empty-state" style="padding:32px;text-align:center;color:#94a3b8;font-size:.875rem">' +
      (msg || 'No data found.') +
      '</div>';
  }

  function _errorHtml(msg, retryFnName) {
    return '<div class="error-state" style="padding:24px;text-align:center;color:#ef4444;font-size:.875rem">' +
      '<p style="margin:0 0 12px">' + (msg || 'Failed to load data.') + '</p>' +
      (retryFnName
        ? '<button onclick="' + retryFnName + '" style="padding:6px 16px;background:#0052CC;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">Retry</button>'
        : '') +
      '</div>';
  }

  /* ─────────────────────────────────────────────
     INTERNAL FETCH HELPER
  ───────────────────────────────────────────── */

  async function _fetch(apiPath, params) {
    var url = _baseUrl() + apiPath;
    if (params && Object.keys(params).length) {
      url += '?' + new URLSearchParams(params).toString();
    }
    var res = await fetch(url, { headers: _authHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /* ─────────────────────────────────────────────
     loadSection
  ───────────────────────────────────────────── */

  /**
   * Load data into a generic container element.
   *
   * @param {object} config
   * @param {string}   config.apiPath     — path appended to API_BASE_URL
   * @param {string}   config.containerId — id of the target DOM element
   * @param {Function} config.renderFn    — (data) => HTML string
   * @param {string}  [config.emptyMsg]   — message when data array is empty
   * @param {string}  [config.errorMsg]   — message shown on fetch error
   * @param {object}  [config.params]     — query string parameters
   */
  async function loadSection(config) {
    _ensureSpinnerKeyframes();
    var container = document.getElementById(config.containerId);
    if (!container) return;

    container.innerHTML = _spinnerHtml();

    try {
      var json = await _fetch(config.apiPath, config.params || {});
      var items = json.data || json.results || json || [];

      if (!items || (Array.isArray(items) && items.length === 0)) {
        container.innerHTML = _emptyHtml(config.emptyMsg);
        return;
      }

      var html = config.renderFn(items, json);
      container.innerHTML = typeof html === 'string' ? html : '';
    } catch (err) {
      console.error('[DynamicLoader] loadSection error:', err);
      var retryCall = 'DynamicLoader.loadSection(' + JSON.stringify(config) + ')';
      container.innerHTML = _errorHtml(config.errorMsg, retryCall);
    }
  }

  /* ─────────────────────────────────────────────
     loadTable
  ───────────────────────────────────────────── */

  /**
   * Load data into a <tbody> element row-by-row.
   *
   * @param {object} config
   * @param {string}   config.apiPath  — path appended to API_BASE_URL
   * @param {string}   config.tbodyId  — id of the <tbody> element
   * @param {Function} config.rowFn    — (item, index) => <tr> HTML string
   * @param {string}  [config.emptyMsg]
   * @param {object}  [config.params]
   */
  async function loadTable(config) {
    _ensureSpinnerKeyframes();
    var tbody = document.getElementById(config.tbodyId);
    if (!tbody) return;

    var colCount = tbody.closest('table')
      ? tbody.closest('table').querySelectorAll('thead th').length || 1
      : 1;

    tbody.innerHTML = '<tr><td colspan="' + colCount + '">' + _spinnerHtml() + '</td></tr>';

    try {
      var json = await _fetch(config.apiPath, config.params || {});
      var items = json.data || json.results || json || [];

      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="' + colCount + '">' + _emptyHtml(config.emptyMsg) + '</td></tr>';
        return;
      }

      tbody.innerHTML = items.map(function(item, i) { return config.rowFn(item, i); }).join('');
    } catch (err) {
      console.error('[DynamicLoader] loadTable error:', err);
      tbody.innerHTML = '<tr><td colspan="' + colCount + '">' +
        _errorHtml(null, 'DynamicLoader.loadTable(' + JSON.stringify(config) + ')') +
        '</td></tr>';
    }
  }

  /* ─────────────────────────────────────────────
     loadStats
  ───────────────────────────────────────────── */

  /**
   * Load scalar stats and write values into DOM elements.
   *
   * @param {string} apiPath   — path appended to API_BASE_URL
   * @param {Array}  mappings  — [{ key, elementId }]
   */
  async function loadStats(apiPath, mappings) {
    try {
      var json = await _fetch(apiPath, {});
      var stats = json.data || json || {};

      mappings.forEach(function(m) {
        var el = document.getElementById(m.elementId);
        if (!el) return;
        var val = stats[m.key];
        el.textContent = val !== undefined && val !== null ? val : '—';
      });
    } catch (err) {
      console.error('[DynamicLoader] loadStats error:', err);
      mappings.forEach(function(m) {
        var el = document.getElementById(m.elementId);
        if (el) el.textContent = '—';
      });
    }
  }

  /* ─────────────────────────────────────────────
     initSearch
  ───────────────────────────────────────────── */

  /**
   * Attach a debounced search handler to an input field.
   *
   * @param {string}   inputId     — id of the <input> element
   * @param {string}   apiPath     — path appended to API_BASE_URL (receives ?q=)
   * @param {string}   containerId — id of the results container
   * @param {Function} renderFn    — (data, json) => HTML string
   */
  function initSearch(inputId, apiPath, containerId, renderFn) {
    var input = document.getElementById(inputId);
    var container = document.getElementById(containerId);
    if (!input || !container) return;

    var _timer = null;

    input.addEventListener('input', function() {
      clearTimeout(_timer);
      var q = input.value.trim();

      if (!q) {
        container.innerHTML = '';
        return;
      }

      _timer = setTimeout(function() {
        loadSection({
          apiPath: apiPath,
          containerId: containerId,
          renderFn: renderFn,
          params: { q: q },
          emptyMsg: 'No results for "' + q + '".',
          errorMsg: 'Search failed. Please try again.',
        });
      }, 300);
    });
  }

  /* ─────────────────────────────────────────────
     loadPaginated
  ───────────────────────────────────────────── */

  /**
   * Load data with pagination support.
   *
   * @param {object} config
   * @param {string}   config.apiPath      — path appended to API_BASE_URL
   * @param {string}   config.containerId  — id of the items container
   * @param {Function} config.renderFn     — (data, json) => HTML string
   * @param {string}  [config.paginationId]— id of pagination container
   * @param {number}  [config.page=1]      — current page number
   * @param {number}  [config.perPage=20]  — items per page
   * @param {string}  [config.emptyMsg]
   * @param {string}  [config.errorMsg]
   * @param {object}  [config.params]      — extra query params
   */
  async function loadPaginated(config) {
    _ensureSpinnerKeyframes();
    var container = document.getElementById(config.containerId);
    if (!container) return;

    var page    = config.page    || 1;
    var perPage = config.perPage || 20;

    container.innerHTML = _spinnerHtml();

    var params = Object.assign({}, config.params || {}, { page: page, per_page: perPage });

    try {
      var json = await _fetch(config.apiPath, params);
      var items = json.data || json.results || json || [];

      if (!items || (Array.isArray(items) && items.length === 0)) {
        container.innerHTML = _emptyHtml(config.emptyMsg);
        _clearPagination(config.paginationId);
        return;
      }

      container.innerHTML = config.renderFn(items, json);
      _renderPagination(config, json, page, perPage);
    } catch (err) {
      console.error('[DynamicLoader] loadPaginated error:', err);
      container.innerHTML = _errorHtml(config.errorMsg);
      _clearPagination(config.paginationId);
    }
  }

  function _clearPagination(paginationId) {
    if (!paginationId) return;
    var el = document.getElementById(paginationId);
    if (el) el.innerHTML = '';
  }

  function _renderPagination(config, json, currentPage, perPage) {
    if (!config.paginationId) return;
    var el = document.getElementById(config.paginationId);
    if (!el) return;

    var total = json.total || json.count || 0;
    var totalPages = Math.ceil(total / perPage) || 1;

    if (totalPages <= 1) { el.innerHTML = ''; return; }

    var nav = document.createElement('nav');
    nav.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';

    for (var p = 1; p <= totalPages; p++) {
      var btn = document.createElement('button');
      btn.textContent = String(p);
      btn.style.cssText = 'padding:4px 10px;border:1px solid;border-radius:6px;cursor:pointer;font-size:.8rem;' +
        (p === currentPage
          ? 'background:#0052CC;color:#fff;border-color:#0052CC'
          : 'background:#fff;color:#334155;border-color:#e2e8f0');

      /* Capture page number in a closure to avoid the classic loop-variable trap. */
      (function(pageNum) {
        btn.addEventListener('click', function() {
          loadPaginated(Object.assign({}, config, { page: pageNum }));
        });
      }(p));

      nav.appendChild(btn);
    }

    el.innerHTML = '';
    el.appendChild(nav);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */

  return {
    loadSection:   loadSection,
    loadTable:     loadTable,
    loadStats:     loadStats,
    initSearch:    initSearch,
    loadPaginated: loadPaginated,
  };
})();

window.DynamicLoader = DynamicLoader;
