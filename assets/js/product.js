/**
 * Globex Sky — product.js
 * Product page logic: image gallery, zoom, 360° view, tiered pricing,
 * quantity selector with MOQ enforcement, wishlist, quotation/sample forms,
 * contact supplier, social sharing, reviews pagination, related products.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let _product     = null;
  let _activeImage = 0;
  let _quantity    = 1;
  let _variation   = {};

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    const productId = _getProductId();
    if (!productId) return;

    _loadProduct(productId).then(() => {
      _initGallery();
      _initQuantitySelector();
      _initVariationPicker();
      _initWishlistButton();
      _initShareButtons();
      _initContactForms();
      _initReviews(productId);
      _initRelatedProducts();
    });
  });

  /* ─────────────────────────────────────────────
     PRODUCT LOADING
  ───────────────────────────────────────────── */
  function _getProductId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('product_id');
  }

  async function _loadProduct(id) {
    const api = window.ApiClient || window.API;
    if (!api) return;
    try {
      const res = await api.products.get(id);
      _product = res.data || res;
      _renderProductData(_product);
    } catch (err) {
      console.error('[Product] Failed to load product:', err);
    }
  }

  function _renderProductData(p) {
    _setText('[data-product-name]', p.name);
    _setText('[data-product-description]', p.description);
    _setText('[data-product-supplier]', p.supplier?.name);
    _setText('[data-product-sku]', p.sku);
    _setText('[data-product-moq]', p.moq ? `Min. Order: ${p.moq} ${p.unit || 'units'}` : '');

    // Price
    _renderTieredPricing(p.pricing || p.tiered_pricing);
    if (p.price) {
      _setText('[data-product-price]',
        window.Currency ? window.Currency.formatFromUSD(p.price) : `$${p.price}`);
    }

    // Stock badge
    const stockEl = document.querySelector('[data-product-stock]');
    if (stockEl) {
      stockEl.textContent = p.stock > 0 ? `In Stock (${p.stock})` : 'Out of Stock';
      stockEl.dataset.inStock = p.stock > 0 ? '1' : '0';
    }

    // Rating
    if (p.rating) {
      _setText('[data-product-rating]', p.rating.toFixed(1));
      _setText('[data-product-reviews-count]', `(${p.reviews_count || 0} reviews)`);
      _renderStars('[data-product-stars]', p.rating);
    }

    // Set initial MOQ as quantity
    if (p.moq) {
      _quantity = p.moq;
      const qtyInput = document.querySelector('[data-qty-input]');
      if (qtyInput) qtyInput.value = _quantity;
    }
  }

  /* ─────────────────────────────────────────────
     TIERED PRICING
  ───────────────────────────────────────────── */
  function _renderTieredPricing(tiers) {
    const container = document.querySelector('[data-tiered-pricing]');
    if (!container || !tiers || !tiers.length) return;

    container.innerHTML = tiers.map((tier) => `
      <div class="pricing-tier">
        <span class="tier-qty">${tier.min_qty}${tier.max_qty ? `–${tier.max_qty}` : '+'} units</span>
        <span class="tier-price">${
          window.Currency ? window.Currency.formatFromUSD(tier.price) : `$${tier.price}`
        }</span>
      </div>`).join('');

    container.addEventListener('click', (e) => {
      const tier = e.target.closest('.pricing-tier');
      if (tier) {
        container.querySelectorAll('.pricing-tier').forEach((t) => t.classList.remove('selected'));
        tier.classList.add('selected');
      }
    });
  }

  function _getActiveTierPrice() {
    if (!_product) return 0;
    const tiers = _product.pricing || _product.tiered_pricing;
    if (tiers && tiers.length) {
      const tier = tiers
        .filter((t) => _quantity >= t.min_qty)
        .sort((a, b) => b.min_qty - a.min_qty)[0];
      return tier ? tier.price : (_product.price || 0);
    }
    return _product.price || 0;
  }

  /* ─────────────────────────────────────────────
     IMAGE GALLERY
  ───────────────────────────────────────────── */
  function _initGallery() {
    const mainImg   = document.querySelector('[data-gallery-main]');
    const thumbsEl  = document.querySelector('[data-gallery-thumbs]');
    const prevBtn   = document.querySelector('[data-gallery-prev]');
    const nextBtn   = document.querySelector('[data-gallery-next]');
    const zoomBtn   = document.querySelector('[data-gallery-zoom]');

    if (!mainImg) return;

    function showImage(idx) {
      const images = _product?.images || [];
      if (!images.length) return;
      _activeImage = (idx + images.length) % images.length;
      mainImg.src = images[_activeImage];
      mainImg.alt = _product.name || '';

      // Highlight active thumbnail
      if (thumbsEl) {
        thumbsEl.querySelectorAll('[data-thumb-idx]').forEach((t, i) => {
          t.classList.toggle('active', i === _activeImage);
        });
      }
    }

    // Render thumbnails
    if (thumbsEl && _product?.images) {
      thumbsEl.innerHTML = _product.images.map((src, i) => `
        <img src="${_escapeAttr(src)}" alt="Image ${i + 1}"
             class="gallery-thumb${i === 0 ? ' active' : ''}"
             data-thumb-idx="${i}" loading="lazy">`).join('');

      thumbsEl.addEventListener('click', (e) => {
        const thumb = e.target.closest('[data-thumb-idx]');
        if (thumb) showImage(parseInt(thumb.dataset.thumbIdx, 10));
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => showImage(_activeImage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showImage(_activeImage + 1));

    // Keyboard navigation
    mainImg.setAttribute('tabindex', '0');
    mainImg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') showImage(_activeImage - 1);
      if (e.key === 'ArrowRight') showImage(_activeImage + 1);
    });

    // Zoom (CSS class toggle)
    if (zoomBtn) {
      zoomBtn.addEventListener('click', () => mainImg.classList.toggle('gallery-zoomed'));
    }
    mainImg.addEventListener('click', () => {
      if (mainImg.classList.contains('gallery-zoomed')) {
        mainImg.classList.remove('gallery-zoomed');
      }
    });

    // Touch swipe
    let _touchStart = 0;
    mainImg.addEventListener('touchstart', (e) => { _touchStart = e.touches[0].clientX; }, { passive: true });
    mainImg.addEventListener('touchend', (e) => {
      const diff = _touchStart - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) showImage(diff > 0 ? _activeImage + 1 : _activeImage - 1);
    });

    showImage(0);
  }

  /* ─────────────────────────────────────────────
     QUANTITY SELECTOR
  ───────────────────────────────────────────── */
  function _initQuantitySelector() {
    const qtyInput = document.querySelector('[data-qty-input]');
    const minusBtn = document.querySelector('[data-qty-minus]');
    const plusBtn  = document.querySelector('[data-qty-plus]');
    const priceEl  = document.querySelector('[data-product-price]');

    function _updatePrice() {
      if (!priceEl || !_product) return;
      const price = _getActiveTierPrice() * _quantity;
      priceEl.textContent = window.Currency
        ? window.Currency.formatFromUSD(price)
        : `$${price.toFixed(2)}`;
    }

    function setQty(val) {
      const moq = _product?.moq || 1;
      _quantity = Math.max(moq, Math.min(val, _product?.stock ?? 99999));
      if (qtyInput) qtyInput.value = _quantity;
      _updatePrice();
    }

    if (minusBtn) minusBtn.addEventListener('click', () => setQty(_quantity - 1));
    if (plusBtn)  plusBtn.addEventListener('click',  () => setQty(_quantity + 1));
    if (qtyInput) {
      qtyInput.addEventListener('change', () => setQty(parseInt(qtyInput.value, 10) || 1));
    }

    // Add to cart button
    const addCartBtn = document.querySelector('[data-add-to-cart]');
    if (addCartBtn) {
      addCartBtn.addEventListener('click', () => {
        if (!_product) return;
        const cartFn = window.addToCart || (window.Cart && window.Cart.add);
        if (cartFn) {
          cartFn({
            id: _product.id,
            name: _product.name,
            image: _product.images?.[0] || '',
            price: _getActiveTierPrice(),
            quantity: _quantity,
            supplier: _product.supplier?.name || '',
            minOrder: _product.moq || 1,
            variation: _variation,
          });
        }
      });
    }
  }

  /* ─────────────────────────────────────────────
     VARIATION PICKER
  ───────────────────────────────────────────── */
  function _initVariationPicker() {
    document.querySelectorAll('[data-variation-group]').forEach((group) => {
      const attribute = group.dataset.variationGroup;
      group.querySelectorAll('[data-variation-option]').forEach((opt) => {
        opt.addEventListener('click', () => {
          group.querySelectorAll('[data-variation-option]').forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
          _variation[attribute] = opt.dataset.variationOption;
        });
      });
    });
  }

  /* ─────────────────────────────────────────────
     WISHLIST
  ───────────────────────────────────────────── */
  function _initWishlistButton() {
    const btn = document.querySelector('[data-wishlist-btn]');
    if (!btn || !_product) return;

    // Check if already wishlisted
    const wishlist = _getLocalWishlist();
    const isWished = wishlist.includes(String(_product.id));
    btn.classList.toggle('active', isWished);
    btn.setAttribute('aria-pressed', String(isWished));

    btn.addEventListener('click', async () => {
      const api = window.ApiClient || window.API;
      const id  = _product.id;
      const wished = btn.classList.contains('active');

      try {
        if (wished) {
          if (api) await api.user.removeFromWishlist(id);
          _removeLocalWishlist(id);
        } else {
          if (api) await api.user.addToWishlist(id);
          _addLocalWishlist(id);
        }
        btn.classList.toggle('active', !wished);
        btn.setAttribute('aria-pressed', String(!wished));

        if (window.GlobexSky?.showToast) {
          window.GlobexSky.showToast(wished ? 'Removed from wishlist' : 'Added to wishlist', 'success');
        }
      } catch (_) {
        if (window.GlobexSky?.showToast) {
          window.GlobexSky.showToast('Please log in to use wishlist', 'warning');
        }
      }
    });
  }

  function _getLocalWishlist() {
    try { return JSON.parse(localStorage.getItem('globexWishlist') || '[]'); } catch (_) { return []; }
  }
  function _addLocalWishlist(id) {
    const list = _getLocalWishlist();
    if (!list.includes(String(id))) {
      list.push(String(id));
      localStorage.setItem('globexWishlist', JSON.stringify(list));
    }
  }
  function _removeLocalWishlist(id) {
    const list = _getLocalWishlist().filter((i) => i !== String(id));
    localStorage.setItem('globexWishlist', JSON.stringify(list));
  }

  /* ─────────────────────────────────────────────
     CONTACT FORMS (Quotation, Sample, Supplier)
  ───────────────────────────────────────────── */
  function _initContactForms() {
    // Request Quotation
    const rfqForm = document.querySelector('[data-rfq-form]');
    if (rfqForm) {
      rfqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await _submitForm(rfqForm, '/rfq', 'Quotation request sent!');
      });
    }

    // Request Sample
    const sampleForm = document.querySelector('[data-sample-form]');
    if (sampleForm) {
      sampleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await _submitForm(sampleForm, '/samples/request', 'Sample request sent!');
      });
    }

    // Contact Supplier
    const contactForm = document.querySelector('[data-contact-supplier-form]');
    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (_product) {
          contactForm.querySelector('[name="supplier_id"]') &&
            (contactForm.querySelector('[name="supplier_id"]').value = _product.supplier?.id || '');
          contactForm.querySelector('[name="product_id"]') &&
            (contactForm.querySelector('[name="product_id"]').value = _product.id);
        }
        await _submitForm(contactForm, '/messages', 'Message sent to supplier!');
      });
    }
  }

  async function _submitForm(form, endpoint, successMsg) {
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    const data = Object.fromEntries(new FormData(form));
    if (_product) data.product_id = _product.id;

    try {
      const api = window.ApiClient || window.API;
      if (api) {
        await api.post(endpoint, data);
      } else {
        const baseURL = (window.GlobexConfig?.API_BASE_URL || '/api/v1');
        const res = await fetch(`${baseURL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Request failed');
      }
      form.reset();
      if (window.GlobexSky?.showToast) window.GlobexSky.showToast(successMsg, 'success');
      // Close modal if inside one
      const modal = form.closest('[data-modal], .modal');
      if (modal && window.GlobexSky?.closeModal) window.GlobexSky.closeModal(modal.id);
    } catch (err) {
      if (window.GlobexSky?.showToast) window.GlobexSky.showToast('Failed to send. Please try again.', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send'; }
    }
  }

  /* ─────────────────────────────────────────────
     SOCIAL SHARE
  ───────────────────────────────────────────── */
  function _initShareButtons() {
    const url   = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(_product?.name || document.title);

    const map = {
      '[data-share-facebook]': `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '[data-share-twitter]':  `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      '[data-share-whatsapp]': `https://wa.me/?text=${title}%20${url}`,
      '[data-share-linkedin]': `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`,
    };

    Object.entries(map).forEach(([sel, shareUrl]) => {
      document.querySelectorAll(sel).forEach((btn) => {
        btn.href = shareUrl;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
      });
    });

    // Copy link
    document.querySelectorAll('[data-share-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          if (window.GlobexSky?.showToast) window.GlobexSky.showToast('Link copied!', 'success');
        } catch (_) {
          if (window.GlobexSky?.showToast) window.GlobexSky.showToast('Could not copy link', 'error');
        }
      });
    });

    // Web Share API
    document.querySelectorAll('[data-share-native]').forEach((btn) => {
      if (navigator.share) {
        btn.addEventListener('click', () => navigator.share({
          title: _product?.name || document.title,
          url: window.location.href,
        }));
      } else {
        btn.style.display = 'none';
      }
    });
  }

  /* ─────────────────────────────────────────────
     REVIEWS
  ───────────────────────────────────────────── */
  let _reviewPage = 1;
  const REVIEWS_PER_PAGE = 5;

  async function _initReviews(productId) {
    const container = document.querySelector('[data-reviews-container]');
    if (!container) return;

    await _loadReviews(productId);

    const loadMoreBtn = document.querySelector('[data-reviews-load-more]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', async () => {
        _reviewPage++;
        await _loadReviews(productId, true);
      });
    }

    // Submit review
    const reviewForm = document.querySelector('[data-review-form]');
    if (reviewForm) {
      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await _submitForm(reviewForm, `/products/${productId}/reviews`, 'Review submitted!');
        _reviewPage = 1;
        await _loadReviews(productId);
      });
    }
  }

  async function _loadReviews(productId, append = false) {
    const container = document.querySelector('[data-reviews-container]');
    if (!container) return;

    try {
      const api = window.ApiClient || window.API;
      const res = api
        ? await api.products.reviews(productId, { page: _reviewPage, limit: REVIEWS_PER_PAGE })
        : await fetch(`/api/v1/products/${productId}/reviews?page=${_reviewPage}&limit=${REVIEWS_PER_PAGE}`).then((r) => r.json());

      const reviews = res.data || res.reviews || [];
      const totalPages = res.pagination?.totalPages || res.total_pages || 1;

      const html = reviews.map((r) => `
        <div class="review-item">
          <div class="review-header">
            <strong>${_escapeHTML(r.user?.name || 'Anonymous')}</strong>
            <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <time>${_formatDate(r.created_at)}</time>
          </div>
          <p class="review-body">${_escapeHTML(r.comment || '')}</p>
        </div>`).join('');

      if (append) {
        container.insertAdjacentHTML('beforeend', html);
      } else {
        container.innerHTML = html || '<p>No reviews yet. Be the first!</p>';
      }

      const loadMoreBtn = document.querySelector('[data-reviews-load-more]');
      if (loadMoreBtn) loadMoreBtn.hidden = _reviewPage >= totalPages;
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     RELATED PRODUCTS
  ───────────────────────────────────────────── */
  async function _initRelatedProducts() {
    const container = document.querySelector('[data-related-products]');
    if (!container || !_product) return;

    try {
      const api = window.ApiClient || window.API;
      const res = api
        ? await api.products.list({ category: _product.category_id, limit: 8, exclude: _product.id })
        : await fetch(`/api/v1/products?category=${_product.category_id}&limit=8`).then((r) => r.json());

      const products = res.data || res.products || [];
      container.innerHTML = products.map((p) => `
        <div class="product-card">
          <a href="/pages/sourcing/product-detail.html?id=${p.id}">
            <img src="${_escapeAttr(p.images?.[0] || p.image || '')}" alt="${_escapeAttr(p.name)}" loading="lazy">
            <div class="product-card-body">
              <h4 class="product-card-name">${_escapeHTML(p.name)}</h4>
              <p class="product-card-price">${
                window.Currency ? window.Currency.formatFromUSD(p.price) : `$${p.price}`
              }</p>
            </div>
          </a>
        </div>`).join('');
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function _setText(selector, text) {
    if (!text) return;
    document.querySelectorAll(selector).forEach((el) => { el.textContent = text; });
  }

  function _renderStars(selector, rating) {
    document.querySelectorAll(selector).forEach((el) => {
      el.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = i <= Math.round(rating) ? 'star filled' : 'star';
        star.textContent = '★';
        el.appendChild(star);
      }
    });
  }

  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(); } catch (_) { return ''; }
  }

  /* ─────────────────────────────────────────────
     EXPOSE
  ───────────────────────────────────────────── */
  window.Product = { reload: () => _loadProduct(_getProductId()) };
})();
