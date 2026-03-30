/**
 * Globex Sky — product-api.js
 * Wires up product listing, detail, search, cart, and wishlist pages
 * to the real backend API via window.API.
 */

(function () {
  'use strict';

  /* ─── Utility Helpers ────────────────────────────────────────────────── */

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function sanitizeHTML(html) {
    if (window.GlobexSanitize) return window.GlobexSanitize.sanitizeHTML(html);
    // Fallback: encode as escaped text if sanitize.js not loaded
    var div = document.createElement('div');
    div.textContent = String(html || '');
    return div.innerHTML;
  }

  function validateId(value) {
    if (window.GlobexSanitize) return window.GlobexSanitize.validateId(value);
    return /^\d{1,19}$|^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
      ? String(value).trim() : '';
  }

  function showMessage(selector, message, type) {
    const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) return;
    el.className = `api-message api-message--${type}`;
    el.textContent = message;
    el.style.display = 'block';
  }

  function renderSkeleton(container, count) {
    if (!container) return;
    container.innerHTML = Array(count).fill(
      '<div class="product-card skeleton"><div class="skeleton-img"></div>' +
      '<div class="skeleton-line"></div><div class="skeleton-line short"></div></div>'
    ).join('');
  }

  function formatPrice(amount, currency) {
    currency = currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch (_) {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  }

  function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      '<i class="fas fa-star" aria-hidden="true"></i>'.repeat(full) +
      (half ? '<i class="fas fa-star-half-alt" aria-hidden="true"></i>' : '') +
      '<i class="far fa-star" aria-hidden="true"></i>'.repeat(empty)
    );
  }

  /* ─── Product Card Builder ───────────────────────────────────────────── */

  function buildProductCard(product) {
    const price = product.min_price || product.price || 0;
    const originalPrice = product.original_price || product.max_price || null;
    const hasDiscount = originalPrice && originalPrice > price;
    const discount = hasDiscount
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    return `
      <article class="product-card" data-product-id="${product.id}">
        <a href="/pages/sourcing/product-detail.html?id=${product.id}" class="product-card__img-link">
          <img src="${product.main_image || '/assets/images/placeholder.jpg'}"
               alt="${product.name || 'Product'}"
               loading="lazy"
               class="product-card__img"/>
          ${hasDiscount ? `<span class="product-card__badge">-${discount}%</span>` : ''}
        </a>
        <div class="product-card__body">
          <p class="product-card__supplier">${product.supplier_name || ''}</p>
          <h3 class="product-card__name">
            <a href="/pages/sourcing/product-detail.html?id=${product.id}">${product.name || ''}</a>
          </h3>
          <div class="product-card__rating">
            ${renderStars(product.avg_rating || 0)}
            <span class="product-card__rating-count">(${product.review_count || 0})</span>
          </div>
          <div class="product-card__price">
            <span class="product-card__price-current">${formatPrice(price)}</span>
            ${hasDiscount ? `<span class="product-card__price-original">${formatPrice(originalPrice)}</span>` : ''}
          </div>
          <div class="product-card__moq">MOQ: ${product.moq || 1} ${product.moq_unit || 'pcs'}</div>
          <div class="product-card__actions">
            <button class="btn btn-primary btn-sm btn-add-to-cart"
                    data-id="${product.id}"
                    data-name="${product.name}"
                    data-price="${price}">Add to Cart</button>
            <button class="btn btn-secondary btn-sm btn-wishlist"
                    data-id="${product.id}"
                    aria-label="Add to wishlist">
              <i class="far fa-heart" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </article>`;
  }

  /* ─── Product Listing Page ───────────────────────────────────────────── */

  async function initProductListing() {
    const grid = document.getElementById('products-grid') ||
      document.querySelector('.products-grid');
    if (!grid) return;

    const params = {
      page: getParam('page') || 1,
      limit: getParam('limit') || 24,
      category: getParam('category') || undefined,
      sort: getParam('sort') || 'newest',
      q: getParam('q') || undefined,
    };

    // Remove undefined keys
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

    renderSkeleton(grid, 12);

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.products.list(params);
      const products = res.data || res.products || res || [];
      const total = res.total || res.meta?.total || products.length;

      if (!products.length) {
        grid.innerHTML = '<p class="no-results">No products found. Try adjusting your filters.</p>';
        return;
      }

      grid.innerHTML = products.map(buildProductCard).join('');
      updateResultCount(total);
      renderPagination(total, Number(params.page), Number(params.limit));
    } catch (err) {
      grid.innerHTML = `<p class="api-error">Failed to load products. Please try again later.</p>`;
      console.error('[product-api] listing error:', err);
    }
  }

  function updateResultCount(total) {
    const el = document.querySelector('.results-count, #results-count');
    if (el) el.textContent = `${total} products found`;
  }

  function renderPagination(total, currentPage, limit) {
    const container = document.getElementById('pagination') ||
      document.querySelector('.pagination');
    if (!container || !total) return;

    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      const params = new URLSearchParams(window.location.search);
      params.set('page', i);
      pages.push(
        `<a href="?${params.toString()}" class="pagination__btn ${i === currentPage ? 'active' : ''}">${i}</a>`
      );
    }
    container.innerHTML = pages.join('');
  }

  /* ─── Product Search ─────────────────────────────────────────────────── */

  async function initProductSearch() {
    const searchForms = document.querySelectorAll(
      '.search-form, #search-form, form[data-search="products"]'
    );
    searchForms.forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = form.querySelector('[name="q"], input[type="search"]')?.value.trim() || '';
        if (!q) return;
        const params = new URLSearchParams(window.location.search);
        params.set('q', q);
        params.set('page', '1');
        window.location.href = `/pages/sourcing/products.html?${params.toString()}`;
      });
    });

    // Auto-search if ?q= present on products page
    if (getParam('q') && (
      document.getElementById('products-grid') ||
      document.querySelector('.products-grid')
    )) {
      initProductListing();
    }
  }

  /* ─── Product Detail Page ────────────────────────────────────────────── */

  async function initProductDetail() {
    const detailRoot = document.getElementById('product-detail') ||
      document.querySelector('.product-detail');
    if (!detailRoot) return;

    const id = validateId(getParam('id'));
    if (!id) return;

    try {
      if (!window.API) throw new Error('API not available');
      const res = await window.API.products.get(id);
      const product = res.data || res;

      // Populate name
      document.querySelectorAll('[data-product-name]').forEach((el) => {
        el.textContent = product.name || '';
      });
      // Populate description (sanitized to prevent XSS)
      document.querySelectorAll('[data-product-description]').forEach((el) => {
        el.innerHTML = sanitizeHTML(product.description || '');
      });
      // Populate price
      document.querySelectorAll('[data-product-price]').forEach((el) => {
        el.textContent = formatPrice(product.min_price || product.price || 0);
      });
      // Populate main image
      const mainImg = document.querySelector('[data-product-image]');
      if (mainImg) {
        mainImg.src = product.main_image || '/assets/images/placeholder.jpg';
        mainImg.alt = product.name || '';
      }
      // Populate supplier
      document.querySelectorAll('[data-product-supplier]').forEach((el) => {
        el.textContent = product.supplier_name || '';
      });
      // Populate MOQ
      document.querySelectorAll('[data-product-moq]').forEach((el) => {
        el.textContent = `${product.moq || 1} ${product.moq_unit || 'pcs'}`;
      });

      // Set page title
      if (product.name) document.title = `${product.name} | Globex Sky`;

      // Wire add-to-cart button
      const cartBtn = document.getElementById('add-to-cart-btn') ||
        document.querySelector('[data-action="add-to-cart"]');
      if (cartBtn) {
        cartBtn.addEventListener('click', () => addToCart(product));
      }

      // Wire wishlist button
      const wishBtn = document.getElementById('add-to-wishlist-btn') ||
        document.querySelector('[data-action="add-to-wishlist"]');
      if (wishBtn) {
        wishBtn.addEventListener('click', () => addToWishlist(product.id));
      }
    } catch (err) {
      detailRoot.innerHTML = '<p class="api-error">Product not found or failed to load.</p>';
      console.error('[product-api] detail error:', err);
    }
  }

  /* ─── Cart ───────────────────────────────────────────────────────────── */

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem('globexCart') || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem('globexCart', JSON.stringify(cart));
    updateCartBadge(cart.reduce((sum, i) => sum + i.quantity, 0));
  }

  function updateCartBadge(count) {
    document.querySelectorAll('.cart-badge, [data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  function addToCart(product) {
    const cart = getCart();
    const existing = cart.find((i) => i.id === product.id);
    const qty = parseInt(
      document.querySelector('[name="quantity"], #product-qty')?.value || '1',
      10
    );

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.min_price || product.price || 0,
        image: product.main_image || '',
        quantity: qty,
        moq: product.moq || 1,
      });
    }
    saveCart(cart);

    if (window.GlobexSky && window.GlobexSky.showToast) {
      window.GlobexSky.showToast('Added to cart!', 'success');
    } else {
      alert('Added to cart!');
    }
  }

  function addToWishlist(productId) {
    try {
      const wishlist = JSON.parse(localStorage.getItem('globexWishlist') || '[]');
      if (!wishlist.includes(productId)) {
        wishlist.push(productId);
        localStorage.setItem('globexWishlist', JSON.stringify(wishlist));
      }
      if (window.GlobexSky && window.GlobexSky.showToast) {
        window.GlobexSky.showToast('Added to wishlist!', 'success');
      }
    } catch (_) {}
  }

  /* ─── Delegated add-to-cart clicks on listing pages ─────────────────── */

  function initDelegatedCartEvents() {
    document.addEventListener('click', async (e) => {
      const cartBtn = e.target.closest('.btn-add-to-cart');
      if (cartBtn) {
        e.preventDefault();
        const id = cartBtn.dataset.id;
        const name = cartBtn.dataset.name;
        const price = parseFloat(cartBtn.dataset.price) || 0;
        addToCart({ id, name, price, main_image: '' });
      }

      const wishBtn = e.target.closest('.btn-wishlist');
      if (wishBtn) {
        e.preventDefault();
        addToWishlist(wishBtn.dataset.id);
      }
    });
  }

  /* ─── Init on DOMContentLoaded ───────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    // Restore cart badge count
    const cart = getCart();
    updateCartBadge(cart.reduce((sum, i) => sum + i.quantity, 0));

    initProductSearch();
    initProductListing();
    initProductDetail();
    initDelegatedCartEvents();
  });

  /* ─── Exports ────────────────────────────────────────────────────────── */
  window.GlobexProducts = { addToCart, addToWishlist, getCart, saveCart };
})();
