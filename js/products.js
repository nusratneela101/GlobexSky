/**
 * js/products.js — Real Supabase products module.
 *
 * Depends on:
 *   - Supabase CDN + js/supabase.js (window.supabaseClient)
 *   - js/utils.js (GlobexUtils)
 *
 * Functions:
 *   GlobexProducts.getProducts(filters)
 *   GlobexProducts.getProductById(id)
 *   GlobexProducts.searchProducts(query, extra)
 *   GlobexProducts.getCategories()
 *   GlobexProducts.getFeatured(limit)
 *   GlobexProducts.renderProductCard(product)
 *   GlobexProducts.loadIntoContainer(container, filters)
 */

(function (global) {
  'use strict';

  function _client() {
    return global.supabaseClient || null;
  }

  // ─── Escape for HTML ───────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Get products ──────────────────────────────────────────────────────────

  /**
   * Get products from Supabase with optional filters.
   * @param {object} [filters]  { category, limit, page, minPrice, maxPrice, search }
   * @returns {Promise<object[]>}
   */
  function getProducts(filters) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));

    filters = filters || {};
    var query = sb.from('products').select('*').eq('is_active', true);

    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.minPrice !== undefined && filters.minPrice !== null) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters.search) {
      query = query.or('name.ilike.%' + filters.search + '%,description.ilike.%' + filters.search + '%');
    }

    var limit = filters.limit || 20;
    var page  = filters.page  || 1;
    var from  = (page - 1) * limit;
    query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    });
  }

  /**
   * Get a single product by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  function getProductById(id) {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.from('products').select('*').eq('id', id).single()
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        return result.data || null;
      });
  }

  /**
   * Search products by query string.
   * @param {string} query
   * @param {object} [extra]
   * @returns {Promise<object[]>}
   */
  function searchProducts(query, extra) {
    return getProducts(Object.assign({ search: query }, extra || {}));
  }

  /**
   * Get distinct product categories.
   * @returns {Promise<string[]>}
   */
  function getCategories() {
    var sb = _client();
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));
    return sb.from('products').select('category').eq('is_active', true)
      .then(function (result) {
        if (result.error) throw new Error(result.error.message);
        var cats = {};
        (result.data || []).forEach(function (r) { if (r.category) cats[r.category] = true; });
        return Object.keys(cats).sort();
      });
  }

  /**
   * Get featured/latest products.
   * @param {number} [limit]
   * @returns {Promise<object[]>}
   */
  function getFeatured(limit) {
    return getProducts({ limit: limit || 12 });
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  /**
   * Render a product card HTML string.
   * @param {object} product
   * @returns {string}
   */
  function renderProductCard(product) {
    var id    = _esc(product.id || '');
    var name  = _esc(product.name || 'Product');
    var price = Number(product.price || 0).toFixed(2);
    var origPrice = product.original_price ? Number(product.original_price).toFixed(2) : null;
    var images = product.images;
    var image = (Array.isArray(images) && images.length > 0)
      ? _esc(images[0])
      : _esc(product.image_url || product.image || '/assets/images/placeholder.png');
    var rating     = Number(product.rating || 0).toFixed(1);
    var reviewCount = product.review_count || 0;
    var category   = _esc(product.category || '');

    var discount = '';
    if (origPrice && Number(origPrice) > Number(price)) {
      var pct = Math.round((1 - Number(price) / Number(origPrice)) * 100);
      discount = '<span class="product-badge" style="background:#ef4444;color:#fff;font-size:.72rem;padding:2px 8px;border-radius:4px;position:absolute;top:8px;left:8px">-' + pct + '%</span>';
    }

    return '<div class="product-card" data-product-id="' + id + '" style="position:relative">' +
      discount +
      '<a href="/pages/product/index.html?id=' + id + '">' +
        '<img src="' + image + '" alt="' + name + '" loading="lazy" ' +
          'onerror="this.src=\'/assets/images/placeholder.png\'" ' +
          'style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0">' +
      '</a>' +
      '<div class="product-card-body" style="padding:12px">' +
        (category ? '<span style="font-size:.72rem;color:#0052CC;font-weight:600;text-transform:uppercase">' + category + '</span>' : '') +
        '<h3 class="product-name" style="font-size:.9rem;font-weight:600;margin:6px 0">' +
          '<a href="/pages/product/index.html?id=' + id + '" style="color:#1e293b;text-decoration:none">' + name + '</a>' +
        '</h3>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<span style="font-size:1rem;font-weight:700;color:#0052CC">$' + price + '</span>' +
          (origPrice ? '<span style="font-size:.82rem;color:#94a3b8;text-decoration:line-through">$' + origPrice + '</span>' : '') +
        '</div>' +
        (Number(rating) > 0 ?
          '<div style="font-size:.78rem;color:#f59e0b;margin-bottom:8px">' +
            '★ ' + rating + (reviewCount ? ' <span style="color:#94a3b8">(' + reviewCount + ')</span>' : '') +
          '</div>' : '') +
        '<button class="btn btn-primary btn-sm" data-add-to-cart data-product-id="' + id + '" ' +
          'style="width:100%;background:#0052CC;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;font-size:.85rem">' +
          '<i class="fas fa-cart-plus"></i> Add to Cart' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Load products into a container element.
   * @param {HTMLElement|string} container
   * @param {object} [filters]
   * @returns {Promise<void>}
   */
  function loadIntoContainer(container, filters) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return Promise.resolve();

    container.innerHTML = '<div style="text-align:center;padding:40px">' +
      '<i class="fas fa-spinner fa-spin fa-2x" style="color:#0052CC"></i></div>';

    return getProducts(filters)
      .then(function (products) {
        if (!products || products.length === 0) {
          container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px">No products found.</p>';
          return;
        }
        container.innerHTML = products.map(renderProductCard).join('');

        // Wire up Add-to-Cart buttons
        container.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var pid = btn.getAttribute('data-product-id');
            if (global.GlobexCart && global.GlobexCart.addToCart) {
              getProductById(pid).then(function (p) {
                if (p) global.GlobexCart.addToCart(pid, 1, {
                  name: p.name, price: p.price,
                  image: (Array.isArray(p.images) ? p.images[0] : p.image_url) || '',
                });
              }).catch(function () {
                global.GlobexCart.addToCart(pid, 1);
              });
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[GlobexProducts] Load failed:', err.message);
        container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px">Could not load products.</p>';
      });
  }

  // ─── Expose globally ───────────────────────────────────────────────────────

  global.GlobexProducts = {
    getProducts:       getProducts,
    getProductById:    getProductById,
    searchProducts:    searchProducts,
    getCategories:     getCategories,
    getFeatured:       getFeatured,
    renderProductCard: renderProductCard,
    loadIntoContainer: loadIntoContainer,
  };

}(typeof window !== 'undefined' ? window : this));
