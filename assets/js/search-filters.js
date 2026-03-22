/**
 * Globex Sky — search-filters.js
 * Feature 5: Advanced Filters (22 filters)
 * Manages filter state, UI, active chips, URL sync, and API calls.
 */

'use strict';

const GlobexFilters = (() => {
  /* ── Default State ───────────────────────────────────────────────────── */
  const DEFAULT_STATE = {
    minPrice: '', maxPrice: '',
    category_id: '',
    supplier_id: '',
    minRating: '',
    minMoq: '', maxMoq: '',
    shipping_method: [],
    delivery_time: '',
    verified_supplier: false,
    trade_assurance: false,
    sample_available: false,
    certifications: [],
    material: '',
    color: '',
    date_from: '', date_to: '',
    in_stock: false,
    on_sale: false,
    payment_terms: [],
    product_type: [],
    customizable: false,
    eco_friendly: false,
    sort: 'newest',
    q: '',
  };

  /* ── State ──────────────────────────────────────────────────────────── */
  let state = { ...DEFAULT_STATE };

  /* ── Color palette ──────────────────────────────────────────────────── */
  const COLORS = [
    { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' },
    { name: 'Green', hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
    { name: 'Black', hex: '#1a1a2e' }, { name: 'White', hex: '#f8faff' },
    { name: 'Orange', hex: '#f97316' }, { name: 'Purple', hex: '#a855f7' },
    { name: 'Pink', hex: '#ec4899' }, { name: 'Brown', hex: '#92400e' },
    { name: 'Gray', hex: '#94a3b8' }, { name: 'Silver', hex: '#cbd5e1' },
  ];

  /* ── Certifications ──────────────────────────────────────────────────── */
  const CERTS = ['ISO 9001', 'ISO 14001', 'CE', 'FDA', 'UL', 'RoHS', 'REACH', 'GMP', 'BRC', 'SGS'];

  /* ── DOM ─────────────────────────────────────────────────────────────── */
  let filterPanel, activeFiltersBar, filterCountBadge;
  let isMobileOpen = false;

  /* ── Build Filter Panel ──────────────────────────────────────────────── */
  function buildPanel() {
    filterPanel = document.getElementById('filter-panel');
    if (!filterPanel) return;

    filterPanel.innerHTML = `
      <div class="filter-panel-header">
        <div class="filter-panel-title"><i class="fas fa-sliders-h"></i> Filters <span id="filter-count-badge" class="filter-count-badge" style="display:none">0</span></div>
        <button class="btn-clear-all" id="btn-clear-all-filters">Clear All</button>
      </div>

      <!-- Price Range -->
      ${buildSection('price', 'Price Range', `
        <div class="price-range-inputs">
          <input type="number" class="price-input" id="f-min-price" placeholder="Min $" min="0">
          <span class="price-range-sep">–</span>
          <input type="number" class="price-input" id="f-max-price" placeholder="Max $" min="0">
        </div>
        <input type="range" class="range-slider" id="f-price-range" min="0" max="10000" step="10" value="10000">
      `)}

      <!-- Category -->
      ${buildSection('category', 'Category', `
        <input type="text" class="filter-search-input" id="f-category-search" placeholder="Search categories…">
        <div id="f-category-list" class="filter-option-list"></div>
      `)}

      <!-- Rating -->
      ${buildSection('rating', 'Minimum Rating', `
        <div class="star-filter">
          ${[5,4,3,2,1].map(n => `
            <label class="star-option filter-option">
              <input type="radio" name="f-rating" value="${n}" ${state.minRating == n ? 'checked' : ''}>
              <span class="stars">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>
              <span>& up</span>
            </label>`).join('')}
        </div>
      `)}

      <!-- Supplier / Brand -->
      ${buildSection('supplier', 'Supplier / Brand', `
        <input type="text" class="filter-search-input" id="f-supplier-search" placeholder="Search suppliers…">
        <div id="f-supplier-list"></div>
      `)}

      <!-- Location -->
      ${buildSection('location', 'Location / Country', `
        <input type="text" class="filter-search-input" id="f-location-search" placeholder="Search country…">
        <div id="f-location-list"></div>
      `)}

      <!-- MOQ -->
      ${buildSection('moq', 'MOQ (Min. Order Quantity)', `
        <div class="price-range-inputs">
          <input type="number" class="price-input" id="f-min-moq" placeholder="Min" min="0">
          <span class="price-range-sep">–</span>
          <input type="number" class="price-input" id="f-max-moq" placeholder="Max" min="0">
        </div>
      `)}

      <!-- Shipping Method -->
      ${buildSection('shipping', 'Shipping Method', `
        ${['Standard', 'Express', 'Economy', 'Free Shipping'].map(s =>
          `<label class="filter-option"><input type="checkbox" value="${s}" data-filter="shipping_method"> <span class="filter-option-label">${s}</span></label>`
        ).join('')}
      `)}

      <!-- Delivery Time -->
      ${buildSection('delivery', 'Delivery Time', `
        ${[['1-3 days','1-3'],['3-7 days','3-7'],['7-14 days','7-14'],['14+ days','14+']].map(([label, val]) =>
          `<label class="filter-option"><input type="radio" name="f-delivery" value="${val}"> <span>${label}</span></label>`
        ).join('')}
      `)}

      <!-- Toggles -->
      ${buildSection('toggles', 'Product Attributes', `
        ${buildToggle('f-verified', 'Verified Supplier', 'verified_supplier')}
        ${buildToggle('f-trade-assurance', 'Trade Assurance', 'trade_assurance')}
        ${buildToggle('f-sample', 'Sample Available', 'sample_available')}
        ${buildToggle('f-in-stock', 'In Stock', 'in_stock')}
        ${buildToggle('f-on-sale', 'Discount / On Sale', 'on_sale')}
        ${buildToggle('f-customizable', 'Customizable', 'customizable')}
        ${buildToggle('f-eco', 'Eco-Friendly / Green', 'eco_friendly')}
      `)}

      <!-- Certification -->
      ${buildSection('cert', 'Certification', `
        ${CERTS.map(c =>
          `<label class="filter-option"><input type="checkbox" value="${c}" data-filter="certifications"> <span class="filter-option-label">${c}</span></label>`
        ).join('')}
      `)}

      <!-- Color -->
      ${buildSection('color', 'Color', `
        <div class="color-swatches" id="f-color-swatches">
          ${COLORS.map(c =>
            `<div class="color-swatch" title="${c.name}" style="background:${c.hex}" data-color="${c.name}"></div>`
          ).join('')}
        </div>
      `)}

      <!-- Material -->
      ${buildSection('material', 'Material', `
        <input type="text" class="filter-search-input" id="f-material" placeholder="e.g. Stainless Steel…">
      `)}

      <!-- Date Listed -->
      ${buildSection('date', 'Date Listed', `
        <div class="date-presets">
          <button class="date-preset" data-date="24h">Last 24h</button>
          <button class="date-preset" data-date="7d">Last 7 days</button>
          <button class="date-preset" data-date="30d">Last 30 days</button>
          <button class="date-preset" data-date="custom">Custom</button>
        </div>
        <div id="f-custom-dates" style="display:none; gap:6px; flex-direction:column">
          <input type="date" class="price-input" id="f-date-from" placeholder="From">
          <input type="date" class="price-input" id="f-date-to" placeholder="To">
        </div>
      `)}

      <!-- Payment Terms -->
      ${buildSection('payment', 'Payment Terms', `
        ${['Net 30', 'Net 60', 'Net 90', 'COD'].map(t =>
          `<label class="filter-option"><input type="checkbox" value="${t}" data-filter="payment_terms"> <span class="filter-option-label">${t}</span></label>`
        ).join('')}
      `)}

      <!-- Product Type -->
      ${buildSection('ptype', 'Product Type', `
        ${['New', 'Refurbished', 'Used'].map(t =>
          `<label class="filter-option"><input type="checkbox" value="${t}" data-filter="product_type"> <span class="filter-option-label">${t}</span></label>`
        ).join('')}
      `)}

      <div class="filter-actions">
        <button class="btn-apply-filters" id="btn-apply-filters">Apply Filters</button>
        <button class="btn-clear-filters" id="btn-clear-filters">Clear All</button>
      </div>
    `;

    // Bind events
    bindEvents();
    loadCategories();
    loadCountries();
  }

  function buildSection(id, title, content) {
    return `<div class="filter-section" id="filter-sec-${id}">
      <div class="filter-section-header" onclick="GlobexFilters.toggleSection('${id}')">
        <span class="filter-section-title">${title}</span>
        <button class="filter-section-toggle" aria-label="Toggle"><i class="fas fa-chevron-down"></i></button>
      </div>
      <div class="filter-section-body">${content}</div>
    </div>`;
  }

  function buildToggle(id, label, stateKey) {
    return `<div class="toggle-wrap" style="margin-bottom:10px">
      <span class="toggle-label">${label}</span>
      <label class="toggle-switch">
        <input type="checkbox" id="${id}" data-state="${stateKey}" ${state[stateKey] ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }

  /* ── Bind Events ────────────────────────────────────────────────────── */
  function bindEvents() {
    if (!filterPanel) return;

    // Price inputs
    const minP = document.getElementById('f-min-price');
    const maxP = document.getElementById('f-max-price');
    if (minP) minP.addEventListener('input', e => { state.minPrice = e.target.value; });
    if (maxP) maxP.addEventListener('input', e => { state.maxPrice = e.target.value; });

    // Rating radio
    filterPanel.querySelectorAll('input[name="f-rating"]').forEach(el => {
      el.addEventListener('change', e => { state.minRating = e.target.value; });
    });

    // MOQ
    const minMoq = document.getElementById('f-min-moq');
    const maxMoq = document.getElementById('f-max-moq');
    if (minMoq) minMoq.addEventListener('input', e => { state.minMoq = e.target.value; });
    if (maxMoq) maxMoq.addEventListener('input', e => { state.maxMoq = e.target.value; });

    // Checkboxes (shipping, cert, payment, product_type)
    filterPanel.querySelectorAll('input[type=checkbox][data-filter]').forEach(el => {
      el.addEventListener('change', e => {
        const key = e.target.dataset.filter;
        if (!Array.isArray(state[key])) state[key] = [];
        if (e.target.checked) state[key].push(e.target.value);
        else state[key] = state[key].filter(v => v !== e.target.value);
      });
    });

    // Toggles
    filterPanel.querySelectorAll('input[type=checkbox][data-state]').forEach(el => {
      el.addEventListener('change', e => { state[e.target.dataset.state] = e.target.checked; });
    });

    // Delivery time radio
    filterPanel.querySelectorAll('input[name="f-delivery"]').forEach(el => {
      el.addEventListener('change', e => { state.delivery_time = e.target.value; });
    });

    // Color swatches
    const swatchesEl = document.getElementById('f-color-swatches');
    if (swatchesEl) {
      swatchesEl.addEventListener('click', e => {
        const swatch = e.target.closest('.color-swatch');
        if (!swatch) return;
        swatchesEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        state.color = swatch.dataset.color;
      });
    }

    // Material
    const materialEl = document.getElementById('f-material');
    if (materialEl) materialEl.addEventListener('input', e => { state.material = e.target.value; });

    // Date presets
    filterPanel.querySelectorAll('.date-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        filterPanel.querySelectorAll('.date-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const now = new Date();
        const customDates = document.getElementById('f-custom-dates');
        switch (btn.dataset.date) {
          case '24h': state.date_from = new Date(now - 86400000).toISOString(); state.date_to = ''; break;
          case '7d': state.date_from = new Date(now - 7 * 86400000).toISOString(); state.date_to = ''; break;
          case '30d': state.date_from = new Date(now - 30 * 86400000).toISOString(); state.date_to = ''; break;
          case 'custom': if (customDates) customDates.style.display = 'flex'; return;
        }
        if (customDates) customDates.style.display = 'none';
      });
    });

    const dateFrom = document.getElementById('f-date-from');
    const dateTo = document.getElementById('f-date-to');
    if (dateFrom) dateFrom.addEventListener('change', e => { state.date_from = e.target.value; });
    if (dateTo) dateTo.addEventListener('change', e => { state.date_to = e.target.value; });

    // Apply / Clear
    const applyBtn = document.getElementById('btn-apply-filters');
    const clearBtn = document.getElementById('btn-clear-filters');
    const clearAllBtn = document.getElementById('btn-clear-all-filters');
    if (applyBtn) applyBtn.addEventListener('click', apply);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);

    // Mobile overlay
    const mobileBtn = document.getElementById('btn-mobile-filters');
    const overlay = document.getElementById('filter-overlay');
    if (mobileBtn) mobileBtn.addEventListener('click', openMobile);
    if (overlay) overlay.addEventListener('click', closeMobile);
  }

  /* ── Load Categories from API ────────────────────────────────────────── */
  async function loadCategories() {
    const listEl = document.getElementById('f-category-list');
    if (!listEl) return;
    try {
      const data = await window.API.get('/products/categories');
      const categories = data.categories || data.data || [];
      listEl.innerHTML = categories.slice(0, 12).map(c =>
        `<label class="filter-option">
          <input type="radio" name="f-category" value="${c.id || c.slug || c.name}">
          <span class="filter-option-label">${c.name}</span>
          ${c.count ? `<span class="filter-option-count">${c.count}</span>` : ''}
        </label>`).join('');

      listEl.querySelectorAll('input[name="f-category"]').forEach(el => {
        el.addEventListener('change', e => { state.category_id = e.target.value; });
      });

      // Search filter
      const searchEl = document.getElementById('f-category-search');
      if (searchEl) {
        searchEl.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          listEl.querySelectorAll('.filter-option').forEach(opt => {
            opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        });
      }
    } catch (_) { /* silently fail */ }
  }

  /* ── Load Countries ──────────────────────────────────────────────────── */
  function loadCountries() {
    const listEl = document.getElementById('f-location-list');
    if (!listEl) return;
    const countries = ['China', 'USA', 'India', 'Bangladesh', 'Vietnam', 'Turkey', 'Germany', 'Italy', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong'];
    listEl.innerHTML = countries.map(c =>
      `<label class="filter-option">
        <input type="checkbox" value="${c}" data-filter="location">
        <span>${c}</span>
      </label>`).join('');

    if (!Array.isArray(state.location)) state.location = [];
    listEl.querySelectorAll('input[data-filter=location]').forEach(el => {
      el.addEventListener('change', e => {
        if (!Array.isArray(state.location)) state.location = [];
        if (e.target.checked) state.location.push(e.target.value);
        else state.location = state.location.filter(v => v !== e.target.value);
      });
    });

    const searchEl = document.getElementById('f-location-search');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        listEl.querySelectorAll('.filter-option').forEach(opt => {
          opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }
  }

  /* ── Apply Filters ───────────────────────────────────────────────────── */
  function apply() {
    updateActiveChips();
    updateUrlState();
    closeMobile();
    if (window.GlobexSearch) window.GlobexSearch.setFilters({ ...state });
  }

  /* ── Clear All ───────────────────────────────────────────────────────── */
  function clearAll() {
    state = { ...DEFAULT_STATE, shipping_method: [], certifications: [], payment_terms: [], product_type: [] };
    buildPanel();
    updateActiveChips();
    if (window.GlobexSearch) window.GlobexSearch.setFilters({});
  }

  /* ── Active Filter Chips ─────────────────────────────────────────────── */
  function updateActiveChips() {
    activeFiltersBar = document.getElementById('active-filters-bar');
    filterCountBadge = document.getElementById('filter-count-badge');
    if (!activeFiltersBar) return;

    const chips = [];
    if (state.minPrice || state.maxPrice) chips.push({ key: 'price', label: `Price: $${state.minPrice || 0} – $${state.maxPrice || '∞'}` });
    if (state.category_id) chips.push({ key: 'category_id', label: `Category: ${state.category_id}` });
    if (state.minRating) chips.push({ key: 'minRating', label: `Rating: ${state.minRating}★+` });
    if (state.verified_supplier) chips.push({ key: 'verified_supplier', label: 'Verified Supplier' });
    if (state.trade_assurance) chips.push({ key: 'trade_assurance', label: 'Trade Assurance' });
    if (state.sample_available) chips.push({ key: 'sample_available', label: 'Sample Available' });
    if (state.in_stock) chips.push({ key: 'in_stock', label: 'In Stock' });
    if (state.on_sale) chips.push({ key: 'on_sale', label: 'On Sale' });
    if (state.customizable) chips.push({ key: 'customizable', label: 'Customizable' });
    if (state.eco_friendly) chips.push({ key: 'eco_friendly', label: 'Eco-Friendly' });
    if (state.color) chips.push({ key: 'color', label: `Color: ${state.color}` });
    if (state.material) chips.push({ key: 'material', label: `Material: ${state.material}` });
    state.certifications?.forEach(c => chips.push({ key: `cert_${c}`, label: c, remove: () => { state.certifications = state.certifications.filter(x => x !== c); } }));
    state.shipping_method?.forEach(s => chips.push({ key: `ship_${s}`, label: s, remove: () => { state.shipping_method = state.shipping_method.filter(x => x !== s); } }));
    state.product_type?.forEach(t => chips.push({ key: `type_${t}`, label: t, remove: () => { state.product_type = state.product_type.filter(x => x !== t); } }));

    const count = chips.length;
    activeFiltersBar.innerHTML = chips.map(c =>
      `<div class="filter-chip" data-key="${c.key}">${c.label} <button onclick="GlobexFilters.removeChip('${c.key}')" aria-label="Remove"><i class="fas fa-times"></i></button></div>`
    ).join('');

    if (filterCountBadge) {
      filterCountBadge.textContent = count;
      filterCountBadge.style.display = count > 0 ? '' : 'none';
    }

    // Mobile button badge
    const mobileBadge = document.getElementById('mobile-filter-badge');
    if (mobileBadge) { mobileBadge.textContent = count; mobileBadge.style.display = count > 0 ? '' : 'none'; }
  }

  /* ── URL State ───────────────────────────────────────────────────────── */
  function updateUrlState() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    params.delete('minPrice'); params.delete('maxPrice'); params.delete('category_id'); params.delete('minRating');
    if (state.minPrice) params.set('minPrice', state.minPrice);
    if (state.maxPrice) params.set('maxPrice', state.maxPrice);
    if (state.category_id) params.set('category_id', state.category_id);
    if (state.minRating) params.set('minRating', state.minRating);
    window.history.replaceState({}, '', url.toString());
  }

  /* ── Mobile ──────────────────────────────────────────────────────────── */
  function openMobile() {
    filterPanel = document.getElementById('filter-panel');
    if (filterPanel) filterPanel.classList.add('mobile-open');
    const overlay = document.getElementById('filter-overlay');
    if (overlay) overlay.classList.add('visible');
    isMobileOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function closeMobile() {
    filterPanel = document.getElementById('filter-panel');
    if (filterPanel) filterPanel.classList.remove('mobile-open');
    const overlay = document.getElementById('filter-overlay');
    if (overlay) overlay.classList.remove('visible');
    isMobileOpen = false;
    document.body.style.overflow = '';
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  function toggleSection(id) {
    const sec = document.getElementById(`filter-sec-${id}`);
    if (sec) sec.classList.toggle('collapsed');
  }

  function removeChip(key) {
    // Specific removals
    if (key === 'price') { state.minPrice = ''; state.maxPrice = ''; }
    else if (key === 'category_id') state.category_id = '';
    else if (key === 'minRating') state.minRating = '';
    else if (key.startsWith('cert_')) state.certifications = state.certifications?.filter(c => `cert_${c}` !== key) || [];
    else if (key.startsWith('ship_')) state.shipping_method = state.shipping_method?.filter(s => `ship_${s}` !== key) || [];
    else if (key.startsWith('type_')) state.product_type = state.product_type?.filter(t => `type_${t}` !== key) || [];
    else if (state[key] !== undefined) {
      if (typeof state[key] === 'boolean') state[key] = false;
      else state[key] = '';
    }
    apply();
  }

  function getState() { return { ...state }; }

  function init() {
    buildPanel();
    updateActiveChips();

    // Read URL params for initial state
    const params = new URLSearchParams(window.location.search);
    if (params.get('minPrice')) state.minPrice = params.get('minPrice');
    if (params.get('maxPrice')) state.maxPrice = params.get('maxPrice');
    if (params.get('category_id')) state.category_id = params.get('category_id');
    if (params.get('minRating')) state.minRating = params.get('minRating');
  }

  return { init, apply, clearAll, toggleSection, removeChip, getState, openMobile, closeMobile };
})();

document.addEventListener('DOMContentLoaded', () => { GlobexFilters.init(); });
window.GlobexFilters = GlobexFilters;
