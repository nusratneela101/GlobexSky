/**
 * compare.js — Globex Sky Product Comparison Tool
 * Manages up to 4 products for side-by-side comparison.
 * Stores comparison list in localStorage and renders a comparison table.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'globexsky_compare';
  const MAX_PRODUCTS = 4;
  const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '/api/v1';

  // Row definitions for the comparison table
  const COMPARE_ROWS = [
    { key: 'image',         label: 'Product Image',    format: 'image' },
    { key: 'name',          label: 'Product Name',     format: 'text'  },
    { key: 'price',         label: 'Price (USD)',       format: 'price' },
    { key: 'supplier',      label: 'Supplier',          format: 'text'  },
    { key: 'moq',           label: 'MOQ',               format: 'text'  },
    { key: 'rating',        label: 'Rating',            format: 'stars' },
    { key: 'delivery_time', label: 'Delivery Time',     format: 'text'  },
    { key: 'specifications',label: 'Specifications',    format: 'text'  },
    { key: 'category',      label: 'Category',          format: 'text'  },
  ];

  // Demo products for offline/demo mode
  const DEMO_PRODUCTS = {
    demo1: { id:'demo1', name:'Premium Cotton T-Shirt', price:8.50, supplier:'Guangzhou Apparel Co.', moq:'100 pcs', rating:4.5, delivery_time:'10–15 days', specifications:'100% Cotton, 180g/m²', category:'Apparel', icon:'👕' },
    demo2: { id:'demo2', name:'Eco-Friendly Tote Bag', price:3.20, supplier:'Shenzhen Bags Ltd.', moq:'200 pcs', rating:4.2, delivery_time:'7–12 days', specifications:'Non-woven PP, 80g/m²', category:'Bags', icon:'👜' },
    demo3: { id:'demo3', name:'Stainless Steel Bottle', price:12.00, supplier:'Shenzhen Metal Works', moq:'200 pcs', rating:4.7, delivery_time:'12–18 days', specifications:'304 SS, BPA-free, 500ml', category:'Kitchenware', icon:'🍶' },
    demo4: { id:'demo4', name:'Wireless Bluetooth Earbuds', price:22.00, supplier:'Dongguan Electronics', moq:'50 pcs', rating:4.3, delivery_time:'8–14 days', specifications:'Bluetooth 5.0, 24h battery', category:'Electronics', icon:'🎧' },
  };

  // ─── Storage ────────────────────────────────────────────────────────────────

  function getCompareList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCompareList(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_PRODUCTS)));
    } catch (e) { /* quota — fail silently */ }
  }

  // ─── Management ─────────────────────────────────────────────────────────────

  /**
   * Add a product object to the comparison list.
   * @param {object} product
   * @returns {boolean} true if added
   */
  function addToCompare(product) {
    if (!product || !product.id) return false;
    const items = getCompareList();
    if (items.length >= MAX_PRODUCTS) {
      alert('You can compare up to ' + MAX_PRODUCTS + ' products at a time. Please remove one first.');
      return false;
    }
    if (items.some(p => p.id === product.id)) return false; // already in list
    items.push({ ...product });
    saveCompareList(items);
    dispatchChangeEvent();
    return true;
  }

  /**
   * Remove a product from the comparison list by id.
   * @param {string|number} productId
   */
  function removeFromCompare(productId) {
    const items = getCompareList().filter(p => p.id !== productId);
    saveCompareList(items);
    dispatchChangeEvent();
  }

  /**
   * Clear all products from the comparison list.
   */
  function clearCompare() {
    saveCompareList([]);
    dispatchChangeEvent();
  }

  /**
   * Check if a product is already in the comparison list.
   */
  function isInCompare(productId) {
    return getCompareList().some(p => p.id === productId);
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  /**
   * Build and render the full comparison table into the page.
   */
  function renderCompareTable() {
    const headRow = document.getElementById('compare-head-row');
    const tbody = document.getElementById('compare-body');
    const emptyState = document.getElementById('empty-state');
    const compareContent = document.getElementById('compare-content');
    if (!headRow || !tbody) return;

    const items = getCompareList();

    if (!items.length) {
      if (emptyState) emptyState.style.display = 'block';
      if (compareContent) compareContent.style.display = 'none';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (compareContent) compareContent.style.display = 'block';

    // Build header columns (product names + remove buttons)
    let headerCols = '<th>Feature</th>';
    items.forEach(p => {
      headerCols += `
        <th class="prod-col-head">
          <button class="remove-btn" onclick="compareManager.remove('${p.id}')" title="Remove">✕</button>
          <div class="prod-img">${p.icon || '📦'}</div>
          <div class="prod-name">${p.name}</div>
          <div class="prod-price">$${parseFloat(p.price || 0).toFixed(2)}</div>
          <div class="stars">${renderStars(p.rating)}</div>
          <br/>
          <a href="product-detail.html?id=${p.id}" style="display:inline-flex;align-items:center;gap:6px;font-size:.78rem;padding:5px 12px;background:#0052CC;color:#fff;border-radius:6px;font-weight:600;text-decoration:none;margin-top:4px">
            View Details
          </a>
        </th>`;
    });
    // Add empty slots
    for (let i = items.length; i < MAX_PRODUCTS; i++) {
      headerCols += `
        <th>
          <div class="empty-slot" onclick="focusSearch()">
            <i class="fas fa-plus-circle"></i>
            <div style="font-size:.78rem">Add product</div>
          </div>
        </th>`;
    }
    headRow.innerHTML = headerCols;

    // Build rows
    let rowsHtml = '';
    COMPARE_ROWS.forEach(row => {
      const values = items.map(p => p[row.key]);
      const allSame = values.every(v => v === values[0]);
      let rowHtml = `<tr><td>${row.label}</td>`;
      items.forEach(p => {
        const val = p[row.key];
        const cellClass = !allSame && values.filter(v => v !== undefined).length > 1 ? ' class="diff-highlight"' : '';
        rowHtml += `<td${cellClass}>${formatCell(row.format, val, p)}</td>`;
      });
      // Fill empty columns
      for (let i = items.length; i < MAX_PRODUCTS; i++) {
        rowHtml += '<td>—</td>';
      }
      rowHtml += '</tr>';
      rowsHtml += rowHtml;
    });
    // Add to cart row
    rowsHtml += '<tr><td>Action</td>';
    items.forEach(p => {
      rowsHtml += `<td><button onclick="addProductToCart('${p.id}')" style="padding:8px 16px;background:#00C9A7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:.82rem;display:inline-flex;align-items:center;gap:6px"><i class="fas fa-cart-plus"></i> Add to Cart</button></td>`;
    });
    for (let i = items.length; i < MAX_PRODUCTS; i++) rowsHtml += '<td></td>';
    rowsHtml += '</tr>';

    tbody.innerHTML = rowsHtml;
  }

  function formatCell(format, value, product) {
    if (value === undefined || value === null || value === '') return '<span style="color:#94a3b8">—</span>';
    switch (format) {
      case 'image':
        return `<span style="font-size:2rem">${product.icon || '📦'}</span>`;
      case 'price':
        return `<strong style="color:#0052CC">$${parseFloat(value).toFixed(2)}</strong>`;
      case 'stars':
        return renderStars(value) + ` <span style="font-size:.78rem;color:#64748b">(${value})</span>`;
      default:
        return String(value);
    }
  }

  function renderStars(rating) {
    const r = parseFloat(rating) || 0;
    const full = Math.floor(r);
    const half = r % 1 >= 0.5 ? 1 : 0;
    let stars = '<span style="color:#f59e0b">';
    for (let i = 0; i < full; i++) stars += '★';
    if (half) stars += '½';
    for (let i = full + half; i < 5; i++) stars += '☆';
    return stars + '</span>';
  }

  function focusSearch() {
    const inp = document.getElementById('product-search-input');
    if (inp) { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  // ─── Search & Add ────────────────────────────────────────────────────────────

  /**
   * Search for a product by name and add it to the comparison list.
   */
  function searchAndAdd() {
    const input = document.getElementById('product-search-input');
    if (!input) return;
    const query = input.value.trim().toLowerCase();
    if (!query) { alert('Please enter a product name or ID to search.'); return; }

    // Try demo products first (offline mode)
    const match = Object.values(DEMO_PRODUCTS).find(p =>
      p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
    );
    if (match) {
      const added = addToCompare(match);
      if (added) { input.value = ''; renderCompareTable(); }
      return;
    }

    // Try API
    const token = localStorage.getItem('globexsky_token');
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    fetch(`${API_BASE}/products?search=${encodeURIComponent(query)}&limit=1`, { headers })
      .then(r => r.json())
      .then(data => {
        const products = data.products || data.data || [];
        if (!products.length) { alert('No product found matching "' + query + '".'); return; }
        const p = products[0];
        addToCompare({
          id: p.id, name: p.name, price: p.price, supplier: p.supplier_name || p.supplier,
          moq: p.moq, rating: p.rating, delivery_time: p.delivery_time,
          specifications: p.specifications, category: p.category, icon: '📦',
        });
        input.value = '';
        renderCompareTable();
      })
      .catch(() => { alert('Could not search products. Please try again.'); });
  }

  // ─── Compare Bar ────────────────────────────────────────────────────────────

  /**
   * Build/update the floating compare bar at the bottom of the page.
   * Shown when 2 or more products are in the compare list.
   */
  function updateCompareBar() {
    const items = getCompareList();
    let bar = document.getElementById('globex-compare-bar');

    if (items.length < 2) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'globex-compare-bar';
      bar.style.cssText =
        'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0a0e27;' +
        'color:#fff;padding:12px 24px;display:flex;align-items:center;gap:12px;' +
        'box-shadow:0 -4px 20px rgba(0,0,0,.3);font-family:Inter,sans-serif;' +
        'animation:slideUpIn .3s ease';
      if (!document.getElementById('compare-bar-style')) {
        const style = document.createElement('style');
        style.id = 'compare-bar-style';
        style.textContent =
          '@keyframes slideUpIn{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
          '#globex-compare-bar .cbar-thumb{width:44px;height:44px;border-radius:8px;' +
          'background:#1e2a4a;display:flex;align-items:center;justify-content:center;' +
          'font-size:1.4rem;flex-shrink:0;border:2px solid #334;}' +
          '#globex-compare-bar .cbar-label{font-size:.82rem;color:#94a3b8;white-space:nowrap}' +
          '#globex-compare-bar .cbar-name{font-size:.78rem;font-weight:600;color:#e2e8f0;' +
          'max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
        document.head.appendChild(style);
      }
      document.body.appendChild(bar);
    }

    // Thumbnails HTML
    const thumbsHtml = items.map(p =>
      `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer" onclick="compareManager.remove('${p.id}');updateCompareBar()" title="Click to remove ${p.name}">
        <div class="cbar-thumb">${p.icon || '📦'}</div>
        <div class="cbar-name">${(p.name || 'Product').substring(0, 12)}</div>
       </div>`
    ).join('');

    bar.innerHTML =
      '<span class="cbar-label"><i class="fas fa-balance-scale" style="margin-right:6px"></i>Compare (' + items.length + ')</span>' +
      '<div style="display:flex;gap:10px;align-items:center;flex:1;overflow-x:auto">' + thumbsHtml + '</div>' +
      '<a href="' + _getComparePath() + '" style="white-space:nowrap;padding:9px 20px;background:#0052CC;color:#fff;border-radius:8px;font-weight:600;font-size:.85rem;text-decoration:none;display:inline-flex;align-items:center;gap:6px"><i class="fas fa-table"></i> Compare Now</a>' +
      '<button onclick="compareManager.clearBar()" style="padding:8px 14px;background:transparent;color:#94a3b8;border:1.5px solid #334;border-radius:8px;cursor:pointer;font-size:.8rem;white-space:nowrap">Clear All</button>';

    bar.style.display = 'flex';
  }

  function _getComparePath() {
    // Resolve the compare page URL relative to any depth
    const script = document.currentScript ||
      (function () {
        const tags = document.querySelectorAll('script[src*="compare.js"]');
        return tags[tags.length - 1] || null;
      }());
    if (script && script.src) {
      const base = script.src.replace(/assets\/js\/compare\.js(\?.*)?$/, '');
      return base + 'pages/compare/index.html';
    }
    return '/pages/compare/index.html';
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  function clearAll() {
    if (!confirm('Remove all products from comparison?')) return;
    clearCompare();
    renderCompareTable();
  }

  function exportComparison() {
    const items = getCompareList();
    if (!items.length) { alert('Nothing to export.'); return; }
    let csv = 'Feature,' + items.map(p => '"' + p.name + '"').join(',') + '\n';
    COMPARE_ROWS.forEach(row => {
      csv += '"' + row.label + '",' + items.map(p => '"' + (p[row.key] || '') + '"').join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function addAllToCart() {
    const items = getCompareList();
    if (!items.length) { alert('No products in comparison.'); return; }
    if (typeof window.cartManager !== 'undefined' && window.cartManager.addItem) {
      items.forEach(p => window.cartManager.addItem(p));
    } else {
      alert('Added ' + items.length + ' products to cart!');
    }
  }

  function addProductToCart(productId) {
    const product = getCompareList().find(p => p.id === productId);
    if (!product) return;
    if (typeof window.cartManager !== 'undefined' && window.cartManager.addItem) {
      window.cartManager.addItem(product);
    } else {
      alert('Added to cart: ' + product.name);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function dispatchChangeEvent() {
    try { window.dispatchEvent(new CustomEvent('compare:changed', { detail: { items: getCompareList() } })); } catch (e) {}
    updateCompareBar();
  }

  // ─── Global Exposure ────────────────────────────────────────────────────────

  window.compareManager = {
    add: addToCompare,
    remove: function (productId) { removeFromCompare(productId); renderCompareTable(); },
    clear: clearAll,
    clearBar: function () { clearCompare(); updateCompareBar(); },
    isInCompare,
    getAll: getCompareList,
    render: renderCompareTable,
    searchAndAdd,
    export: exportComparison,
    addAllToCart,
    updateBar: updateCompareBar,
  };

  // Page-level helpers used by inline onclick handlers
  window.searchAndAdd = searchAndAdd;
  window.clearAll = clearAll;
  window.exportComparison = exportComparison;
  window.addAllToCart = addAllToCart;
  window.addProductToCart = addProductToCart;
  window.updateCompareBar = updateCompareBar;

  // Auto-render on page load if the compare table container exists
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('compare-table')) {
      renderCompareTable();
    }
    updateCompareBar();
  });

})();
