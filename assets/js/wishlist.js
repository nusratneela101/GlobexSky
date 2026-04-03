/**
 * wishlist.js — Globex Sky Wishlist Management
 * Handles add/remove, rendering, sorting, and API integration for the wishlist.
 * Works with both localStorage (guest) and backend API (logged-in users).
 */

(function () {
  'use strict';

  // Unified storage key — matches the wishlist page and other parts of the codebase
  const STORAGE_KEY = 'globex_wishlist';
  const API_BASE = (window.GLOBEX_CONFIG && window.GLOBEX_CONFIG.API_BASE_URL) ||
                   (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '/api/v1';

  // ─── Auth Helpers ────────────────────────────────────────────────────────────

  function getAuthToken() {
    try {
      const sess = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (sess && sess.token) return sess.token;
    } catch (_) {}
    const direct = localStorage.getItem('globexToken') ||
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('token') ||
                   sessionStorage.getItem('token');
    if (direct) return direct;
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const s = JSON.parse(localStorage.getItem(key) || 'null');
          if (s && s.access_token) return s.access_token;
        }
      }
    } catch (_) {}
    return null;
  }

  function isLoggedIn() {
    return !!getAuthToken();
  }

  function authHeaders() {
    const token = getAuthToken();
    return token
      ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      : { 'Content-Type': 'application/json' };
  }

  // ─── Storage Helpers (localStorage) ─────────────────────────────────────────

  function getLocalWishlist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalWishlist(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { /* quota exceeded — fail silently */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get all wishlist items (localStorage only — for sync state checks).
   */
  function getWishlist() {
    return getLocalWishlist();
  }

  /**
   * Add a product to the wishlist (localStorage for guests, API for logged-in users).
   * Also calls the backend API if the user is logged in.
   * @param {object} product — must have at least { id, name, price, supplier }
   */
  async function addToWishlist(product) {
    if (!product || !product.id) return false;
    const id = String(product.id);

    // Always update localStorage immediately for responsive UI
    const items = getLocalWishlist();
    if (!items.some(p => String(p.id) === id)) {
      items.unshift({ ...product, id, addedAt: Date.now() });
      saveLocalWishlist(items);
    }

    // Also sync to backend if logged in
    if (isLoggedIn()) {
      try {
        await fetch(API_BASE + '/wishlist', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ product_id: id }),
        });
      } catch (_) { /* network error — localStorage is the source of truth */ }
    }

    updateWishlistBadge();
    _showToast('Added to wishlist ❤️', 'success');
    dispatchWishlistEvent('wishlist:added', { product });
    return true;
  }

  /**
   * Remove a product from the wishlist.
   * @param {string|number} productId
   */
  async function removeFromWishlist(productId) {
    const id = String(productId);
    saveLocalWishlist(getLocalWishlist().filter(p => String(p.id) !== id));

    if (isLoggedIn()) {
      try {
        await fetch(API_BASE + '/wishlist/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: authHeaders(),
        });
      } catch (_) {}
    }

    updateWishlistBadge();
    _showToast('Removed from wishlist', 'info');
    dispatchWishlistEvent('wishlist:removed', { productId });
  }

  /**
   * Toggle a product in the wishlist (add if absent, remove if present).
   * @param {string|number} productId
   * @param {object} [productData] — extra product data to store
   * @returns {Promise<boolean>} true if added, false if removed
   */
  async function toggleWishlist(productId, productData) {
    const id = String(productId);
    const data = productData || {};
    if (isWishlisted(id)) {
      await removeFromWishlist(id);
      return false;
    } else {
      await addToWishlist({ id, ...data });
      return true;
    }
  }

  /**
   * Check if a product is in the wishlist (synchronous, checks localStorage).
   * @param {string|number} productId
   */
  function isWishlisted(productId) {
    const id = String(productId);
    return getLocalWishlist().some(p => String(p.id) === id);
  }

  /**
   * Get the number of items in the wishlist.
   */
  function getWishlistCount() {
    return getLocalWishlist().length;
  }

  /**
   * Sync localStorage wishlist items to the backend after login.
   */
  async function syncWishlist() {
    if (!isLoggedIn()) return;
    const items = getLocalWishlist();
    if (!items.length) return;
    const hdrs = authHeaders();
    for (const item of items) {
      try {
        await fetch(API_BASE + '/wishlist', {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ product_id: String(item.id) }),
        });
      } catch (_) {}
    }
  }

  /**
   * Get the number of items in the wishlist.
   */
  function getWishlistCount() {
    return getWishlist().length;
  }

  /**
   * Clear the entire wishlist.
   */
  function clearWishlist() {
    saveLocalWishlist([]);
    updateWishlistBadge();
    dispatchWishlistEvent('wishlist:cleared', {});
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function _showToast(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type || 'info');
    }
  }

  /**
   * Parse a price value that may be a number or a string like '$8.50' or '8.50 USD'.
   * @param {string|number} price
   * @returns {number}
   */
  function parsePriceValue(price) {
    if (typeof price === 'number') return price;
    return parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0;
  }

  // ─── Sorting ────────────────────────────────────────────────────────────────

  /**
   * Sort wishlist items.
   * @param {string} by — 'date' | 'price_asc' | 'price_desc' | 'name'
   */
  function sortWishlist(by) {
    const items = getLocalWishlist();
    switch (by) {
      case 'price_asc':
        items.sort((a, b) => parsePriceValue(a.price) - parsePriceValue(b.price));
        break;
      case 'price_desc':
        items.sort((a, b) => parsePriceValue(b.price) - parsePriceValue(a.price));
        break;
      case 'name':
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'date':
      default:
        items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    return items;
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  /**
   * Render the wishlist grid into a container element.
   * @param {HTMLElement} container
   * @param {object} options — { sortBy, emptyMessage, onAddToCart, onRemove }
   */
  function renderWishlistGrid(container, options) {
    if (!container) return;
    const opts = options || {};
    const sortBy = opts.sortBy || 'date';
    const items = sortWishlist(sortBy);
    const emptyMsg = opts.emptyMessage || 'Your wishlist is empty.';

    if (!items.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 24px;color:#64748b">
          <i class="fas fa-heart" style="font-size:3rem;display:block;margin-bottom:16px;color:#cbd5e1"></i>
          <h3 style="font-family:Poppins,sans-serif;font-weight:600;color:#0a0e27;margin-bottom:8px">${emptyMsg}</h3>
          <p>Save products you like and come back to them later.</p>
          <a href="pages/sourcing/products.html" style="display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 22px;background:#0052CC;color:#fff;border-radius:8px;font-weight:600;text-decoration:none">
            <i class="fas fa-search"></i> Browse Products
          </a>
        </div>`;
      return;
    }

    container.innerHTML = items.map(product => `
      <div class="wl-product-card" data-id="${product.id}">
        <button class="wl-remove-btn" onclick="wishlistManager.removeAndRefresh('${product.id}', this)" title="Remove from wishlist">
          <i class="fas fa-times"></i>
        </button>
        <div class="wl-product-img">${product.icon || '📦'}</div>
        <div class="wl-product-body">
          <div class="wl-product-name">${product.name || 'Unknown Product'}</div>
          <div class="wl-product-supplier">${product.supplier || ''}</div>
          <div class="wl-product-price">${product.price || '—'}</div>
          <div class="wl-product-actions">
            <button class="wl-cart-btn" onclick="wishlistManager.addToCartAndRemove('${product.id}', this)">
              <i class="fas fa-cart-plus"></i> Add to Cart
            </button>
          </div>
        </div>
      </div>`).join('');
  }

  // ─── API Integration ────────────────────────────────────────────────────────

  /**
   * Fetch product details from API and add to wishlist.
   * @param {string|number} productId
   */
  async function addProductById(productId) {
    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();
      const product = data.product || data;
      return addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        supplier: product.supplier_name || product.supplier,
        image: product.image_url,
        icon: product.icon || '📦',
      });
    } catch (err) {
      console.error('[Wishlist] Failed to fetch product:', err);
      return false;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function dispatchWishlistEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) { /* old browser fallback */ }
  }

  // ─── Exposed Manager Object ─────────────────────────────────────────────────

  function removeAndRefresh(productId, buttonEl) {
    const id = String(productId);
    saveLocalWishlist(getLocalWishlist().filter(p => String(p.id) !== id));
    const card = buttonEl && buttonEl.closest('[data-id]');
    if (card) {
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.remove(), 300);
    }
    // Update any heart icons on the page
    document.querySelectorAll(`.product-wishlist[data-id="${id}"]`).forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
      const icon = btn.querySelector('i');
      if (icon) { icon.classList.remove('fas'); icon.classList.add('far'); }
    });
    updateWishlistBadge();
    dispatchWishlistEvent('wishlist:removed', { productId });
    if (isLoggedIn()) {
      fetch(API_BASE + '/wishlist/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {});
    }
  }

  function addToCartAndRemove(productId, buttonEl) {
    const id = String(productId);
    const items = getLocalWishlist();
    const product = items.find(p => String(p.id) === id);
    if (!product) return;
    // Try to use global cart module if available
    if (typeof window.cartManager !== 'undefined' && window.cartManager.addItem) {
      window.cartManager.addItem(product);
    } else if (typeof window.addToCart === 'function') {
      window.addToCart(product);
    }
    removeAndRefresh(productId, buttonEl);
    _showToast('Moved to cart!', 'success');
  }

  function updateWishlistBadge() {
    const count = getWishlistCount();
    // Update any element with data-wishlist-badge attribute
    document.querySelectorAll('[data-wishlist-badge]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  // ─── Heart Icon Wiring ───────────────────────────────────────────────────────

  /**
   * Initialize wishlist heart icons on product cards via event delegation.
   * Call once after DOM is ready.
   */
  function initHeartIcons() {
    // Restore filled-heart state for items already in wishlist
    document.querySelectorAll('.product-wishlist[data-id]').forEach(btn => {
      const id = btn.getAttribute('data-id');
      if (id && isWishlisted(id)) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        const icon = btn.querySelector('i');
        if (icon) { icon.classList.remove('far'); icon.classList.add('fas'); }
      }
    });

    // Use event delegation on the document for dynamically rendered cards
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.product-wishlist[data-id]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const id = btn.getAttribute('data-id');
      const card = btn.closest('.product-card, article');
      const name = card ? (card.querySelector('.product-name a, .product-name')?.textContent?.trim() || '') : '';
      const price = card ? (card.querySelector('.product-price')?.textContent?.trim() || '') : '';
      const supplier = card ? (card.querySelector('.product-supplier')?.textContent?.trim() || '') : '';
      const image = card ? (card.querySelector('img')?.src || '') : '';

      toggleWishlist(id, { name, price, supplier, image }).then(added => {
        btn.classList.toggle('active', added);
        btn.setAttribute('aria-pressed', String(added));
        const icon = btn.querySelector('i');
        if (icon) {
          icon.classList.toggle('fas', added);
          icon.classList.toggle('far', !added);
        }
      });
    }, true);
  }

  // Expose global manager
  window.wishlistManager = {
    add: addToWishlist,
    remove: removeFromWishlist,
    toggle: toggleWishlist,
    isWishlisted,
    getAll: getLocalWishlist,
    getCount: getWishlistCount,
    clear: clearWishlist,
    sort: sortWishlist,
    render: renderWishlistGrid,
    addById: addProductById,
    removeAndRefresh,
    addToCartAndRemove,
    updateBadge: updateWishlistBadge,
    sync: syncWishlist,
    init: initHeartIcons,
  };

  // Initialize badge and heart icons on page load
  document.addEventListener('DOMContentLoaded', function () {
    updateWishlistBadge();
    initHeartIcons();
  });

})();
