/**
 * Globex Sky — search.js
 * Feature 1: Text Search with Auto-complete
 * Feature 2: Voice Search
 * Feature 3: Image Search
 * Feature 4: Barcode Scanner
 */

'use strict';

/* ── Constants ─────────────────────────────────────────────────────────── */
const SEARCH_HISTORY_KEY = 'globexSearchHistory';
const MAX_HISTORY = 20;
const TRENDING = [
  'Electronics wholesale', 'Fashion clothing bulk', 'Phone accessories',
  'Home decor items', 'Beauty products supplier', 'Shoes dropshipping',
  'Watches wholesale', 'Kids toys bulk', 'Kitchen gadgets', 'Sports equipment',
];

/* ── Utilities ──────────────────────────────────────────────────────────── */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapeHtml(text).replace(re, '<em>$1</em>');
}

/* ── Search History ─────────────────────────────────────────────────────── */
function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; }
  catch (_) { return []; }
}

function saveToHistory(q) {
  const query = (q || '').trim();
  if (!query) return;
  let history = getSearchHistory().filter(h => h.toLowerCase() !== query.toLowerCase());
  history.unshift(query);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

/* ── URL Sync ────────────────────────────────────────────────────────────── */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function updateUrlParam(name, value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState({}, '', url.toString());
}

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 1 — TEXT SEARCH + AUTO-COMPLETE
════════════════════════════════════════════════════════════════════════ */
const GlobexSearch = (() => {
  let currentQuery = '';
  let suggestionsData = [];
  let focusedIndex = -1;

  /* ── DOM refs (set in init) ────────────────────────────────────────── */
  let inputEl, dropdownEl, clearBtn, resultsGrid, resultsCount, spellEl, paginationEl;
  let currentPage = 1;
  let totalResults = 0;
  let activeFilters = {};

  /* ── Fetch Autocomplete from API ──────────────────────────────────── */
  async function fetchSuggestions(q) {
    if (q.length < 2) return [];
    try {
      const data = await window.API.get(`/search/autocomplete?q=${encodeURIComponent(q)}&limit=10`);
      return data.suggestions || [];
    } catch (_) {
      // Fallback to trending/history matches
      return TRENDING.filter(t => t.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    }
  }

  /* ── Render Dropdown ──────────────────────────────────────────────── */
  function renderDropdown(q) {
    if (!dropdownEl) return;
    const history = getSearchHistory();
    let html = '';

    if (!q) {
      // Show history + trending when empty
      if (history.length > 0) {
        html += `<div class="suggestions-header">Recent Searches <button onclick="GlobexSearch.clearHistory()" data-i18n="search.clearHistory">Clear</button></div>`;
        html += history.slice(0, 5).map((h, i) =>
          `<div class="suggestion-item" data-idx="${i}" data-value="${escapeHtml(h)}" tabindex="-1" role="option">
            <i class="fas fa-history"></i>
            <span class="suggestion-text">${escapeHtml(h)}</span>
            <span class="suggestion-type">recent</span>
          </div>`).join('');
      }
      if (TRENDING.length > 0) {
        html += `<div class="suggestions-header">Trending</div>`;
        html += TRENDING.slice(0, 5).map((t, i) =>
          `<div class="suggestion-item" data-idx="${i + 10}" data-value="${escapeHtml(t)}" tabindex="-1" role="option">
            <i class="fas fa-fire"></i>
            <span class="suggestion-text">${escapeHtml(t)}</span>
            <span class="suggestion-type">trending</span>
          </div>`).join('');
      }
    } else {
      html += suggestionsData.map((s, i) =>
        `<div class="suggestion-item" data-idx="${i}" data-value="${escapeHtml(s)}" tabindex="-1" role="option">
          <i class="fas fa-search"></i>
          <span class="suggestion-text">${highlightMatch(s, q)}</span>
        </div>`).join('');

      if (history.length > 0) {
        const histMatches = history.filter(h => h.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
        if (histMatches.length > 0) {
          html += `<div class="suggestions-header">From history</div>`;
          html += histMatches.map((h, i) =>
            `<div class="suggestion-item" data-idx="${i + 100}" data-value="${escapeHtml(h)}" tabindex="-1" role="option">
              <i class="fas fa-history"></i>
              <span class="suggestion-text">${highlightMatch(h, q)}</span>
            </div>`).join('');
        }
      }
    }

    if (!html) { dropdownEl.classList.remove('open'); return; }

    if (history.length > 0 || suggestionsData.length > 0) {
      html += `<div class="suggestions-footer">
        <button onclick="GlobexSearch.clearHistory()"><i class="fas fa-trash-alt"></i> Clear history</button>
        <span>${history.length} saved searches</span>
      </div>`;
    }

    dropdownEl.innerHTML = html;
    dropdownEl.classList.add('open');
    focusedIndex = -1;
  }

  function hideDropdown() {
    if (dropdownEl) dropdownEl.classList.remove('open');
    focusedIndex = -1;
  }

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  function navigateDropdown(dir) {
    if (!dropdownEl || !dropdownEl.classList.contains('open')) return;
    const items = [...dropdownEl.querySelectorAll('.suggestion-item')];
    focusedIndex = Math.max(-1, Math.min(items.length - 1, focusedIndex + dir));
    items.forEach((el, i) => el.classList.toggle('focused', i === focusedIndex));
    if (focusedIndex >= 0) {
      inputEl.value = items[focusedIndex].dataset.value;
    }
  }

  /* ── Perform Search ───────────────────────────────────────────────── */
  async function performSearch(q, page = 1, filters = {}) {
    currentQuery = q;
    currentPage = page;
    updateUrlParam('q', q);
    updateUrlParam('page', page > 1 ? page : null);

    if (q) saveToHistory(q);
    hideDropdown();
    showSkeleton();

    try {
      const params = new URLSearchParams({ q, page, limit: 20, ...filters });
      const data = await window.API.get(`/search?${params}`);
      totalResults = data.meta?.total || 0;
      renderResults(data.data || [], q, data.suggestion);
      renderPagination(totalResults, page);
      if (resultsCount) {
        resultsCount.innerHTML = `<strong>${totalResults.toLocaleString()}</strong> results for "<strong>${escapeHtml(q)}</strong>"`;
      }
    } catch (err) {
      showError(err);
    }
  }

  /* ── Render Results ───────────────────────────────────────────────── */
  function renderResults(products, q, suggestion) {
    if (!resultsGrid) return;

    if (spellEl && suggestion) {
      spellEl.innerHTML = `Did you mean: <a href="#" onclick="GlobexSearch.search('${escapeHtml(suggestion)}');return false;">${escapeHtml(suggestion)}</a>?`;
      spellEl.classList.add('visible');
    } else if (spellEl) {
      spellEl.classList.remove('visible');
    }

    if (!products || products.length === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <h3>No results found</h3>
          <p>Try different keywords or use filters to broaden your search.</p>
          <button class="btn-try-again" onclick="GlobexSearch.clearSearch()">Clear Search</button>
        </div>`;
      return;
    }

    resultsGrid.innerHTML = products.map(p => renderProductCard(p)).join('');
  }

  function renderProductCard(p) {
    const img = p.images?.[0] || '';
    const price = p.price ? `$${parseFloat(p.price).toFixed(2)}` : 'Contact for price';
    const rating = p.average_rating ? Math.round(p.average_rating) : 0;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const supplier = p.supplier?.company_name || 'Supplier';
    const verified = p.supplier?.verified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    const imgHtml = img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.title || '')}" loading="lazy">` : `<span class="product-img-placeholder"><i class="fas fa-box"></i></span>`;

    return `<div class="product-card" onclick="window.location.href='/pages/sourcing/product-detail.html?id=${escapeHtml(p.id || '')}'">
      <div class="product-img-wrap">${imgHtml}</div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.title || 'Product')}</div>
        <div class="product-supplier">${verified}${escapeHtml(supplier)}</div>
        <div class="product-price">${price}</div>
        <div class="product-footer">
          <div class="product-rating"><span class="stars">${stars}</span>(${rating})</div>
          ${p.moq ? `<div class="product-moq">MOQ: ${p.moq}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ── Skeleton Loading ─────────────────────────────────────────────── */
  function showSkeleton() {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = Array(8).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-price"></div>
        </div>
      </div>`).join('');
  }

  function showError(err) {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = `<div class="empty-state">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Search failed</h3>
      <p>Please try again. ${err?.message || ''}</p>
      <button class="btn-try-again" onclick="GlobexSearch.search('${escapeHtml(currentQuery)}')">Retry</button>
    </div>`;
  }

  /* ── Pagination ───────────────────────────────────────────────────── */
  function renderPagination(total, page) {
    if (!paginationEl) return;
    const totalPages = Math.ceil(total / 20);
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="GlobexSearch.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
      html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="GlobexSearch.goToPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="GlobexSearch.goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    paginationEl.innerHTML = html;
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  function init() {
    inputEl = document.getElementById('main-search-input');
    dropdownEl = document.getElementById('search-suggestions');
    clearBtn = document.getElementById('btn-clear-search');
    resultsGrid = document.getElementById('products-grid');
    resultsCount = document.getElementById('results-count');
    spellEl = document.getElementById('spell-suggest');
    paginationEl = document.getElementById('pagination');

    if (!inputEl) return;

    const debouncedSuggest = debounce(async (q) => {
      suggestionsData = q.length >= 2 ? await fetchSuggestions(q) : [];
      renderDropdown(q);
    }, 300);

    inputEl.addEventListener('input', e => {
      const val = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('visible', !!val);
      debouncedSuggest(val);
    });

    inputEl.addEventListener('focus', () => renderDropdown(inputEl.value));

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateDropdown(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); navigateDropdown(-1); }
      else if (e.key === 'Escape') { hideDropdown(); inputEl.blur(); }
      else if (e.key === 'Enter') { e.preventDefault(); performSearch(inputEl.value.trim(), 1, activeFilters); }
    });

    // Suggestion click
    if (dropdownEl) {
      dropdownEl.addEventListener('click', e => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
          inputEl.value = item.dataset.value;
          performSearch(item.dataset.value, 1, activeFilters);
        }
      });
    }

    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputEl.value = '';
        clearBtn.classList.remove('visible');
        hideDropdown();
        inputEl.focus();
        if (resultsGrid) resultsGrid.innerHTML = '';
        if (resultsCount) resultsCount.innerHTML = '';
        updateUrlParam('q', null);
      });
    }

    // Search button
    const searchBtn = document.getElementById('btn-search-go');
    if (searchBtn) searchBtn.addEventListener('click', () => performSearch(inputEl.value.trim(), 1, activeFilters));

    // Close on outside click
    document.addEventListener('click', e => {
      if (!inputEl.closest('.search-bar-container')?.contains(e.target)) hideDropdown();
    });

    // Sort change
    const sortSel = document.getElementById('sort-select');
    if (sortSel) {
      sortSel.addEventListener('change', () => {
        if (currentQuery) performSearch(currentQuery, 1, { ...activeFilters, sort: sortSel.value });
      });
    }

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (resultsGrid) resultsGrid.classList.toggle('list-view', btn.dataset.view === 'list');
      });
    });

    // Run initial search from URL
    const urlQ = getQueryParam('q');
    if (urlQ) {
      inputEl.value = urlQ;
      if (clearBtn) clearBtn.classList.add('visible');
      performSearch(urlQ, +(getQueryParam('page') || 1), activeFilters);
    }
  }

  return {
    init,
    search: (q, page = 1) => { if (inputEl) inputEl.value = q; performSearch(q, page, activeFilters); },
    goToPage: (p) => performSearch(currentQuery, p, activeFilters),
    clearSearch: () => { if (inputEl) { inputEl.value = ''; if (clearBtn) clearBtn.classList.remove('visible'); } if (resultsGrid) resultsGrid.innerHTML = ''; if (resultsCount) resultsCount.innerHTML = ''; },
    clearHistory: () => { clearSearchHistory(); hideDropdown(); renderDropdown(''); },
    setFilters: (f) => { activeFilters = f; if (currentQuery || Object.keys(f).length) performSearch(currentQuery, 1, f); },
    renderProductCard,
  };
})();

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 2 — VOICE SEARCH
════════════════════════════════════════════════════════════════════════ */
const GlobexVoice = (() => {
  let recognition = null;
  let overlayEl, statusEl, interimEl;

  function showOverlay() { if (overlayEl) overlayEl.classList.add('open'); }
  function hideOverlay() { if (overlayEl) overlayEl.classList.remove('open'); }

  function init() {
    overlayEl = document.getElementById('voice-overlay');
    statusEl = document.getElementById('voice-status');
    interimEl = document.getElementById('voice-interim');
    const cancelBtn = document.getElementById('voice-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', stop);

    const micBtn = document.getElementById('btn-mic');
    if (micBtn) micBtn.addEventListener('click', start);
  }

  function start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in this browser. Please try Chrome.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = localStorage.getItem('globexLang') || navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    if (statusEl) statusEl.textContent = 'Listening…';
    if (interimEl) interimEl.textContent = '';
    showOverlay();

    const micBtn = document.getElementById('btn-mic');
    if (micBtn) micBtn.classList.add('listening');

    recognition.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interimEl) interimEl.textContent = interim || final;
      if (final) {
        hideOverlay();
        const input = document.getElementById('main-search-input');
        if (input) { input.value = final; const clearBtn = document.getElementById('btn-clear-search'); if (clearBtn) clearBtn.classList.add('visible'); }
        GlobexSearch.search(final.trim());
        if (micBtn) micBtn.classList.remove('listening');
      }
    };

    recognition.onerror = e => {
      if (statusEl) statusEl.textContent = `Error: ${e.error}`;
      setTimeout(hideOverlay, 1500);
      if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
      if (overlayEl?.classList.contains('open')) hideOverlay();
      if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.start();
  }

  function stop() {
    if (recognition) { recognition.stop(); recognition = null; }
    hideOverlay();
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) micBtn.classList.remove('listening');
  }

  return { init, start, stop };
})();

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 3 — IMAGE SEARCH
════════════════════════════════════════════════════════════════════════ */
const GlobexImageSearch = (() => {
  let modalEl, dropZoneEl, fileInputEl, imgPreviewEl, searchBtnEl;

  function init() {
    modalEl = document.getElementById('image-search-modal');
    dropZoneEl = document.getElementById('drop-zone');
    fileInputEl = document.getElementById('image-file-input');
    imgPreviewEl = document.getElementById('img-preview');
    searchBtnEl = document.getElementById('btn-image-search');

    const imgBtn = document.getElementById('btn-img');
    if (imgBtn) imgBtn.addEventListener('click', open);

    const closeBtn = document.getElementById('close-image-modal');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Drag and drop
    if (dropZoneEl) {
      dropZoneEl.addEventListener('dragover', e => { e.preventDefault(); dropZoneEl.classList.add('dragover'); });
      dropZoneEl.addEventListener('dragleave', () => dropZoneEl.classList.remove('dragover'));
      dropZoneEl.addEventListener('drop', e => {
        e.preventDefault();
        dropZoneEl.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFile(file);
      });
    }

    // Browse button
    const browseBtn = document.getElementById('btn-browse-image');
    if (browseBtn) browseBtn.addEventListener('click', () => fileInputEl?.click());

    if (fileInputEl) {
      fileInputEl.addEventListener('change', () => {
        const file = fileInputEl.files[0];
        if (file) handleFile(file);
      });
    }

    if (searchBtnEl) searchBtnEl.addEventListener('click', performImageSearch);

    // Close on overlay click
    if (modalEl) {
      modalEl.addEventListener('click', e => { if (e.target === modalEl) close(); });
    }
  }

  function open() { if (modalEl) modalEl.classList.add('open'); }
  function close() { if (modalEl) modalEl.classList.remove('open'); }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      if (imgPreviewEl) { imgPreviewEl.src = e.target.result; imgPreviewEl.classList.add('visible'); }
      if (searchBtnEl) searchBtnEl.classList.add('visible');
      if (dropZoneEl) dropZoneEl.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  async function performImageSearch() {
    if (!imgPreviewEl?.src) return;
    if (searchBtnEl) { searchBtnEl.disabled = true; searchBtnEl.textContent = 'Searching…'; }

    try {
      // Send base64 data if src is a data URL, otherwise send the URL directly
      const src = imgPreviewEl.src;
      const payload = src.startsWith('data:') ? { imageBase64: src } : { imageUrl: src };
      const data = await window.API.post('/search/image', payload);
      close();
      const resultsGrid = document.getElementById('products-grid');
      if (resultsGrid) {
        resultsGrid.innerHTML = (data.data || []).map(p => GlobexSearch.renderProductCard(p)).join('');
      }
      const resultsCount = document.getElementById('results-count');
      if (resultsCount) resultsCount.innerHTML = `<strong>${(data.data || []).length}</strong> visually similar products`;
    } catch (err) {
      alert('Image search failed. Please try again.');
    } finally {
      if (searchBtnEl) { searchBtnEl.disabled = false; searchBtnEl.textContent = 'Search by Image'; }
    }
  }

  return { init, open, close };
})();

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 4 — BARCODE SCANNER
════════════════════════════════════════════════════════════════════════ */
const GlobexBarcode = (() => {
  let modalEl, statusEl, videoEl;

  function init() {
    modalEl = document.getElementById('barcode-modal');
    statusEl = document.getElementById('barcode-status');
    videoEl = document.getElementById('barcode-video');

    const barcodeBtn = document.getElementById('btn-barcode');
    if (barcodeBtn) barcodeBtn.addEventListener('click', open);

    const closeBtn = document.getElementById('close-barcode-modal');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Manual entry
    const manualBtn = document.getElementById('btn-barcode-manual');
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        const input = document.getElementById('barcode-manual-input');
        if (input?.value.trim()) lookupBarcode(input.value.trim());
      });
    }

    // Manual enter key
    const manualInput = document.getElementById('barcode-manual-input');
    if (manualInput) {
      manualInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && manualInput.value.trim()) lookupBarcode(manualInput.value.trim());
      });
    }

    if (modalEl) modalEl.addEventListener('click', e => { if (e.target === modalEl) close(); });
  }

  function open() {
    if (modalEl) modalEl.classList.add('open');
    if (statusEl) statusEl.textContent = 'Point camera at a barcode…';
    startScanner();
  }

  function close() {
    if (modalEl) modalEl.classList.remove('open');
    stopScanner();
  }

  function startScanner() {
    if (typeof Quagga !== 'undefined') {
      _initQuagga();
      return;
    }

    // Load QuaggaJS dynamically with Subresource Integrity
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
    script.integrity = 'sha384-LMgrMGgOB4PK+LT2q9VqhGCGd8VEDIwxBVLAD07oKJHBIerBiIlg8aCcMEY3bPE';
    script.crossOrigin = 'anonymous';
    script.onload = _initQuagga;
    script.onerror = () => {
      if (statusEl) statusEl.textContent = 'Scanner library failed to load. Use manual entry below.';
    };
    document.head.appendChild(script);
  }

  function _initQuagga() {
    if (typeof Quagga === 'undefined') {
      if (statusEl) statusEl.textContent = 'Scanner library not loaded. Use manual entry below.';
      return;
    }

    Quagga.init({
      inputStream: { name: 'Live', type: 'LiveStream', target: videoEl, constraints: { facingMode: 'environment' } },
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader', 'code_39_reader'] },
    }, err => {
      if (err) { if (statusEl) statusEl.textContent = 'Camera access denied. Use manual entry.'; return; }
      Quagga.start();
    });

    Quagga.onDetected(result => {
      const code = result.codeResult.code;
      if (code) { stopScanner(); close(); lookupBarcode(code); }
    });
  }

  function stopScanner() {
    if (typeof Quagga !== 'undefined') {
      try { Quagga.stop(); } catch (_) {}
    }
  }

  async function lookupBarcode(code) {
    const input = document.getElementById('main-search-input');
    if (input) { input.value = code; const clearBtn = document.getElementById('btn-clear-search'); if (clearBtn) clearBtn.classList.add('visible'); }

    const resultsGrid = document.getElementById('products-grid');
    if (resultsGrid) resultsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Looking up barcode…</p></div>';

    try {
      const data = await window.API.get(`/search/barcode/${encodeURIComponent(code)}`);
      if (resultsGrid) resultsGrid.innerHTML = (data.data || []).map(p => GlobexSearch.renderProductCard(p)).join('');
      const resultsCount = document.getElementById('results-count');
      if (resultsCount) resultsCount.innerHTML = `Barcode <strong>${escapeHtml(code)}</strong>: ${(data.data || []).length} product(s)`;
    } catch (err) {
      if (resultsGrid) resultsGrid.innerHTML = `<div class="empty-state"><i class="fas fa-barcode"></i><h3>Product not found</h3><p>No product found for barcode: ${escapeHtml(code)}</p></div>`;
    }
  }

  return { init, open, close };
})();

/* ════════════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  GlobexSearch.init();
  GlobexVoice.init();
  GlobexImageSearch.init();
  GlobexBarcode.init();
});

window.GlobexSearch = GlobexSearch;
window.GlobexVoice = GlobexVoice;
window.GlobexImageSearch = GlobexImageSearch;
window.GlobexBarcode = GlobexBarcode;
