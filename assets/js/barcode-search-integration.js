/**
 * Globex Sky — barcode-search-integration.js
 *
 * Integrates the BarcodeScanner with the search page:
 *   - Looks up scanned codes via the backend API
 *   - Shows product details when a barcode matches a known product
 *   - Falls back to a full-text search redirect when no direct match is found
 *
 * Exposes: window.GlobexSky.BarcodeSearch
 * API:
 *   handleScan(code)                 – look up code and navigate/show result
 *   redirectToSearch(code)           – redirect to search page with code as query
 *   lookupBarcode(code)              – Promise → product data or null
 *   showProductCard(product, anchor) – render inline product card near anchor element
 */

(function (global) {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getApiBase() {
    return (global.GlobexConfig && global.GlobexConfig.API_BASE_URL)
      ? global.GlobexConfig.API_BASE_URL
      : 'http://localhost:5000/api/v1';
  }

  function getToken() {
    try {
      const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      return (session && session.token) ? session.token : null;
    } catch (_) {
      return null;
    }
  }

  /* ── API look-up ─────────────────────────────────────────────────── */

  /**
   * Look up a barcode / QR value via the backend.
   * Tries the AI-enhanced endpoint first; falls back to the legacy endpoint.
   *
   * @param  {string} code
   * @returns {Promise<object|null>}  Product object, or null when not found.
   */
  async function lookupBarcode(code) {
    const base = getApiBase();
    const encoded = encodeURIComponent(code);
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const endpoints = [
      base + '/ai/search/barcode/' + encoded,
      base + '/search/barcode/' + encoded,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: 'GET', headers: headers });
        if (!res.ok) continue;
        const data = await res.json();
        // Accept data.product, data.data, or the top-level object if it has an _id
        const product = data.product || data.data || (data._id ? data : null);
        if (product) return product;
      } catch (_) {
        // try next endpoint
      }
    }

    return null;
  }

  /* ── Redirect helper ─────────────────────────────────────────────── */

  /**
   * Redirect to the search results page with the scanned code as the query.
   *
   * @param {string} code
   */
  function redirectToSearch(code) {
    const searchPage = _resolveSearchPath();
    global.location.href = searchPage + '?q=' + encodeURIComponent(code) + '&source=barcode';
  }

  /** Resolve the search-page path relative to the current page. */
  function _resolveSearchPath() {
    // If we're already on a page that lives two levels deep (e.g. pages/search/)
    // we can construct a relative path; otherwise use an absolute one.
    const path = global.location.pathname;
    if (path.includes('/pages/search/')) {
      return 'index.html';
    }
    if (path.includes('/pages/')) {
      return '../search/index.html';
    }
    return '/pages/search/index.html';
  }

  /* ── Product card renderer ───────────────────────────────────────── */

  /**
   * Render a product detail card and insert it into the DOM near `anchor`.
   * Removes any existing card first.
   *
   * @param {object}      product   Product object from the API.
   * @param {HTMLElement} anchor    Element after which the card is inserted.
   */
  function showProductCard(product, anchor) {
    // Remove any stale card
    const existing = document.getElementById('gs-barcode-product-card');
    if (existing) existing.remove();

    const name     = escHtml(product.name || product.title || 'Unknown Product');
    const price    = product.price != null ? Number(product.price) : null;
    const currency = escHtml(product.currency || 'USD');
    const image    = product.image || product.imageUrl || product.thumbnail || '';
    const productId = product._id || product.id || '';
    const productUrl = productId
      ? ('/pages/sourcing/product.html?id=' + encodeURIComponent(productId))
      : ('#');

    const card = document.createElement('div');
    card.id = 'gs-barcode-product-card';
    card.className = 'gs-barcode-product-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Scanned product');
    card.innerHTML =
      '<button class="gs-bpc-close" aria-label="Dismiss product card">&#x2715;</button>' +
      (image ? '<img class="gs-bpc-image" src="' + escHtml(image) + '" alt="' + name + '" loading="lazy"/>' : '') +
      '<div class="gs-bpc-body">' +
        '<p class="gs-bpc-name">' + name + '</p>' +
        (price != null ? '<p class="gs-bpc-price">' + currency + ' ' + price + '</p>' : '') +
        '<a class="gs-bpc-link" href="' + escHtml(productUrl) + '">View product</a>' +
        '<a class="gs-bpc-search-link" href="' + escHtml(_resolveSearchPath()) + '?q=' + encodeURIComponent(product.name || '') + '&source=barcode">Find similar</a>' +
      '</div>';

    // Inject minimal inline styles so the card is functional even if the
    // barcode-scanner CSS is not loaded on the current page.
    _ensureCardStyles();

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    } else {
      document.body.appendChild(card);
    }

    card.querySelector('.gs-bpc-close').addEventListener('click', function () {
      card.remove();
    });

    return card;
  }

  function _ensureCardStyles() {
    if (document.getElementById('gs-bpc-inline-styles')) return;
    const style = document.createElement('style');
    style.id = 'gs-bpc-inline-styles';
    style.textContent = [
      '.gs-barcode-product-card{position:relative;display:flex;align-items:flex-start;gap:12px;background:#fff;',
      'border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:12px 0;',
      'box-shadow:0 4px 16px rgba(0,0,0,.08);animation:gsBpcSlideIn .25s ease;}',
      '@keyframes gsBpcSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
      '.gs-bpc-close{position:absolute;top:8px;right:10px;background:none;border:none;',
      'font-size:1rem;cursor:pointer;color:#64748b;line-height:1;padding:2px 4px;}',
      '.gs-bpc-image{width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;}',
      '.gs-bpc-body{flex:1;min-width:0;}',
      '.gs-bpc-name{font-weight:600;font-size:.95rem;margin:0 0 4px;color:#1a1a2e;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.gs-bpc-price{color:#00C9A7;font-weight:700;font-size:1rem;margin:0 0 8px;}',
      '.gs-bpc-link,.gs-bpc-search-link{display:inline-block;font-size:.82rem;padding:5px 12px;',
      'border-radius:6px;text-decoration:none;margin-right:6px;}',
      '.gs-bpc-link{background:#00C9A7;color:#fff;}',
      '.gs-bpc-search-link{background:#f1f5f9;color:#334155;}',
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Main handler ────────────────────────────────────────────────── */

  /**
   * Handle a scanned barcode value:
   *   1. Look up the barcode via the API.
   *   2a. If a product is found → show the product card near `anchor`.
   *   2b. If no product is found → redirect to the search page.
   *
   * @param {string}           code    Scanned code string.
   * @param {HTMLElement|null} [anchor] Element to render the product card next to.
   * @returns {Promise<void>}
   */
  async function handleScan(code, anchor) {
    if (!code) return;

    let product = null;
    try {
      product = await lookupBarcode(code);
    } catch (_) {
      product = null;
    }

    if (product) {
      showProductCard(product, anchor || document.body);
    } else {
      redirectToSearch(code);
    }
  }

  /* ── Page integration ────────────────────────────────────────────── */

  /**
   * Wire the BarcodeSearch integration into a BarcodeScanner instance.
   * Call this once the scanner and its container are initialised.
   *
   * @param {object}      scanner     Instance returned by GlobexSky.BarcodeScanner.init()
   * @param {HTMLElement} [container] Container element to anchor the product card.
   */
  function attachToScanner(scanner, container) {
    if (!scanner || typeof scanner.onScan !== 'function') return;
    scanner.onScan(function (code) {
      handleScan(code, container || null);
    });
  }

  /**
   * Read the `?q=` (or `?barcode=`) query parameter from the current URL
   * and, if present, trigger `handleScan` automatically.
   * Useful on search pages that receive a barcode redirect.
   *
   * @param {HTMLElement|null} [anchor]
   */
  function handleUrlBarcode(anchor) {
    const params = new URLSearchParams(global.location.search);
    const code = params.get('q') || params.get('barcode');
    const source = params.get('source');
    if (code && source === 'barcode') {
      handleScan(code, anchor || null);
    }
  }

  /* ── Namespace ───────────────────────────────────────────────────── */

  global.GlobexSky = global.GlobexSky || {};

  /**
   * GlobexSky.BarcodeSearch
   *
   * Integration layer between the BarcodeScanner and the search/product pages.
   */
  global.GlobexSky.BarcodeSearch = {
    /**
     * Look up a barcode via the API.
     * @param  {string} code
     * @returns {Promise<object|null>}
     */
    lookupBarcode: lookupBarcode,

    /**
     * Redirect to the search results page for the given code.
     * @param {string} code
     */
    redirectToSearch: redirectToSearch,

    /**
     * Show an inline product card anchored to a DOM element.
     * @param {object}      product
     * @param {HTMLElement} anchor
     * @returns {HTMLElement} The card element.
     */
    showProductCard: showProductCard,

    /**
     * Look up a scanned code and either show a product card or redirect.
     * @param {string}           code
     * @param {HTMLElement|null} [anchor]
     * @returns {Promise<void>}
     */
    handleScan: handleScan,

    /**
     * Attach the BarcodeSearch integration to a BarcodeScanner instance.
     * @param {object}      scanner
     * @param {HTMLElement} [container]
     */
    attachToScanner: attachToScanner,

    /**
     * If the current URL contains `?q=...&source=barcode`, look up and show
     * the product card automatically. Call this from the search page's init.
     * @param {HTMLElement|null} [anchor]
     */
    handleUrlBarcode: handleUrlBarcode,
  };

}(window));
