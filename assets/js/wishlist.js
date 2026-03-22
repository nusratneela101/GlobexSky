/**
 * wishlist.js — Globex Sky Wishlist Management
 * Handles add/remove, rendering, sorting, and API integration for the wishlist.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'globexsky_wishlist';
  const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) || '/api/v1';

  // ─── Storage Helpers ────────────────────────────────────────────────────────

  function getWishlist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { /* quota exceeded — fail silently */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add a product to the wishlist.
   * @param {object} product — must have at least { id, name, price, supplier }
   */
  function addToWishlist(product) {
    if (!product || !product.id) return false;
    const items = getWishlist();
    if (items.some(p => p.id === product.id)) return false; // already exists
    items.unshift({ ...product, addedAt: Date.now() });
    saveWishlist(items);
    dispatchEvent('wishlist:added', { product });
    return true;
  }

  /**
   * Remove a product from the wishlist by id.
   * @param {string|number} productId
   */
  function removeFromWishlist(productId) {
    const items = getWishlist().filter(p => p.id !== productId);
    saveWishlist(items);
    dispatchEvent('wishlist:removed', { productId });
  }

  /**
   * Toggle a product in the wishlist (add if absent, remove if present).
   * @returns {boolean} true if added, false if removed
   */
  function toggleWishlist(product) {
    if (isWishlisted(product.id)) {
      removeFromWishlist(product.id);
      return false;
    } else {
      addToWishlist(product);
      return true;
    }
  }

  /**
   * Check if a product is in the wishlist.
   * @param {string|number} productId
   */
  function isWishlisted(productId) {
    return getWishlist().some(p => p.id === productId);
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
    saveWishlist([]);
    dispatchEvent('wishlist:cleared', {});
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

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
    const items = getWishlist();
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
          <a href="product-detail.html?id=${product.id}" style="display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 22px;background:#0052CC;color:#fff;border-radius:8px;font-weight:600;text-decoration:none">
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
      const token = localStorage.getItem('globexsky_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const res = await fetch(`${API_BASE}/products/${productId}`, { headers });
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
        addedAt: Date.now(),
      });
    } catch (err) {
      console.error('[Wishlist] Failed to fetch product:', err);
      return false;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) { /* old browser fallback */ }
  }

  // ─── Exposed Manager Object ─────────────────────────────────────────────────

  function removeAndRefresh(productId, buttonEl) {
    removeFromWishlist(productId);
    const card = buttonEl && buttonEl.closest('[data-id]');
    if (card) {
      card.style.transition = 'opacity .3s';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    }
    updateWishlistBadge();
  }

  function addToCartAndRemove(productId, buttonEl) {
    const items = getWishlist();
    const product = items.find(p => p.id === productId);
    if (!product) return;
    // Try to use global cart module if available
    if (typeof window.cartManager !== 'undefined' && window.cartManager.addItem) {
      window.cartManager.addItem(product);
    } else {
      alert('Added to cart: ' + (product.name || productId));
    }
    removeAndRefresh(productId, buttonEl);
  }

  function updateWishlistBadge() {
    const badge = document.querySelector('[data-wishlist-badge]');
    if (badge) badge.textContent = getWishlistCount();
  }

  // Expose global manager
  window.wishlistManager = {
    add: addToWishlist,
    remove: removeFromWishlist,
    toggle: toggleWishlist,
    isWishlisted,
    getAll: getWishlist,
    getCount: getWishlistCount,
    clear: clearWishlist,
    sort: sortWishlist,
    render: renderWishlistGrid,
    addById: addProductById,
    removeAndRefresh,
    addToCartAndRemove,
    updateBadge: updateWishlistBadge,
  };

  // Initialize badge on load
  document.addEventListener('DOMContentLoaded', updateWishlistBadge);

})();
