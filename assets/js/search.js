/**
 * GlobexSky - search.js
 * Search functionality: live product filter, debounce, voice search,
 * image search, suggestions dropdown, clear button, and search history.
 */

const SEARCH_HISTORY_KEY = 'globexSearchHistory';
const MAX_HISTORY = 5;

/* ─────────────────────────────────────────────
   DEBOUNCE UTILITY
───────────────────────────────────────────── */

/**
 * Return a debounced version of a function.
 * @param {Function} fn
 * @param {number} delay - Milliseconds to wait after last call.
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ─────────────────────────────────────────────
   SEARCH HISTORY
───────────────────────────────────────────── */
function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || [];
  } catch (_) {
    return [];
  }
}

function saveToHistory(query) {
  const q = query.trim();
  if (!q) return;

  let history = getSearchHistory().filter((h) => h.toLowerCase() !== q.toLowerCase());
  history.unshift(q);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

/* ─────────────────────────────────────────────
   MOCK SUGGESTIONS
   Replace with a real API call for production.
───────────────────────────────────────────── */
const MOCK_SUGGESTIONS = [
  'Electronics wholesale',
  'Fashion clothing bulk',
  'Phone accessories',
  'Home decor items',
  'Beauty products supplier',
  'Shoes dropshipping',
  'Watches wholesale',
  'Kids toys bulk',
  'Kitchen gadgets',
  'Sports equipment',
  'Jewelry supplier',
  'Automotive parts',
  'Industrial tools',
  'Office supplies bulk',
];

function getMockSuggestions(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return MOCK_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q)).slice(0, 6);
}

/* ─────────────────────────────────────────────
   SUGGESTIONS DROPDOWN
───────────────────────────────────────────── */
function renderSuggestions(input, suggestionsEl, query) {
  if (!suggestionsEl) return;

  const query_trimmed = query.trim();
  const history = getSearchHistory();
  const suggestions = getMockSuggestions(query_trimmed);

  let html = '';

  // Recent searches
  if (!query_trimmed && history.length > 0) {
    html += `<div class="suggestion-group-label">Recent searches</div>`;
    html += history
      .map(
        (h) =>
          `<div class="suggestion-item suggestion-history" role="option" tabindex="0" data-value="${escapeHtml(h)}">
            <span class="suggestion-icon">🕐</span>${escapeHtml(h)}
           </div>`
      )
      .join('');

    html += `<div class="suggestion-clear-history" data-action="clear-history">Clear history</div>`;
  }

  // Query-matched suggestions
  if (query_trimmed && suggestions.length > 0) {
    html += suggestions
      .map(
        (s) =>
          `<div class="suggestion-item" role="option" tabindex="0" data-value="${escapeHtml(s)}">
            <span class="suggestion-icon">🔍</span>${escapeHtml(s)}
           </div>`
      )
      .join('');
  }

  if (!html) {
    suggestionsEl.classList.remove('suggestions-open');
    return;
  }

  suggestionsEl.innerHTML = html;
  suggestionsEl.classList.add('suggestions-open');
  suggestionsEl.setAttribute('aria-expanded', 'true');
}

function hideSuggestions(suggestionsEl) {
  if (!suggestionsEl) return;
  suggestionsEl.classList.remove('suggestions-open');
  suggestionsEl.setAttribute('aria-expanded', 'false');
}

/* ─────────────────────────────────────────────
   LIVE PRODUCT FILTER
───────────────────────────────────────────── */

/**
 * Filter `.product-card` elements on the page by a search query.
 * Matches against product name, description, and category text.
 * @param {string} query
 */
function filterProducts(query) {
  const cards = document.querySelectorAll('.product-card, [data-product-card]');
  if (!cards.length) return;

  const q = query.toLowerCase().trim();
  let visibleCount = 0;

  cards.forEach((card) => {
    const searchableText = [
      card.querySelector('.product-name, .product-title, h3, h4')?.textContent || '',
      card.querySelector('.product-description, .product-desc, p')?.textContent || '',
      card.querySelector('.product-category, .category-tag')?.textContent || '',
      card.dataset.searchTags || '',
    ]
      .join(' ')
      .toLowerCase();

    const isMatch = !q || searchableText.includes(q);
    card.style.display = isMatch ? '' : 'none';
    if (isMatch) visibleCount++;
  });

  // Show/hide empty-state message
  const emptyState = document.querySelector('.search-empty-state, .no-results');
  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? '' : 'none';
  } else if (visibleCount === 0 && q) {
    // Create a temporary empty-state element if one doesn't exist
    const grid = document.querySelector('.products-grid, .product-list, .products-container');
    if (grid && !grid.querySelector('.search-empty-state')) {
      const msg = document.createElement('p');
      msg.className = 'search-empty-state';
      msg.textContent = `No products found for "${query}".`;
      grid.appendChild(msg);
    }
  }

  // Update result count display if present
  const countEl = document.querySelector('.search-result-count, [data-search-count]');
  if (countEl) {
    countEl.textContent = q ? `${visibleCount} result${visibleCount !== 1 ? 's' : ''} for "${query}"` : '';
  }
}

/* ─────────────────────────────────────────────
   VOICE SEARCH
───────────────────────────────────────────── */

/**
 * Start voice search using the Web Speech API.
 * Falls back gracefully if the API is unavailable.
 * @param {HTMLInputElement} inputEl - The search input to populate.
 * @param {Function} [onResult] - Callback receiving the transcript string.
 */
function startVoiceSearch(inputEl, onResult) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (window.GlobexSky?.showToast) {
      window.GlobexSky.showToast('Voice search is not supported in this browser.', 'warning');
    } else {
      alert('Voice search is not supported in this browser.');
    }
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = localStorage.getItem('globexLang') || 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // Visual feedback
  const voiceBtn = document.querySelector('.voice-search-btn, [data-action="voice-search"]');
  if (voiceBtn) voiceBtn.classList.add('listening');

  recognition.start();

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    if (inputEl) {
      inputEl.value = transcript;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof onResult === 'function') onResult(transcript);
    saveToHistory(transcript);
  };

  recognition.onerror = (e) => {
    console.warn('[GlobexSky Search] Voice recognition error:', e.error);
    if (window.GlobexSky?.showToast) {
      window.GlobexSky.showToast('Could not recognize voice. Please try again.', 'error');
    }
  };

  recognition.onend = () => {
    if (voiceBtn) voiceBtn.classList.remove('listening');
  };
}

/* ─────────────────────────────────────────────
   IMAGE SEARCH
───────────────────────────────────────────── */
function initImageSearch() {
  const imageSearchBtn = document.querySelector('.image-search-btn, [data-action="image-search"]');
  if (!imageSearchBtn) return;

  // Create a hidden file input
  let fileInput = document.getElementById('image-search-input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'image-search-input';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  imageSearchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      // Show a preview thumbnail near the search bar
      let preview = document.querySelector('.image-search-preview');
      if (!preview) {
        preview = document.createElement('div');
        preview.className = 'image-search-preview';
        const searchBar = imageSearchBtn.closest('.search-bar, .search-wrapper, form');
        if (searchBar) searchBar.appendChild(preview);
      }

      preview.innerHTML = `
        <img src="${e.target.result}" alt="Search image preview" class="image-preview-thumb">
        <span class="image-preview-name">${escapeHtml(file.name)}</span>
        <button class="image-preview-remove" aria-label="Remove image">&times;</button>
      `;

      preview.querySelector('.image-preview-remove')?.addEventListener('click', () => {
        preview.remove();
        fileInput.value = '';
      });

      // Placeholder: trigger actual image search
      if (window.GlobexSky?.showToast) {
        window.GlobexSky.showToast('Image search is not yet connected to a backend.', 'info');
      }
    };

    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────
   MAIN SEARCH BAR INIT
───────────────────────────────────────────── */
function initSearchBar() {
  const searchInput = document.querySelector(
    '.search-input, #search-input, [data-search-input], input[type="search"]'
  );
  if (!searchInput) return;

  const searchWrapper = searchInput.closest('.search-bar, .search-wrapper, .search-form, form');
  const clearBtn = searchWrapper?.querySelector('.search-clear, [data-action="clear-search"]');
  const suggestionsEl = searchWrapper?.querySelector('.search-suggestions, [data-search-suggestions]')
    || document.querySelector('.search-suggestions, [data-search-suggestions]');
  const voiceBtn = searchWrapper?.querySelector('.voice-search-btn, [data-action="voice-search"]');

  // Show/hide clear button
  const toggleClearBtn = (value) => {
    if (clearBtn) clearBtn.style.display = value ? '' : 'none';
  };
  toggleClearBtn(searchInput.value);

  // Debounced filter + suggestions
  const handleInput = debounce((query) => {
    filterProducts(query);
    renderSuggestions(searchInput, suggestionsEl, query);
    toggleClearBtn(query);
  }, 300);

  searchInput.addEventListener('input', (e) => handleInput(e.target.value));

  searchInput.addEventListener('focus', () => {
    renderSuggestions(searchInput, suggestionsEl, searchInput.value);
  });

  // Keyboard navigation in suggestions
  searchInput.addEventListener('keydown', (e) => {
    if (!suggestionsEl?.classList.contains('suggestions-open')) return;

    const items = [...suggestionsEl.querySelectorAll('.suggestion-item')];
    const focused = suggestionsEl.querySelector('.suggestion-item:focus');
    const idx = items.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (items[idx + 1] || items[0])?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (items[idx - 1] || items[items.length - 1])?.focus();
    } else if (e.key === 'Escape') {
      hideSuggestions(suggestionsEl);
      searchInput.focus();
    } else if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        saveToHistory(q);
        hideSuggestions(suggestionsEl);
      }
    }
  });

  // Suggestion item click
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      const clearHistory = e.target.closest('[data-action="clear-history"]');

      if (item) {
        const value = item.dataset.value;
        searchInput.value = value;
        saveToHistory(value);
        hideSuggestions(suggestionsEl);
        filterProducts(value);
        toggleClearBtn(value);
        searchInput.focus();
      }

      if (clearHistory) {
        clearSearchHistory();
        hideSuggestions(suggestionsEl);
      }
    });

    // Keyboard select suggestion
    suggestionsEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.suggestion-item');
        if (item) {
          item.click();
        }
      }
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterProducts('');
      hideSuggestions(suggestionsEl);
      toggleClearBtn('');
      searchInput.focus();
    });
  }

  // Voice search button
  if (voiceBtn) {
    voiceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startVoiceSearch(searchInput);
    });
  }

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!searchWrapper?.contains(e.target) && !suggestionsEl?.contains(e.target)) {
      hideSuggestions(suggestionsEl);
    }
  });
}

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSearchBar();
  initImageSearch();
});

/* ─────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  filterProducts,
  startVoiceSearch,
  getSearchHistory,
  clearSearchHistory,
  saveToHistory,
});
