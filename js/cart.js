/**
 * js/cart.js — Cart module.
 *
 * Manages a local cart (persisted in localStorage) and syncs with the backend
 * cart API when the user is authenticated.  The cart badge counter is updated
 * on every mutation.
 *
 * Depends on: js/config.js (GlobexCfg), js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexCart.getCart()               → GET  /api/v1/cart  (or local)
 *   GlobexCart.addToCart(productId, qty, meta?)
 *   GlobexCart.updateCartItem(itemId, qty)
 *   GlobexCart.removeFromCart(itemId)
 *   GlobexCart.clearCart()
 *   GlobexCart.getCount()              → number of distinct items
 *   GlobexCart.getTotal()              → sum of price * qty
 */

(function (global) {
  'use strict';

  var CART_KEY = 'gsky_cart';

  // ─── Local storage helpers ─────────────────────────────────────────────────

  function _readLocal() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { return []; }
  }

  function _writeLocal(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) { }
  }

  // ─── API helpers ───────────────────────────────────────────────────────────

  function _authCall(method, path, data) {
    if (global.GlobexUtils && global.GlobexUtils.apiCall) {
      return global.GlobexUtils.apiCall(method, path, data);
    }
    return Promise.reject(new Error('GlobexUtils not loaded'));
  }

  function _isAuth() {
    return !!(global.GlobexUtils && global.GlobexUtils.isLoggedIn && global.GlobexUtils.isLoggedIn());
  }

  // ─── Badge update ──────────────────────────────────────────────────────────

  function updateBadge() {
    var count = getCount();
    document.querySelectorAll('[data-cart-count], .cart-badge, .cart-count').forEach(function (el) {
      el.textContent = count > 99 ? '99+' : String(count);
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  // ─── Get cart ──────────────────────────────────────────────────────────────

  /**
   * Get current cart items.
   * If authenticated, fetches from API and syncs local copy.
   * Otherwise returns the local cart.
   * @returns {Promise<object[]>}
   */
  function getCart() {
    if (_isAuth()) {
      return _authCall('GET', '/cart')
        .then(function (res) {
          var items = (res && (res.data || res.items || res)) || [];
          if (Array.isArray(items)) _writeLocal(items);
          updateBadge();
          return items;
        })
        .catch(function () {
          // Fall back to local cart if API fails
          var local = _readLocal();
          updateBadge();
          return local;
        });
    }
    var local = _readLocal();
    updateBadge();
    return Promise.resolve(local);
  }

  // ─── Add to cart ───────────────────────────────────────────────────────────

  /**
   * Add a product to the cart.
   * @param {string|number} productId
   * @param {number} [qty]
   * @param {object} [meta]  Extra info for local cart: { name, image, price, supplier }
   * @returns {Promise<object[]>}  Updated cart items
   */
  function addToCart(productId, qty, meta) {
    qty = qty || 1;
    meta = meta || {};

    // Optimistically update local cart
    var items = _readLocal();
    var existing = items.find(function (i) { return String(i.product_id || i.id) === String(productId); });
    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      items.push({
        product_id: productId,
        id:         productId,
        quantity:   qty,
        name:       meta.name  || '',
        image:      meta.image || '',
        price:      meta.price || 0,
        supplier:   meta.supplier || '',
      });
    }
    _writeLocal(items);
    updateBadge();

    if (global.GlobexUtils && global.GlobexUtils.showToast) {
      global.GlobexUtils.showToast((meta.name || 'Item') + ' added to cart', 'success');
    }

    // Sync with backend (fire-and-forget if authenticated)
    if (_isAuth()) {
      _authCall('POST', '/cart', { product_id: productId, quantity: qty })
        .then(function (res) {
          var serverItems = (res && (res.data || res.items)) || null;
          if (serverItems && Array.isArray(serverItems)) {
            _writeLocal(serverItems);
            updateBadge();
          }
        })
        .catch(function (err) {
          console.warn('[GlobexCart] Backend sync failed:', err.message);
        });
    }

    return Promise.resolve(items);
  }

  // ─── Update cart item ──────────────────────────────────────────────────────

  /**
   * Update the quantity of a cart item.
   * @param {string|number} itemId  product_id or cart item id
   * @param {number} qty
   * @returns {Promise<object[]>}
   */
  function updateCartItem(itemId, qty) {
    // Update local
    var items = _readLocal();
    var item = items.find(function (i) { return String(i.product_id || i.id) === String(itemId); });
    if (item) item.quantity = qty;
    _writeLocal(items);
    updateBadge();

    if (_isAuth()) {
      return _authCall('PUT', '/cart/' + itemId, { quantity: qty })
        .then(function (res) {
          var serverItems = (res && (res.data || res.items)) || null;
          if (serverItems && Array.isArray(serverItems)) {
            _writeLocal(serverItems);
            updateBadge();
          }
          return _readLocal();
        })
        .catch(function () { return _readLocal(); });
    }
    return Promise.resolve(items);
  }

  // ─── Remove from cart ──────────────────────────────────────────────────────

  /**
   * Remove a cart item.
   * @param {string|number} itemId
   * @returns {Promise<object[]>}
   */
  function removeFromCart(itemId) {
    var items = _readLocal().filter(function (i) {
      return String(i.product_id || i.id) !== String(itemId);
    });
    _writeLocal(items);
    updateBadge();

    if (_isAuth()) {
      _authCall('DELETE', '/cart/' + itemId).catch(function (err) {
        console.warn('[GlobexCart] Remove sync failed:', err.message);
      });
    }
    return Promise.resolve(items);
  }

  // ─── Clear cart ────────────────────────────────────────────────────────────

  /**
   * Empty the entire cart.
   * @returns {Promise<void>}
   */
  function clearCart() {
    _writeLocal([]);
    updateBadge();
    return Promise.resolve();
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  function getCount() {
    return _readLocal().reduce(function (acc, i) { return acc + (i.quantity || 1); }, 0);
  }

  function getTotal() {
    return _readLocal().reduce(function (acc, i) {
      return acc + (Number(i.price || 0) * (i.quantity || 1));
    }, 0);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  // Update badge as soon as the DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
  } else {
    updateBadge();
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexCart = {
    getCart:          getCart,
    addToCart:        addToCart,
    updateCartItem:   updateCartItem,
    removeFromCart:   removeFromCart,
    clearCart:        clearCart,
    getCount:         getCount,
    getTotal:         getTotal,
    updateBadge:      updateBadge,
  };

}(typeof window !== 'undefined' ? window : this));
