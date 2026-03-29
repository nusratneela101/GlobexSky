/**
 * Globex Sky — search-history.js
 * Feature: Saved Searches / Search History
 *
 * Exposes: window.GlobexSky.SearchHistory
 *
 * API:
 *   addToHistory(query)
 *   getHistory()
 *   clearHistory()
 *   deleteHistoryItem(id)
 *   saveSearch(query, filters, name)
 *   getSavedSearches()
 *   deleteSavedSearch(id)
 *   updateSavedSearch(id, name)
 *   toggleAlert(id)
 *   getTrending()
 */

'use strict';

window.GlobexSky = window.GlobexSky || {};

GlobexSky.SearchHistory = (() => {
  /* ── Storage keys ──────────────────────────────────────────────────── */
  const HISTORY_KEY   = 'globexSearchHistoryV2';
  const SAVED_KEY     = 'globexSavedSearches';
  const MAX_HISTORY   = 50;
  const MAX_SAVED     = 20;

  /* ── API base ──────────────────────────────────────────────────────── */
  function apiBase() {
    return (window.GlobexConfig && GlobexConfig.API_BASE_URL) ||
           (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
             ? 'http://localhost:5000/api/v1'
             : 'https://globexsky-production.up.railway.app/api/v1');
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

  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat(navigator.language || 'en', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso));
    } catch (_) { return iso; }
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
  function getHistory() {
    return readStore(HISTORY_KEY);
  }

  function addToHistory(query) {
    const q = (query || '').trim();
    if (!q) return;

    let history = getHistory().filter(h => h.query.toLowerCase() !== q.toLowerCase());
    history.unshift({ id: uid(), query: q, timestamp: new Date().toISOString() });
    history = history.slice(0, MAX_HISTORY);
    writeStore(HISTORY_KEY, history);

    // Sync to backend if logged in (fire-and-forget)
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ query: q }),
      }).catch(() => {});
    }
  }

  function deleteHistoryItem(id) {
    const history = getHistory().filter(h => h.id !== id);
    writeStore(HISTORY_KEY, history);
  }

  function clearHistory() {
    writeStore(HISTORY_KEY, []);
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/history`, {
        method: 'DELETE',
        headers: authHeader(),
      }).catch(() => {});
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SAVED SEARCHES
  ══════════════════════════════════════════════════════════════════ */
  function getSavedSearches() {
    return readStore(SAVED_KEY);
  }

  function saveSearch(query, filters, name) {
    const q = (query || '').trim();
    if (!q) return null;

    const saved = getSavedSearches();
    if (saved.length >= MAX_SAVED) {
      throw new Error(`Maximum of ${MAX_SAVED} saved searches reached.`);
    }
    // Prevent duplicates
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

    // Sync to backend if logged in
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(item),
      }).catch(() => {});
    }
    return item;
  }

  function deleteSavedSearch(id) {
    const saved = getSavedSearches().filter(s => s.id !== id);
    writeStore(SAVED_KEY, saved);
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(),
      }).catch(() => {});
    }
  }

  function updateSavedSearch(id, name) {
    const saved = getSavedSearches().map(s =>
      s.id === id ? { ...s, name: (name || s.query).trim() } : s
    );
    writeStore(SAVED_KEY, saved);
    if (isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name }),
      }).catch(() => {});
    }
  }

  function toggleAlert(id) {
    let updated = null;
    const saved = getSavedSearches().map(s => {
      if (s.id === id) { updated = { ...s, alertEnabled: !s.alertEnabled }; return updated; }
      return s;
    });
    writeStore(SAVED_KEY, saved);
    if (updated && isLoggedIn()) {
      fetch(`${apiBase()}/search/saved/${encodeURIComponent(id)}/alert`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ alertEnabled: updated.alertEnabled }),
      }).catch(() => {});
    }
    return updated;
  }

  /* ── Trending (static fallback + API) ─────────────────────────────── */
  const _defaultTrending = [
    'Electronics wholesale', 'Fashion clothing bulk', 'Phone accessories',
    'Home decor items', 'Beauty products', 'Shoes dropshipping',
    'Watches wholesale', 'Kids toys bulk', 'Kitchen gadgets', 'Sports equipment',
  ];

  let _cachedTrending = null;

  async function getTrending() {
    if (_cachedTrending) return _cachedTrending;
    try {
      const res = await fetch(`${apiBase()}/search/trending`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        _cachedTrending = (json.data || json.trending || []).map(t =>
          typeof t === 'string' ? t : t.query
        ).filter(Boolean);
        if (_cachedTrending.length) return _cachedTrending;
      }
    } catch (_) { /* fall through to default */ }
    return _defaultTrending;
  }

  /* ══════════════════════════════════════════════════════════════════
     IMPORT / EXPORT
  ══════════════════════════════════════════════════════════════════ */
  function exportData() {
    const data = { history: getHistory(), saved: getSavedSearches(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `globex-searches-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (Array.isArray(data.saved)) {
        const existing = getSavedSearches();
        const merged = [...data.saved.filter(s => !existing.some(e => e.id === s.id)), ...existing];
        writeStore(SAVED_KEY, merged.slice(0, MAX_SAVED));
      }
      if (Array.isArray(data.history)) {
        const existing = getHistory();
        const merged = [...data.history.filter(h => !existing.some(e => e.id === h.id)), ...existing];
        writeStore(HISTORY_KEY, merged.slice(0, MAX_HISTORY));
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SEARCH INPUT ENHANCEMENT
     Attaches dropdown behaviour to a search <input> element.
  ══════════════════════════════════════════════════════════════════ */
  function attach(inputEl, opts) {
    if (!inputEl) return;

    const options = {
      onSearch: null,       // function(query) — called when a suggestion is clicked
      dropdownId: null,     // existing dropdown element id to reuse
      showSaveBtn: false,   // show "Save this search" icon next to input
      ...opts,
    };

    /* Resolve / create dropdown */
    let dropdown = options.dropdownId
      ? document.getElementById(options.dropdownId)
      : null;

    if (!dropdown) {
      const wrap = inputEl.closest('.search-bar-wrap, .search-wrapper, [role="combobox"]') || inputEl.parentElement;
      // Check if a history dropdown already exists as sibling
      const existingDropdown = wrap.parentElement && wrap.parentElement.querySelector('.sh-history-dropdown');
      if (existingDropdown) {
        dropdown = existingDropdown;
      } else {
        dropdown = document.createElement('div');
        dropdown.className = 'sh-history-dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.setAttribute('aria-label', 'Search history and suggestions');
        const container = inputEl.closest('.search-bar-container, .nav-search') || wrap.parentElement;
        container.style.position = container.style.position || 'relative';
        container.appendChild(dropdown);
      }
    }

    /* Save search button */
    let saveBtn = null;
    if (options.showSaveBtn) {
      saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'sh-save-btn';
      saveBtn.title = 'Save this search';
      saveBtn.setAttribute('aria-label', 'Save this search');
      saveBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
      saveBtn.style.display = 'none';

      const wrap2 = inputEl.closest('.search-bar-wrap, .search-wrapper') || inputEl.parentElement;
      // Insert before the last search-go button if present
      const goBtn = wrap2.querySelector('.btn-search-go, .search-submit');
      goBtn ? wrap2.insertBefore(saveBtn, goBtn) : wrap2.appendChild(saveBtn);

      saveBtn.addEventListener('click', () => {
        const q = inputEl.value.trim();
        if (!q) return;
        _showSaveModal(q, {});
      });
    }

    let open = false;

    function renderDropdown(inputVal) {
      const q = (inputVal || '').trim();
      const history = getHistory();
      const saved   = getSavedSearches();
      let html = '';

      if (!q) {
        // History section
        if (history.length) {
          html += `<div class="sh-section-header">
            <span><i class="fas fa-history"></i> Recent Searches</span>
            <button class="sh-clear-btn" onclick="GlobexSky.SearchHistory.clearHistory();GlobexSky.SearchHistory._refreshDropdown()">Clear</button>
          </div>`;
          html += history.slice(0, 8).map(h =>
            `<div class="sh-item sh-item--history" data-value="${escHtml(h.query)}" tabindex="-1" role="option">
              <i class="fas fa-clock"></i>
              <span class="sh-item-text">${escHtml(h.query)}</span>
              <span class="sh-item-time">${fmtDate(h.timestamp)}</span>
              <button class="sh-delete-item" data-id="${escHtml(h.id)}" title="Remove" aria-label="Remove from history" onclick="event.stopPropagation();GlobexSky.SearchHistory.deleteHistoryItem('${escHtml(h.id)}');GlobexSky.SearchHistory._refreshDropdown()"><i class="fas fa-times"></i></button>
            </div>`
          ).join('');
        }

        // Saved section
        if (saved.length) {
          html += `<div class="sh-section-header"><span><i class="fas fa-bookmark"></i> Saved Searches</span></div>`;
          html += saved.slice(0, 5).map(s =>
            `<div class="sh-item sh-item--saved" data-value="${escHtml(s.query)}" tabindex="-1" role="option">
              <i class="fas fa-star"></i>
              <span class="sh-item-text">${escHtml(s.name || s.query)}</span>
              ${s.alertEnabled ? '<span class="sh-alert-badge" title="Alert on"><i class="fas fa-bell"></i></span>' : ''}
              <span class="sh-item-type">saved</span>
            </div>`
          ).join('');
        }

        // Trending (rendered synchronously from cache if available)
        const trending = _cachedTrending || _defaultTrending;
        if (trending.length) {
          html += `<div class="sh-section-header"><span><i class="fas fa-fire"></i> Trending</span></div>`;
          html += trending.slice(0, 5).map(t =>
            `<div class="sh-item sh-item--trending" data-value="${escHtml(t)}" tabindex="-1" role="option">
              <i class="fas fa-arrow-trend-up"></i>
              <span class="sh-item-text">${escHtml(t)}</span>
              <span class="sh-item-type">trending</span>
            </div>`
          ).join('');
        }
      } else {
        // Filter history/saved by current input
        const histMatches = history.filter(h => h.query.toLowerCase().includes(q.toLowerCase())).slice(0, 4);
        const savedMatches = saved.filter(s => s.query.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3);

        histMatches.forEach(h => {
          const hl = escHtml(h.query).replace(
            new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            m => `<em>${m}</em>`
          );
          html += `<div class="sh-item sh-item--history" data-value="${escHtml(h.query)}" tabindex="-1" role="option">
            <i class="fas fa-clock"></i>
            <span class="sh-item-text">${hl}</span>
          </div>`;
        });

        savedMatches.forEach(s => {
          const hl = escHtml(s.name || s.query).replace(
            new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            m => `<em>${m}</em>`
          );
          html += `<div class="sh-item sh-item--saved" data-value="${escHtml(s.query)}" tabindex="-1" role="option">
            <i class="fas fa-star"></i>
            <span class="sh-item-text">${hl}</span>
            <span class="sh-item-type">saved</span>
          </div>`;
        });
      }

      if (!html) {
        hideDropdown();
        return;
      }

      // Footer
      html += `<div class="sh-footer">
        <a href="pages/search/search-history.html" class="sh-footer-link"><i class="fas fa-history"></i> All History</a>
        <a href="pages/search/saved-searches.html" class="sh-footer-link"><i class="fas fa-bookmark"></i> Manage Saved</a>
      </div>`;

      dropdown.innerHTML = html;
      dropdown.classList.add('open');
      open = true;
    }

    function hideDropdown() {
      dropdown.classList.remove('open');
      open = false;
    }

    // Public refresh hook (used by inline event handlers in dropdown HTML)
    GlobexSky.SearchHistory._refreshDropdown = () => renderDropdown(inputEl.value);

    // Event listeners
    inputEl.addEventListener('focus', () => renderDropdown(inputEl.value));

    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim();
      if (saveBtn) saveBtn.style.display = q ? 'flex' : 'none';
      renderDropdown(inputEl.value);
    });

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.sh-item');
      if (item && !e.target.closest('.sh-delete-item')) {
        const val = item.dataset.value;
        inputEl.value = val;
        hideDropdown();
        if (options.onSearch) {
          options.onSearch(val);
        } else {
          // Try to trigger the existing GlobexSearch.search if available
          if (window.GlobexSearch && typeof GlobexSearch.search === 'function') {
            GlobexSearch.search(val);
          } else {
            // Navigate to search page
            window.location.href = `pages/search/index.html?q=${encodeURIComponent(val)}`;
          }
        }
      }
    });

    document.addEventListener('click', e => {
      const container = inputEl.closest('.search-bar-container, .nav-search, .search-bar-wrap, .search-wrapper');
      if (open && container && !container.contains(e.target) && !dropdown.contains(e.target)) {
        hideDropdown();
      }
    });

    // Pre-load trending
    getTrending().then(() => {
      if (open) renderDropdown(inputEl.value);
    });
  }

  /* ── Save Search Modal ─────────────────────────────────────────────── */
  function _showSaveModal(query, filters) {
    const existing = document.getElementById('sh-save-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sh-save-modal';
    modal.className = 'sh-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Save search');
    modal.innerHTML = `
      <div class="sh-modal">
        <div class="sh-modal-header">
          <h3><i class="fas fa-bookmark"></i> Save This Search</h3>
          <button class="sh-modal-close" id="sh-modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="sh-modal-body">
          <div class="sh-modal-field">
            <label for="sh-save-name">Name (optional)</label>
            <input type="text" id="sh-save-name" placeholder="${escHtml(query)}" maxlength="100"/>
          </div>
          <div class="sh-modal-query">
            <i class="fas fa-search"></i>
            <span>${escHtml(query)}</span>
          </div>
          <div id="sh-save-error" class="sh-modal-error" style="display:none"></div>
        </div>
        <div class="sh-modal-footer">
          <button class="sh-btn sh-btn--secondary" id="sh-modal-cancel">Cancel</button>
          <button class="sh-btn sh-btn--primary" id="sh-modal-save"><i class="fas fa-bookmark"></i> Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const nameInput = modal.querySelector('#sh-save-name');
    nameInput.focus();

    function close() { modal.remove(); }

    modal.querySelector('#sh-modal-close').addEventListener('click', close);
    modal.querySelector('#sh-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#sh-modal-save').addEventListener('click', () => {
      try {
        const name = nameInput.value.trim();
        saveSearch(query, filters, name || query);
        close();
        _showToast('Search saved! <a href="pages/search/saved-searches.html">View all</a>');
      } catch (err) {
        const errEl = modal.querySelector('#sh-save-error');
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }

  /* ── Toast notification ──────────────────────────────────────────── */
  function _showToast(html, duration = 3000) {
    const existing = document.querySelector('.sh-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'sh-toast';
    toast.innerHTML = html;
    document.body.appendChild(toast);
    // Animate in
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ── Auto-attach on DOMContentLoaded ─────────────────────────────── */
  function _autoAttach() {
    // pages/search/index.html search bar
    const mainInput = document.getElementById('main-search-input');
    if (mainInput) {
      attach(mainInput, {
        dropdownId: 'search-suggestions',
        showSaveBtn: true,
        onSearch: q => {
          if (window.GlobexSearch && typeof GlobexSearch.search === 'function') {
            GlobexSearch.search(q);
          }
        },
      });
    }

    // index.html navbar search bar
    const navInput = document.querySelector('.nav-search .search-input');
    if (navInput && navInput !== mainInput) {
      attach(navInput, {
        showSaveBtn: false,
        onSearch: q => {
          window.location.href = `pages/search/index.html?q=${encodeURIComponent(q)}`;
        },
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoAttach);
  } else {
    _autoAttach();
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  return {
    addToHistory,
    getHistory,
    clearHistory,
    deleteHistoryItem,
    saveSearch,
    getSavedSearches,
    deleteSavedSearch,
    updateSavedSearch,
    toggleAlert,
    getTrending,
    exportData,
    importData,
    attach,
    showSaveModal: _showSaveModal,
    _refreshDropdown: () => {},
  };
})();
