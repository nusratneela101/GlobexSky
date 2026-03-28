/**
 * js/cart.js — Real Supabase cart module.
 *
 * Logged-in users: cart persisted in Supabase `cart_items` table.
 * Guest users: localStorage fallback.
 *
 * Depends on:
 *   - Supabase CDN + js/supabase.js (window.supabaseClient)
 *   - js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexCart.getCart()
 *   GlobexCart.addToCart(productId, qty, meta?)
 *   GlobexCart.updateCartItem(productId, qty)
 *   GlobexCart.removeFromCart(productId)
 *   GlobexCart.clearCart()
 *   GlobexCart.getCount()
 *   GlobexCart.getTotal()
 *   GlobexCart.updateBadge()
 */

(function (global) {
  'use strict';

  var CART_KEY = 'gsky_cart';

  function _client() { return global.supabaseClient || null; }

  function _isLoggedIn() {
    return global.GlobexUtils ? global.GlobexUtils.isLoggedIn() : false;
  }

  function _userId() {
    var user = global.GlobexUtils ? global.GlobexUtils.getUser() : null;
    return user ? user.id : null;
  }

  // ─── Local storage helpers ─────────────────────────────────────────────────

  function _readLocal() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { return []; }
  }

  function _writeLocal(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) { }
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
   * Logged-in: fetches from Supabase and caches locally.
   * Guest: returns localStorage cart.
   * @returns {Promise<object[]>}
   */
  function getCart() {
    var sb = _client();
    if (sb && _isLoggedIn()) {
      var uid = _userId();
      if (!uid) {
        var local = _readLocal();
        updateBadge();
        return Promise.resolve(local);
      }
      return sb.from('cart_items')
        .select('*, products(*)')
        .eq('user_id', uid)
        .then(function (result) {
          if (result.error) throw new Error(result.error.message);
          var items = (result.data || []).map(function (row) {
            return {
              id:         row.id,
              product_id: row.product_id,
              quantity:   row.quantity,
              name:       row.products ? row.products.name  : '',
              price:      row.products ? row.products.price : 0,
              image:      row.products && row.products.images ? row.products.images[0] : '',
            };
          });
          _writeLocal(items);
          updateBadge();
          return items;
        })
        .catch(function () {
          var fallback = _readLocal();
          updateBadge();
          return fallback;
        });
    }
    var local = _readLocal();
    updateBadge();
    return Promise.resolve(local);
  }

  // ─── Add to cart ───────────────────────────────────────────────────────────

  /**
   * Add a product to the cart.
   * @param {string} productId
   * @param {number} [qty]
   * @param {object} [meta]  { name, image, price }
   * @returns {Promise<object[]>}
   */
  function addToCart(productId, qty, meta) {
    qty = qty || 1;
    meta = meta || {};

    // Optimistic local update
    var items = _readLocal();
    var existing = items.find(function (i) {
      return String(i.product_id || i.id) === String(productId);
    });
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
      });
    }
    _writeLocal(items);
    updateBadge();

    if (global.GlobexUtils && global.GlobexUtils.showToast) {
      global.GlobexUtils.showToast((meta.name || 'Item') + ' added to cart', 'success');
    }

    var sb = _client();
    if (sb && _isLoggedIn()) {
      var uid = _userId();
      if (uid) {
        sb.from('cart_items')
          .upsert({ user_id: uid, product_id: productId, quantity: qty }, { onConflict: 'user_id,product_id' })
          .then(function (result) {
            if (result.error) console.warn('[GlobexCart] Supabase upsert failed:', result.error.message);
          });
      }
    }

    return Promise.resolve(items);
  }

  // ─── Update cart item ──────────────────────────────────────────────────────

  /**
   * Update quantity of a cart item.
   * @param {string} productId
   * @param {number} qty
   * @returns {Promise<object[]>}
   */
  function updateCartItem(productId, qty) {
    var items = _readLocal();
    var item = items.find(function (i) {
      return String(i.product_id || i.id) === String(productId);
    });
    if (item) item.quantity = qty;
    _writeLocal(items);
    updateBadge();

    var sb = _client();
    if (sb && _isLoggedIn()) {
      var uid = _userId();
      if (uid) {
        sb.from('cart_items')
          .update({ quantity: qty })
          .eq('user_id', uid)
          .eq('product_id', productId)
          .then(function (result) {
            if (result.error) console.warn('[GlobexCart] Update failed:', result.error.message);
          });
      }
    }
    return Promise.resolve(items);
  }

  // ─── Remove from cart ──────────────────────────────────────────────────────

  /**
   * Remove a cart item.
   * @param {string} productId
   * @returns {Promise<object[]>}
   */
  function removeFromCart(productId) {
    var items = _readLocal().filter(function (i) {
      return String(i.product_id || i.id) !== String(productId);
    });
    _writeLocal(items);
    updateBadge();

    var sb = _client();
    if (sb && _isLoggedIn()) {
      var uid = _userId();
      if (uid) {
        sb.from('cart_items')
          .delete()
          .eq('user_id', uid)
          .eq('product_id', productId)
          .then(function (result) {
            if (result.error) console.warn('[GlobexCart] Remove failed:', result.error.message);
          });
      }
    }
    return Promise.resolve(items);
  }

  // ─── Clear cart ────────────────────────────────────────────────────────────

  /**
   * Clear the entire cart.
   * @returns {Promise<void>}
   */
  function clearCart() {
    _writeLocal([]);
    updateBadge();

    var sb = _client();
    if (sb && _isLoggedIn()) {
      var uid = _userId();
      if (uid) {
        sb.from('cart_items').delete().eq('user_id', uid)
          .then(function (result) {
            if (result.error) console.warn('[GlobexCart] Clear failed:', result.error.message);
          });
      }
    }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateBadge();
      // Sync from Supabase on login
      if (_isLoggedIn()) getCart();
    });
  } else {
    updateBadge();
    if (_isLoggedIn()) getCart();
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexCart = {
    getCart:        getCart,
    addToCart:      addToCart,
    updateCartItem: updateCartItem,
    removeFromCart: removeFromCart,
    clearCart:      clearCart,
    getCount:       getCount,
    getTotal:       getTotal,
    updateBadge:    updateBadge,
  };

}(typeof window !== 'undefined' ? window : this));
