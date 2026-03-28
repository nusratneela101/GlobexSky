/**
 * js/products.js — Product data loader module.
 *
 * Depends on: js/config.js (GlobexCfg), js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexProducts.getProducts(filters)   → GET /api/v1/products
 *   GlobexProducts.getProductById(id)     → GET /api/v1/products/:id
 *   GlobexProducts.searchProducts(query)  → GET /api/v1/search
 *   GlobexProducts.getCategories()        → GET /api/v1/categories
 *   GlobexProducts.getFeatured()          → GET /api/v1/products?featured=true
 *   GlobexProducts.getTrending()          → GET /api/v1/products?sort=trending
 */

(function (global) {
  'use strict';

  function _api(method, path, data) {
    if (global.GlobexUtils && global.GlobexUtils.apiCall) {
      return global.GlobexUtils.apiCall(method, path, data);
    }
    var baseUrl = (global.GlobexCfg && global.GlobexCfg.apiBaseUrl) || '/api/v1';
    return fetch(baseUrl + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    }).then(function (r) { return r.json(); });
  }

  function _qs(obj) {
    if (!obj) return '';
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  // ─── API methods ───────────────────────────────────────────────────────────

  /**
   * Get a list of products with optional filters.
   * @param {object} [filters]  { category, sort, page, limit, minPrice, maxPrice, ... }
   * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
   */
  function getProducts(filters) {
    return _api('GET', '/products' + _qs(filters));
  }

  /**
   * Get a single product by ID.
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  function getProductById(id) {
    return _api('GET', '/products/' + id);
  }

  /**
   * Search products by a query string.
   * @param {string} query
   * @param {object} [extra]  Additional filter params
   * @returns {Promise<object>}
   */
  function searchProducts(query, extra) {
    var params = Object.assign({ q: query }, extra || {});
    return _api('GET', '/search' + _qs(params));
  }

  /**
   * Get the list of product categories.
   * @returns {Promise<{data: object[]}>}
   */
  function getCategories() {
    return _api('GET', '/categories');
  }

  /**
   * Get featured products.
   * @param {number} [limit]
   * @returns {Promise<object>}
   */
  function getFeatured(limit) {
    return getProducts({ featured: 'true', limit: limit || 12 });
  }

  /**
   * Get trending products.
   * @param {number} [limit]
   * @returns {Promise<object>}
   */
  function getTrending(limit) {
    return getProducts({ sort: 'trending', limit: limit || 12 });
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  /**
   * Render a product card HTML string from an API product object.
   * @param {object} product
   * @returns {string} HTML string
   */
  function renderProductCard(product) {
    var id         = product.id || '';
    var name       = product.name || product.title || 'Product';
    var price      = Number(product.price || product.min_price || 0).toFixed(2);
    var image      = product.image_url || product.thumbnail || product.image || '/assets/images/placeholder.png';
    var supplier   = (product.supplier && (product.supplier.name || product.supplier.company_name)) || '';
    var badge      = product.badge || '';
    var rating     = Number(product.average_rating || product.rating || 0).toFixed(1);
    var reviewCount = product.review_count || product.reviews_count || 0;

    return '<div class="product-card" data-product-id="' + id + '">' +
      (badge ? '<span class="product-badge">' + badge + '</span>' : '') +
      '<a href="/pages/product/index.html?id=' + id + '">' +
        '<img src="' + image + '" alt="' + name + '" loading="lazy" onerror="this.src=\'/assets/images/placeholder.png\'">' +
      '</a>' +
      '<div class="product-card-body">' +
        '<h3 class="product-name"><a href="/pages/product/index.html?id=' + id + '">' + name + '</a></h3>' +
        (supplier ? '<p class="product-supplier">' + supplier + '</p>' : '') +
        '<div class="product-price">$' + price + '</div>' +
        (rating > 0 ?
          '<div class="product-rating"><i class="fas fa-star"></i> ' + rating +
          (reviewCount ? ' <span>(' + reviewCount + ')</span>' : '') + '</div>' : '') +
        '<button class="btn btn-primary btn-sm" data-add-to-cart data-product-id="' + id + '">' +
          '<i class="fas fa-cart-plus"></i> Add to Cart' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Load products from the API and render them into a container element.
   * @param {HTMLElement|string} container  Element or CSS selector
   * @param {object} [filters]
   * @returns {Promise<void>}
   */
  function loadIntoContainer(container, filters) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return Promise.resolve();

    container.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:40px">' +
      '<i class="fas fa-spinner fa-spin fa-2x" style="color:#0052CC"></i></div>';

    return getProducts(filters)
      .then(function (res) {
        var products = (res && (res.data || res.products || res)) || [];
        if (!Array.isArray(products)) products = [];
        if (products.length === 0) {
          container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px">No products found.</p>';
          return;
        }
        container.innerHTML = products.map(renderProductCard).join('');
      })
      .catch(function (err) {
        console.warn('[GlobexProducts] Load failed:', err.message);
        container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px">Could not load products.</p>';
      });
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexProducts = {
    getProducts:        getProducts,
    getProductById:     getProductById,
    searchProducts:     searchProducts,
    getCategories:      getCategories,
    getFeatured:        getFeatured,
    getTrending:        getTrending,
    renderProductCard:  renderProductCard,
    loadIntoContainer:  loadIntoContainer,
  };

}(typeof window !== 'undefined' ? window : this));
