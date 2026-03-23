/**
 * Globex Sky – Live Commerce Module
 *
 * Manages product overlays on the live stream, flash deals with countdown,
 * one-click ordering, product pinning, sold animations, and cart integration.
 *
 * Exposes window.LiveCommerce.
 *
 * Usage:
 *   LiveCommerce.init({ streamId, authToken });
 *   LiveCommerce.pinProduct(productData);
 *   LiveCommerce.addFlashDeal({ product, originalPrice, dealPrice, durationSeconds });
 *   LiveCommerce.buyNow(productId, quantity);
 */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────────── */
  let _streamId     = null;
  let _authToken    = null;
  let _pinnedProduct = null;
  let _flashDeal    = null;
  let _flashTimer   = null;
  let _products     = [];
  let _cartCount    = 0;
  let _onCartUpdate = null;

  /* ── DOM helpers ────────────────────────────────────────────────────── */
  function qs(id) { return document.getElementById(id); }
  function create(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  /* ── Toast ───────────────────────────────────────────────────────────── */
  function toast(msg, type) {
    let container = document.getElementById('lc-toast-container');
    if (!container) {
      container = create('div', '');
      container.id = 'lc-toast-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '80px', left: '50%',
        transform: 'translateX(-50%)', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      });
      document.body.appendChild(container);
    }

    const t = create('div', '');
    Object.assign(t.style, {
      background:   type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#0052CC',
      color:        '#fff',
      padding:      '10px 20px',
      borderRadius: '20px',
      fontSize:     '.85rem',
      fontWeight:   '600',
      boxShadow:    '0 4px 16px rgba(0,0,0,.35)',
      opacity:      '0',
      transition:   'opacity .25s',
      textAlign:    'center',
    });
    t.textContent = msg;
    container.appendChild(t);

    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  /* ── Sold animation ─────────────────────────────────────────────────── */
  function _spawnSoldAnimation(container, label) {
    if (!container) return;
    const el = create('div', 'sold-animation', label || '🎉 Sold!');
    container.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  /* ── Product overlay render ─────────────────────────────────────────── */
  function _renderOverlay(product) {
    const overlay = qs('commerceOverlay');
    if (!overlay || !product) return;

    const hasDeal = _flashDeal && _flashDeal.productId === product.id;
    const price   = hasDeal ? _flashDeal.dealPrice : (product.featured_price || product.price || 0);
    const origPrice = hasDeal ? _flashDeal.originalPrice : null;

    overlay.innerHTML = `
      <div class="commerce-overlay-label">
        <i class="fas fa-tag"></i>
        ${hasDeal ? '⚡ Flash Deal' : 'Featured Product'}
      </div>
      <img class="commerce-overlay-img"
           src="${product.image || product.images?.[0] || ''}"
           alt="${product.name || ''}"
           onerror="this.style.display='none'"/>
      <div class="commerce-overlay-name">${product.name || 'Product'}</div>
      <div class="commerce-overlay-price">$${Number(price).toFixed(2)}</div>
      ${origPrice ? `<div class="commerce-overlay-original">$${Number(origPrice).toFixed(2)}</div>` : ''}
      <button class="commerce-buy-btn" id="overlayBuyBtn" onclick="LiveCommerce.buyNow('${product.id}',1)">
        <i class="fas fa-bolt"></i> Buy Now
      </button>
      <div class="commerce-buyers" id="overlayBuyers">
        ${product.buyer_count ? product.buyer_count + ' bought' : ''}
      </div>`;

    overlay.classList.remove('hidden');
  }

  /* ── Flash deal countdown ────────────────────────────────────────────── */
  function _startFlashCountdown(durationSeconds) {
    let remaining = durationSeconds;

    const bannerEl = qs('flashDealBanner');
    if (!bannerEl) return;
    bannerEl.style.display = 'flex';

    function tick() {
      if (remaining <= 0) {
        clearInterval(_flashTimer);
        _flashDeal = null;
        if (bannerEl) bannerEl.style.display = 'none';
        // Re-render overlay without deal
        if (_pinnedProduct) _renderOverlay(_pinnedProduct);
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const el = qs('flashCountdown');
      if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      remaining--;
    }

    tick();
    _flashTimer = setInterval(tick, 1000);
  }

  /* ── Cart UI update ─────────────────────────────────────────────────── */
  function _updateCartBadge() {
    const badge = qs('cartCountBadge');
    if (badge) {
      badge.textContent = _cartCount;
      badge.style.display = _cartCount > 0 ? '' : 'none';
    }
    if (typeof _onCartUpdate === 'function') _onCartUpdate(_cartCount);
  }

  /* ── Products sidebar render ────────────────────────────────────────── */
  function _renderProductsSidebar() {
    const container = qs('liveCommerceProducts');
    if (!container || _products.length === 0) return;

    container.innerHTML = _products.map(p => {
      const pinned = _pinnedProduct && _pinnedProduct.id === p.id;
      return `
        <div class="commerce-card ${pinned ? 'pinned' : ''}" id="card-${p.id}">
          <img class="commerce-card-img"
               src="${p.image || p.images?.[0] || ''}"
               alt="${p.name || ''}"
               onerror="this.style.display='none'"/>
          <div class="commerce-card-body">
            <div class="commerce-card-name">${p.name || 'Product'}</div>
            <div>
              <span class="commerce-card-price">$${Number(p.featured_price || p.price || 0).toFixed(2)}</span>
              ${p.original_price ? `<span class="commerce-card-original">$${Number(p.original_price).toFixed(2)}</span>` : ''}
            </div>
            <button class="commerce-pin-btn ${pinned ? 'pinned' : ''}"
                    onclick="LiveCommerce.pinProduct(${JSON.stringify(p).replace(/"/g,'&quot;')})">
              <i class="fas fa-thumbtack"></i> ${pinned ? 'Pinned' : 'Pin Product'}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════════ */

  const LiveCommerce = {

    /**
     * Initialize the live commerce module.
     * @param {Object} opts
     * @param {string} opts.streamId
     * @param {string} opts.authToken
     * @param {Function} [opts.onCartUpdate]
     */
    init(opts = {}) {
      _streamId     = opts.streamId  || null;
      _authToken    = opts.authToken || null;
      _onCartUpdate = opts.onCartUpdate || null;
      _cartCount    = 0;
      _products     = [];
      _pinnedProduct = null;

      // Hide overlay initially
      const overlay = qs('commerceOverlay');
      if (overlay) overlay.classList.add('hidden');

      // Hide flash banner
      const banner = qs('flashDealBanner');
      if (banner) banner.style.display = 'none';
    },

    /**
     * Load products associated with the stream.
     * @param {Array} products
     */
    loadProducts(products) {
      _products = products || [];
      _renderProductsSidebar();
      // Auto-pin first product
      if (_products.length > 0 && !_pinnedProduct) {
        this.pinProduct(_products[0]);
      }
    },

    /**
     * Pin a product to the overlay (highlight on stream).
     * @param {Object} product
     */
    pinProduct(product) {
      if (!product) return;
      _pinnedProduct = product;
      _renderOverlay(product);
      _renderProductsSidebar();

      // Notify backend (host only)
      if (_authToken && _streamId) {
        fetch(`/api/v1/livestreams/${_streamId}/products/${product.id}/pin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${_authToken}` },
        }).catch(() => {});
      }
    },

    /**
     * Activate a flash deal countdown with special pricing.
     * @param {Object} deal
     * @param {string|Object} deal.product       – product object or ID
     * @param {number}        deal.originalPrice
     * @param {number}        deal.dealPrice
     * @param {number}        deal.durationSeconds – countdown length
     */
    addFlashDeal(deal) {
      if (!deal) return;
      if (_flashTimer) clearInterval(_flashTimer);

      _flashDeal = {
        productId:     typeof deal.product === 'object' ? deal.product.id : deal.product,
        originalPrice: deal.originalPrice,
        dealPrice:     deal.dealPrice,
        product:       deal.product,
      };

      // Update banner text
      const bannerText = qs('flashDealText');
      if (bannerText) {
        const pName = typeof deal.product === 'object' ? deal.product.name : 'Product';
        bannerText.textContent = `⚡ Flash Deal: ${pName} — $${Number(deal.dealPrice).toFixed(2)}`;
      }

      _startFlashCountdown(deal.durationSeconds || 300);

      // Pin deal product
      if (typeof deal.product === 'object') {
        this.pinProduct(deal.product);
      }
    },

    /**
     * One-click buy now.
     * @param {string} productId
     * @param {number} quantity
     */
    async buyNow(productId, quantity = 1) {
      if (!_authToken) {
        toast('Please log in to purchase', 'error');
        return;
      }

      const btn = qs('overlayBuyBtn');
      if (btn) { btn.classList.add('loading'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…'; }

      try {
        const res = await fetch('/api/v1/orders/quick', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${_authToken}`,
          },
          body: JSON.stringify({ product_id: productId, quantity, stream_id: _streamId }),
        });

        const json = await res.json();

        if (json.success) {
          toast('✅ Order placed!', 'success');
          _cartCount++;
          _updateCartBadge();

          // Update buyer count
          const buyersEl = qs('overlayBuyers');
          if (buyersEl) {
            const current = parseInt(buyersEl.textContent) || 0;
            buyersEl.textContent = (current + 1) + ' bought';
          }

          // Sold animation
          const playerWrap = document.querySelector('.stream-player-wrap');
          _spawnSoldAnimation(playerWrap, `🎉 ${quantity > 1 ? quantity + 'x ' : ''}Sold!`);

          // Update product buyer_count in list
          const prod = _products.find(p => p.id === productId);
          if (prod) prod.buyer_count = (prod.buyer_count || 0) + 1;

        } else {
          toast(json.error || 'Order failed. Please try again.', 'error');
        }
      } catch (e) {
        toast('Network error. Please try again.', 'error');
      } finally {
        if (btn) { btn.classList.remove('loading'); btn.innerHTML = '<i class="fas fa-bolt"></i> Buy Now'; }
      }
    },

    /**
     * Add a product to the cart (without immediate checkout).
     * @param {string} productId
     * @param {number} quantity
     */
    async addToCart(productId, quantity = 1) {
      if (!_authToken) {
        toast('Please log in to add to cart', 'error');
        return;
      }

      try {
        const res = await fetch('/api/v1/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${_authToken}`,
          },
          body: JSON.stringify({ product_id: productId, quantity }),
        });

        const json = await res.json();
        if (json.success) {
          _cartCount++;
          _updateCartBadge();
          toast('Added to cart!', 'success');
        } else {
          toast(json.error || 'Could not add to cart', 'error');
        }
      } catch (e) {
        toast('Network error', 'error');
      }
    },

    /** Trigger a sold animation on the stream player. */
    showSoldAnimation(label) {
      const wrap = document.querySelector('.stream-player-wrap');
      _spawnSoldAnimation(wrap, label);
    },

    /** Dismiss the product overlay. */
    hideOverlay() {
      const overlay = qs('commerceOverlay');
      if (overlay) overlay.classList.add('hidden');
    },

    /** Show the product overlay for the currently pinned product. */
    showOverlay() {
      if (_pinnedProduct) _renderOverlay(_pinnedProduct);
    },

    /* ── Getters ─────────────────────────────────────────────────────── */
    get pinnedProduct() { return _pinnedProduct; },
    get flashDeal()     { return _flashDeal; },
    get cartCount()     { return _cartCount; },
    get products()      { return _products; },
  };

  window.LiveCommerce = LiveCommerce;
}());
