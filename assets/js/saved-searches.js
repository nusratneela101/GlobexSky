/**
 * Globex Sky — saved-searches.js
 * Feature: Saved Searches / Search History
 *
 * Exposes: window.GlobexSky.SavedSearches
 *
 * API:
 *   saveSearch(query, filters, name)         → saved item | throws
 *   getSavedSearches()                        → array
 *   deleteSavedSearch(id)
 *   updateSavedSearch(id, name)
 *   toggleAlert(id)                           → updated item
 *   reExecuteSearch(id)                       → navigates to search page
 *   addToHistory(query)
 *   getHistory()
 *   clearHistory()
 *   deleteHistoryItem(id)
 *   getFilteredHistory(opts)                  → filtered array
 *   exportData()                              → triggers file download
 *   importData(jsonString)                    → boolean
 *   getSuggestions(query)                     → array of suggestion strings
 *   attach(inputEl, opts)                     → attaches dropdown to input
 *   initSampleData()                          → seeds sample data on first load
 */

'use strict';

window.GlobexSky = window.GlobexSky || {};

GlobexSky.SavedSearches = (() => {

  /* ── Storage keys ──────────────────────────────────────────────────── */
  const HISTORY_KEY = 'globexSearchHistoryV2';
  const SAVED_KEY   = 'globexSavedSearches';
  const SEEDED_KEY  = 'globexSavedSearchesSeeded';
  const MAX_HISTORY = 50;
  const MAX_SAVED   = 20;

  /* ── API base ──────────────────────────────────────────────────────── */
  function apiBase() {
    return (window.GlobexConfig && GlobexConfig.API_BASE_URL) ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api/v1'
        : 'https://globexsky-backend.up.railway.app/api/v1');
  }

  function authHeader() {
    const token = localStorage.getItem('globex_access_token') ||
      sessionStorage.getItem('globex_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function isLoggedIn() {
    return !!(localStorage.getItem('globex_access_token') ||
      sessionStorage.getItem('globex_access_token'));
  }

  /* ── Helpers ───────────────────────────────────────────────────────── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtRelTime(iso) {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const min  = Math.floor(diff / 60000);
      if (min < 1)   return 'just now';
      if (min < 60)  return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24)   return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      if (day < 7)   return `${day}d ago`;
      return new Intl.DateTimeFormat(navigator.language || 'en', {
        month: 'short', day: 'numeric',
      }).format(new Date(iso));
    } catch (_) { return ''; }
  }

  /* ── localStorage helpers ──────────────────────────────────────────── */
  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (_) { return []; }
  }

  function writeStore(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); }
    catch (_) { /* quota exceeded — ignore */ }
  }

  /* ══════════════════════════════════════════════════════════════════
     SEARCH HISTORY
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Returns the full search history array (newest first).
   */
  function getHistory() {
    return readStore(HISTORY_KEY);
  }

  /**
   * Adds a query to the history (deduplicates, trims to MAX_HISTORY).
   */
  function addToHistory(query) {
    const q = (query || '').trim();
    if (!q) return;

    let history = getHistory().filter(h => h.query.toLowerCase() !== q.toLowerCase());
    history.unshift({ id: uid(), query: q, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY);
    writeStore(HISTORY_KEY, history);

    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ query: q }),
      }).catch(() => {});
    }
  }

  /**
   * Removes a single history item by id.
   */
  function deleteHistoryItem(id) {
    writeStore(HISTORY_KEY, getHistory().filter(h => h.id !== id));
  }

  /**
   * Clears entire search history.
   */
  function clearHistory() {
    writeStore(HISTORY_KEY, []);
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/history`, {
        method: 'DELETE',
        headers: authHeader(),
      }).catch(() => {});
    }
  }

  /**
   * Returns history filtered by optional text query and/or date range.
   * opts: { query: string, from: Date|string, to: Date|string, period: 'today'|'week'|'month' }
   */
  function getFilteredHistory(opts = {}) {
    let items = getHistory();
    const q = (opts.query || '').trim().toLowerCase();
    if (q) items = items.filter(h => h.query.toLowerCase().includes(q));

    const now = new Date();
    if (opts.period && !opts.from && !opts.to) {
      const cutoff = new Date();
      if (opts.period === 'today')  { cutoff.setHours(0, 0, 0, 0); }
      else if (opts.period === 'week')  { cutoff.setDate(now.getDate() - 7); }
      else if (opts.period === 'month') { cutoff.setDate(now.getDate() - 30); }
      items = items.filter(h => new Date(h.timestamp) >= cutoff);
    }
    if (opts.from) items = items.filter(h => new Date(h.timestamp) >= new Date(opts.from));
    if (opts.to) {
      const toDate = typeof opts.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)
        ? new Date(opts.to + 'T23:59:59')
        : new Date(opts.to);
      items = items.filter(h => new Date(h.timestamp) <= toDate);
    }

    return items;
  }

  /* ══════════════════════════════════════════════════════════════════
     SAVED SEARCHES
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Returns all saved searches (newest first).
   */
  function getSavedSearches() {
    return readStore(SAVED_KEY);
  }

  /**
   * Saves a search. Throws if duplicate or limit reached.
   */
  function saveSearch(query, filters, name) {
    const q = (query || '').trim();
    if (!q) return null;

    const saved = getSavedSearches();
    if (saved.length >= MAX_SAVED) {
      throw new Error(`Maximum of ${MAX_SAVED} saved searches reached.`);
    }
    if (saved.some(s => s.query.toLowerCase() === q.toLowerCase())) {
      throw new Error('This search is already saved.');
    }

    const item = {
      id: uid(),
      query: q,
      filters: filters || {},
      name: (name || '').trim() || q,
      alertEnabled: false,
      createdAt: new Date().toISOString(),
    };
    saved.unshift(item);
    writeStore(SAVED_KEY, saved);

    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(item),
      }).catch(() => {});
    }
    return item;
  }

  /**
   * Deletes a saved search by id.
   */
  function deleteSavedSearch(id) {
    writeStore(SAVED_KEY, getSavedSearches().filter(s => s.id !== id));
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(),
      }).catch(() => {});
    }
  }

  /**
   * Renames a saved search.
   */
  function updateSavedSearch(id, name) {
    writeStore(SAVED_KEY, getSavedSearches().map(s =>
      s.id === id ? { ...s, name: (name || s.query).trim() } : s
    ));
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name }),
      }).catch(() => {});
    }
  }

  /**
   * Toggles alert preference for a saved search.
   * Returns the updated item.
   */
  function toggleAlert(id) {
    let updated = null;
    writeStore(SAVED_KEY, getSavedSearches().map(s => {
      if (s.id === id) { updated = { ...s, alertEnabled: !s.alertEnabled }; return updated; }
      return s;
    }));
    if (updated && isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}/alert`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ alertEnabled: updated.alertEnabled }),
      }).catch(() => {});
    }
    return updated;
  }

  /**
   * Re-executes a saved search by navigating to the search results page.
   */
  function reExecuteSearch(id) {
    const saved = getSavedSearches().find(s => s.id === id);
    if (!saved) return;
    addToHistory(saved.query);
    const params = new URLSearchParams({ q: saved.query });
    if (saved.filters && Object.keys(saved.filters).length) {
      params.set('filters', JSON.stringify(saved.filters));
    }
    // Navigate relative to the current page or fall back to common path
    const base = window.location.pathname.includes('/pages/') ? '' : 'pages/search/';
    window.location.href = `${base}index.html?${params}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     AUTO-SUGGEST
  ══════════════════════════════════════════════════════════════════ */

  const _defaultTrending = [
    'Electronics wholesale', 'Fashion clothing bulk', 'Phone accessories',
    'Home decor items', 'Beauty products', 'Shoes dropshipping',
    'Watches wholesale', 'Kids toys bulk', 'Kitchen gadgets', 'Sports equipment',
  ];

  let _cachedTrending = null;

  async function _fetchTrending() {
    if (_cachedTrending) return _cachedTrending;
    try {
      const res = await fetch(`${apiBase()}/search/trending`, { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        _cachedTrending = (json.data || json.trending || [])
          .map(t => typeof t === 'string' ? t : t.query)
          .filter(Boolean);
        if (_cachedTrending.length) return _cachedTrending;
      }
    } catch (_) { /* fall through */ }
    _cachedTrending = _defaultTrending;
    return _cachedTrending;
  }

  /**
   * Returns an array of suggestion strings matching `query`.
   * Sources: saved searches, history, trending (cached).
   */
  function getSuggestions(query) {
    const q = (query || '').trim().toLowerCase();
    const suggestions = [];
    const seen = new Set();

    const add = (text, type) => {
      if (seen.has(text.toLowerCase())) return;
      seen.add(text.toLowerCase());
      suggestions.push({ text, type });
    };

    if (q) {
      getSavedSearches()
        .filter(s => s.name.toLowerCase().includes(q) || s.query.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach(s => add(s.query, 'saved'));

      getHistory()
        .filter(h => h.query.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach(h => add(h.query, 'history'));

      (_cachedTrending || _defaultTrending)
        .filter(t => t.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach(t => add(t, 'trending'));
    } else {
      getHistory().slice(0, 6).forEach(h => add(h.query, 'history'));
      getSavedSearches().slice(0, 4).forEach(s => add(s.query, 'saved'));
      (_cachedTrending || _defaultTrending).slice(0, 5).forEach(t => add(t, 'trending'));
    }

    return suggestions;
  }

  /* ══════════════════════════════════════════════════════════════════
     IMPORT / EXPORT
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Downloads history + saved searches as a JSON file.
   */
  function exportData() {
    const data = {
      history: getHistory(),
      saved: getSavedSearches(),
      exportedAt: new Date().toISOString(),
      version: 2,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `globex-searches-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Imports history + saved searches from JSON string. Returns true on success.
   */
  function importData(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (Array.isArray(data.saved)) {
        const existing = getSavedSearches();
        const merged   = [
          ...data.saved.filter(s => !existing.some(e => e.id === s.id)),
          ...existing,
        ];
        writeStore(SAVED_KEY, merged.slice(0, MAX_SAVED));
      }
      if (Array.isArray(data.history)) {
        const existing = getHistory();
        const merged   = [
          ...data.history.filter(h => !existing.some(e => e.id === h.id)),
          ...existing,
        ];
        writeStore(HISTORY_KEY, merged.slice(0, MAX_HISTORY));
      }
      return true;
    } catch (_) { return false; }
  }

  /* ══════════════════════════════════════════════════════════════════
     SAMPLE DATA (first-load seed)
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Seeds sample saved searches and history if the store is empty and
   * has not been seeded before.
   */
  function initSampleData() {
    if (localStorage.getItem(SEEDED_KEY)) return;

    const now  = Date.now();
    const day  = 86400000;

    const sampleSaved = [
      {
        id: uid(), query: 'electronics wholesale',
        filters: { sort: 'price_asc', minPrice: 100 },
        name: 'Cheap Electronics Bulk',
        alertEnabled: true,
        createdAt: new Date(now - 2 * day).toISOString(),
      },
      {
        id: uid(), query: 'fashion clothing',
        filters: { category_id: 'apparel' },
        name: 'Fashion Clothing',
        alertEnabled: false,
        createdAt: new Date(now - 5 * day).toISOString(),
      },
      {
        id: uid(), query: 'phone accessories dropshipping',
        filters: {},
        name: 'Phone Accessories',
        alertEnabled: true,
        createdAt: new Date(now - 8 * day).toISOString(),
      },
    ];

    const sampleHistory = [
      { id: uid(), query: 'wireless headphones bulk',    timestamp: new Date(now - 30  * 60000).toISOString() },
      { id: uid(), query: 'leather bags wholesale',       timestamp: new Date(now - 2   * 3600000).toISOString() },
      { id: uid(), query: 'kitchen gadgets 2025',         timestamp: new Date(now - 5   * 3600000).toISOString() },
      { id: uid(), query: 'bluetooth speakers',           timestamp: new Date(now - 1   * day).toISOString() },
      { id: uid(), query: 'sports equipment supplier',    timestamp: new Date(now - 2   * day).toISOString() },
      { id: uid(), query: 'home decor items',             timestamp: new Date(now - 3   * day).toISOString() },
    ];

    if (!getSavedSearches().length) writeStore(SAVED_KEY, sampleSaved);
    if (!getHistory().length)       writeStore(HISTORY_KEY, sampleHistory);

    localStorage.setItem(SEEDED_KEY, '1');
  }

  /* ── Path helper ───────────────────────────────────────────────────── */
  function _searchPageUrl(page) {
    const inPages = window.location.pathname.includes('/pages/');
    return inPages ? page : `pages/search/${page}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     DROPDOWN ATTACHMENT
     Attaches a history/suggestions dropdown to a search <input>.
  ══════════════════════════════════════════════════════════════════ */

  function attach(inputEl, opts) {
    if (!inputEl) return;

    const options = {
      onSearch: null,
      showSaveBtn: false,
      ...opts,
    };

    /* Create or find dropdown container */
    const parent = inputEl.closest('.search-bar-container, .nav-search, .search-bar-wrap, .search-wrapper')
      || inputEl.parentElement;
    parent.style.position = parent.style.position || 'relative';

    let dropdown = parent.querySelector('.ss-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'ss-dropdown';
      dropdown.setAttribute('role', 'listbox');
      dropdown.setAttribute('aria-label', 'Search suggestions');
      parent.appendChild(dropdown);
    }

    /* Optional save button */
    let saveBtn = null;
    if (options.showSaveBtn) {
      saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'ss-save-btn';
      saveBtn.title = 'Save this search';
      saveBtn.setAttribute('aria-label', 'Save this search');
      saveBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
      saveBtn.style.display = 'none';
      const goBtn = parent.querySelector('.btn-search-go, .search-submit');
      goBtn ? parent.insertBefore(saveBtn, goBtn) : parent.appendChild(saveBtn);
      saveBtn.addEventListener('click', () => {
        const q = inputEl.value.trim();
        if (q) _showSaveModal(q, {});
      });
    }

    let open = false;

    function renderDropdown(val) {
      const suggestions = getSuggestions(val);
      if (!suggestions.length) { hideDropdown(); return; }

      const sections = { history: [], saved: [], trending: [] };
      suggestions.forEach(s => sections[s.type] && sections[s.type].push(s));

      let html = '';
      const q = val.trim();

      function hl(text) {
        if (!q) return escHtml(text);
        return escHtml(text).replace(
          new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          m => `<em>${m}</em>`
        );
      }

      if (sections.history.length) {
        html += `<div class="ss-section-header">
          <span><i class="fas fa-history"></i> Recent</span>
          <button class="ss-clear-btn" onclick="GlobexSky.SavedSearches.clearHistory();GlobexSky.SavedSearches._refreshDropdown()">Clear</button>
        </div>`;
        html += sections.history.map(s =>
          `<div class="ss-item ss-item--history" data-value="${escHtml(s.text)}" tabindex="-1" role="option">
            <i class="fas fa-clock"></i>
            <span class="ss-item-text">${hl(s.text)}</span>
          </div>`
        ).join('');
      }

      if (sections.saved.length) {
        html += `<div class="ss-section-header"><span><i class="fas fa-bookmark"></i> Saved</span></div>`;
        html += sections.saved.map(s =>
          `<div class="ss-item ss-item--saved" data-value="${escHtml(s.text)}" tabindex="-1" role="option">
            <i class="fas fa-star"></i>
            <span class="ss-item-text">${hl(s.text)}</span>
            <span class="ss-item-type">saved</span>
          </div>`
        ).join('');
      }

      if (sections.trending.length && !q) {
        html += `<div class="ss-section-header"><span><i class="fas fa-fire"></i> Trending</span></div>`;
        html += sections.trending.map(s =>
          `<div class="ss-item ss-item--trending" data-value="${escHtml(s.text)}" tabindex="-1" role="option">
            <i class="fas fa-arrow-trend-up"></i>
            <span class="ss-item-text">${escHtml(s.text)}</span>
            <span class="ss-item-type">trending</span>
          </div>`
        ).join('');
      }

      html += `<div class="ss-footer">
        <a href="${_searchPageUrl('search-history.html')}" class="ss-footer-link"><i class="fas fa-history"></i> All History</a>
        <a href="${_searchPageUrl('saved-searches.html')}" class="ss-footer-link"><i class="fas fa-bookmark"></i> Saved</a>
      </div>`;

      dropdown.innerHTML = html;
      dropdown.classList.add('open');
      open = true;
    }

    function hideDropdown() {
      dropdown.classList.remove('open');
      open = false;
    }

    GlobexSky.SavedSearches._refreshDropdown = () => renderDropdown(inputEl.value);

    inputEl.addEventListener('focus', () => renderDropdown(inputEl.value));
    inputEl.addEventListener('input', () => {
      if (saveBtn) saveBtn.style.display = inputEl.value.trim() ? 'flex' : 'none';
      renderDropdown(inputEl.value);
    });

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.ss-item');
      if (item && !e.target.closest('.ss-clear-btn')) {
        const val = item.dataset.value;
        inputEl.value = val;
        hideDropdown();
        if (options.onSearch) {
          options.onSearch(val);
        } else if (window.GlobexSearch && typeof GlobexSearch.search === 'function') {
          GlobexSearch.search(val);
        } else {
          window.location.href = `pages/search/index.html?q=${encodeURIComponent(val)}`;
        }
      }
    });

    document.addEventListener('click', e => {
      if (open && !parent.contains(e.target) && !dropdown.contains(e.target)) {
        hideDropdown();
      }
    });

    _fetchTrending().then(() => { if (open) renderDropdown(inputEl.value); });
  }

  /* ── Save Search Modal ─────────────────────────────────────────────── */
  function _showSaveModal(query, filters) {
    const existing = document.getElementById('ss-save-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ss-save-modal';
    modal.className = 'ss-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Save search');
    modal.innerHTML = `
      <div class="ss-modal">
        <div class="ss-modal-header">
          <h3><i class="fas fa-bookmark"></i> Save This Search</h3>
          <button class="ss-modal-close" id="ss-modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="ss-modal-body">
          <div class="ss-modal-field">
            <label for="ss-save-name">Name (optional)</label>
            <input type="text" id="ss-save-name" placeholder="${escHtml(query)}" maxlength="100"/>
          </div>
          <div class="ss-modal-query">
            <i class="fas fa-search"></i>
            <span>${escHtml(query)}</span>
          </div>
          <div id="ss-save-error" class="ss-modal-error" style="display:none"></div>
        </div>
        <div class="ss-modal-footer">
          <button class="ss-btn ss-btn--secondary" id="ss-modal-cancel">Cancel</button>
          <button class="ss-btn ss-btn--primary" id="ss-modal-confirm">
            <i class="fas fa-bookmark"></i> Save
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const nameInput = document.getElementById('ss-save-name');
    const errDiv    = document.getElementById('ss-save-error');

    function closeModal() { modal.remove(); }

    document.getElementById('ss-modal-close').addEventListener('click', closeModal);
    document.getElementById('ss-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    document.getElementById('ss-modal-confirm').addEventListener('click', () => {
      errDiv.style.display = 'none';
      try {
        saveSearch(query, filters || {}, nameInput.value);
        closeModal();
        _showToast('<i class="fas fa-check-circle"></i> Search saved!');
      } catch (err) {
        errDiv.textContent = err.message;
        errDiv.style.display = 'block';
      }
    });

    nameInput.focus();
  }

  /* ── Toast notification ────────────────────────────────────────────── */
  function _showToast(html, duration) {
    const id = 'ss-toast';
    let toast = document.getElementById(id);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = id;
      toast.className = 'ss-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = html;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), duration || 3000);
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════════ */
  return {
    /* History */
    getHistory,
    addToHistory,
    deleteHistoryItem,
    clearHistory,
    getFilteredHistory,

    /* Saved searches */
    getSavedSearches,
    saveSearch,
    deleteSavedSearch,
    updateSavedSearch,
    toggleAlert,
    reExecuteSearch,

    /* Suggestions */
    getSuggestions,

    /* Import / Export */
    exportData,
    importData,

    /* Sample data */
    initSampleData,

    /* UI helpers */
    attach,
    showSaveModal: _showSaveModal,
    showToast: _showToast,

    /* Internal (used by inline dropdown handlers) */
    _refreshDropdown: () => {},
  };

})();
