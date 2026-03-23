/**
 * Globex Sky - products.js
 * Product listing: filters, sorting, grid/list toggle, pagination.
 * Product detail: image gallery, variants, quantity, cart, wishlist.
 * Product comparison table.
 */

/* ─────────────────────────────────────────────
   PRODUCT LISTING FILTERS
───────────────────────────────────────────── */
function initProductFilters() {
  const filterSidebar = document.querySelector('.filter-sidebar, [data-filter-sidebar]');
  if (!filterSidebar) return;

  // Price range slider
  const minInput = filterSidebar.querySelector('[data-price-min]');
  const maxInput = filterSidebar.querySelector('[data-price-max]');
  const minDisplay = filterSidebar.querySelector('[data-price-min-display]');
  const maxDisplay = filterSidebar.querySelector('[data-price-max-display]');

  if (minInput && maxInput) {
    const updateDisplay = () => {
      if (minDisplay) minDisplay.textContent = '$' + minInput.value;
      if (maxDisplay) maxDisplay.textContent = '$' + maxInput.value;
    };
    minInput.addEventListener('input', updateDisplay);
    maxInput.addEventListener('input', updateDisplay);
    updateDisplay();
  }

  // Apply filters button
  const applyBtn = filterSidebar.querySelector('[data-apply-filters], .btn-apply-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const params = new URLSearchParams(window.location.search);

      if (minInput) params.set('price_min', minInput.value);
      if (maxInput) params.set('price_max', maxInput.value);

      filterSidebar.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
        if (cb.name) {
          const existing = params.getAll(cb.name);
          if (!existing.includes(cb.value)) params.append(cb.name, cb.value);
        }
      });

      const ratingChecked = filterSidebar.querySelector('input[name="rating"]:checked');
      if (ratingChecked) params.set('rating', ratingChecked.value);

      params.set('page', '1');
      window.location.search = params.toString();
    });
  }

  // Reset filters
  const resetBtn = filterSidebar.querySelector('[data-reset-filters], .btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const params = new URLSearchParams();
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) params.set('q', q);
      window.location.search = params.toString();
    });
  }

  // Restore filter state from URL
  const params = new URLSearchParams(window.location.search);
  if (minInput && params.get('price_min')) { minInput.value = params.get('price_min'); }
  if (maxInput && params.get('price_max')) { maxInput.value = params.get('price_max'); }
  filterSidebar.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (cb.name && params.getAll(cb.name).includes(cb.value)) cb.checked = true;
  });

  // Mobile filter toggle
  const mobileToggle = document.querySelector('[data-filter-toggle], .btn-filter-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      filterSidebar.classList.toggle('show');
    });
  }

  // Collapsible filter sections
  filterSidebar.querySelectorAll('.filter-section-header, [data-filter-toggle-section]').forEach((header) => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      if (body) body.classList.toggle('d-none');
      header.classList.toggle('collapsed');
    });
  });
}

/* ─────────────────────────────────────────────
   SORT & VIEW TOGGLE
───────────────────────────────────────────── */
function initProductListingControls() {
  // Sort dropdown
  const sortSelect = document.querySelector('[data-sort-select], #sortSelect');
  if (sortSelect) {
    const params = new URLSearchParams(window.location.search);
    sortSelect.value = params.get('sort') || '';

    sortSelect.addEventListener('change', () => {
      const p = new URLSearchParams(window.location.search);
      p.set('sort', sortSelect.value);
      p.set('page', '1');
      window.location.search = p.toString();
    });
  }

  // Grid / List toggle
  const gridBtn = document.querySelector('[data-view="grid"]');
  const listBtn = document.querySelector('[data-view="list"]');
  const productsContainer = document.querySelector('.products-grid, [data-products-container]');

  if (gridBtn && listBtn && productsContainer) {
    const saved = localStorage.getItem('productView') || 'grid';
    setView(saved, productsContainer, gridBtn, listBtn);

    gridBtn.addEventListener('click', () => { setView('grid', productsContainer, gridBtn, listBtn); localStorage.setItem('productView', 'grid'); });
    listBtn.addEventListener('click', () => { setView('list', productsContainer, gridBtn, listBtn); localStorage.setItem('productView', 'list'); });
  }
}

function setView(view, container, gridBtn, listBtn) {
  container.classList.toggle('view-grid', view === 'grid');
  container.classList.toggle('view-list', view === 'list');
  gridBtn?.classList.toggle('active', view === 'grid');
  listBtn?.classList.toggle('active', view === 'list');
}

/* ─────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────── */
function initProductPagination() {
  const pagination = document.querySelector('.product-pagination, [data-pagination]');
  if (!pagination) return;

  pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.classList.contains('disabled') || btn.classList.contains('active')) return;
    const p = new URLSearchParams(window.location.search);
    p.set('page', btn.dataset.page);
    window.location.search = p.toString();
  });
}

/* ─────────────────────────────────────────────
   PRODUCT DETAIL: IMAGE GALLERY
───────────────────────────────────────────── */
function initProductGallery() {
  const gallery = document.querySelector('.product-gallery, [data-product-gallery]');
  if (!gallery) return;

  const mainImage    = gallery.querySelector('.main-image img, [data-main-image]');
  const thumbnails   = gallery.querySelectorAll('.thumbnail img, [data-thumbnail]');
  const zoomOverlay  = gallery.querySelector('.zoom-overlay, [data-zoom-overlay]');

  thumbnails.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      if (mainImage) {
        mainImage.src = thumb.dataset.large || thumb.src;
        mainImage.alt = thumb.alt;
      }
      thumbnails.forEach((t) => t.closest('.thumbnail, [data-thumbnail]')?.classList.remove('active'));
      thumb.closest('.thumbnail, [data-thumbnail]')?.classList.add('active');
    });
  });

  // Zoom on hover (desktop)
  if (mainImage) {
    mainImage.addEventListener('mousemove', (e) => {
      if (!zoomOverlay) return;
      const rect = mainImage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
      zoomOverlay.style.backgroundPosition = `${x}% ${y}%`;
    });
    mainImage.addEventListener('mouseenter', () => {
      if (zoomOverlay) {
        zoomOverlay.style.backgroundImage = `url(${mainImage.src})`;
        zoomOverlay.style.display = 'block';
      }
    });
    mainImage.addEventListener('mouseleave', () => {
      if (zoomOverlay) zoomOverlay.style.display = 'none';
    });

    // Lightbox on click
    mainImage.addEventListener('click', () => {
      const lightbox = document.createElement('div');
      lightbox.className = 'product-lightbox';
      lightbox.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out';
      const img = document.createElement('img');
      img.src = mainImage.src;
      img.style.cssText = 'max-width:90%;max-height:90vh;border-radius:4px;box-shadow:0 4px 32px rgba(0,0,0,.5)';
      lightbox.appendChild(img);
      lightbox.addEventListener('click', () => lightbox.remove());
      document.body.appendChild(lightbox);
    });
  }
}

/* ─────────────────────────────────────────────
   PRODUCT DETAIL: VARIANTS
───────────────────────────────────────────── */
function initProductVariants() {
  const variantSection = document.querySelector('.product-variants, [data-product-variants]');
  if (!variantSection) return;

  let selectedVariants = {};

  variantSection.querySelectorAll('.variant-group, [data-variant-group]').forEach((group) => {
    const type    = group.dataset.variantType || group.dataset.variantGroup;
    const options = group.querySelectorAll('.variant-option, [data-variant-option]');

    options.forEach((option) => {
      option.addEventListener('click', () => {
        if (option.classList.contains('out-of-stock') || option.disabled) return;
        options.forEach((o) => o.classList.remove('active', 'selected'));
        option.classList.add('active', 'selected');
        selectedVariants[type] = option.dataset.value || option.textContent.trim();
        updateVariantDisplay(selectedVariants);
      });
    });
  });
}

function updateVariantDisplay(selected) {
  const priceEl   = document.querySelector('[data-variant-price], .variant-price');
  const stockEl   = document.querySelector('[data-stock-status], .stock-status');
  const skuEl     = document.querySelector('[data-variant-sku], .variant-sku');
  const imageEl   = document.querySelector('.main-image img, [data-main-image]');

  // Find the matching variant from data attribute
  const variantsData = document.querySelector('[data-variants-json]');
  if (!variantsData) return;

  try {
    const variants = JSON.parse(variantsData.textContent || '[]');
    const match = variants.find((v) =>
      Object.entries(selected).every(([k, val]) => v.attributes && v.attributes[k] === val)
    );
    if (match) {
      if (priceEl) priceEl.textContent = '$' + parseFloat(match.price || 0).toFixed(2);
      if (stockEl) {
        stockEl.textContent = match.stock > 0 ? `In Stock (${match.stock})` : 'Out of Stock';
        stockEl.className = `stock-status ${match.stock > 0 ? 'text-success' : 'text-danger'}`;
      }
      if (skuEl) skuEl.textContent = 'SKU: ' + (match.sku || '');
      if (imageEl && match.image) imageEl.src = match.image;
    }
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   PRODUCT DETAIL: QUANTITY & ADD TO CART
───────────────────────────────────────────── */
function initProductActions() {
  const detailSection = document.querySelector('.product-detail, [data-product-detail]');
  if (!detailSection) return;

  // Quantity controls
  const qtyInput  = detailSection.querySelector('.quantity-input, [data-quantity]');
  const qtyMinus  = detailSection.querySelector('[data-qty-minus], .qty-minus');
  const qtyPlus   = detailSection.querySelector('[data-qty-plus], .qty-plus');
  const minOrder  = parseInt(detailSection.dataset.minOrder || '1', 10);
  const maxOrder  = parseInt(detailSection.dataset.maxOrder || '9999', 10);

  if (qtyInput) {
    if (qtyMinus) {
      qtyMinus.addEventListener('click', () => {
        const val = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = Math.max(minOrder, val - 1);
      });
    }
    if (qtyPlus) {
      qtyPlus.addEventListener('click', () => {
        const val = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = Math.min(maxOrder, val + 1);
      });
    }
    qtyInput.addEventListener('change', () => {
      const val = parseInt(qtyInput.value, 10);
      if (isNaN(val) || val < minOrder) qtyInput.value = minOrder;
      if (val > maxOrder) qtyInput.value = maxOrder;
    });
  }

  // Add to Cart
  const addToCartBtn = detailSection.querySelector('[data-btn-add-to-cart], #btnAddToCart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      const id       = detailSection.dataset.productId;
      const name     = detailSection.querySelector('[data-product-name], .product-title')?.textContent?.trim();
      const priceEl  = detailSection.querySelector('[data-product-price], .product-price, [data-variant-price]');
      const price    = parseFloat(priceEl?.textContent?.replace(/[^0-9.]/g, '')) || 0;
      const image    = detailSection.querySelector('.main-image img, [data-main-image]')?.src || '';
      const quantity = parseInt(qtyInput?.value || '1', 10);
      const supplier = detailSection.dataset.supplier || '';

      if (!id) return;
      if (typeof addToCart === 'function') {
        addToCart({ id, name, price, image, quantity, supplier, minOrder });
        if (typeof showToast === 'function') showToast(`${name} added to cart!`, 'success');
        // Animate button
        addToCartBtn.textContent = 'Added!';
        setTimeout(() => { addToCartBtn.textContent = 'Add to Cart'; }, 1500);
      }
    });
  }

  // Buy Now
  const buyNowBtn = detailSection.querySelector('[data-btn-buy-now], #btnBuyNow');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      addToCartBtn?.click();
      setTimeout(() => { window.location.href = '/pages/sourcing/cart.html'; }, 300);
    });
  }

  // Wishlist toggle
  const wishlistBtn = detailSection.querySelector('[data-btn-wishlist], #btnWishlist');
  if (wishlistBtn) {
    const productId = detailSection.dataset.productId;
    const wishlist  = JSON.parse(localStorage.getItem('globexWishlist') || '[]');
    if (wishlist.includes(String(productId))) {
      wishlistBtn.classList.add('active');
      wishlistBtn.setAttribute('aria-pressed', 'true');
    }

    wishlistBtn.addEventListener('click', () => {
      const list = JSON.parse(localStorage.getItem('globexWishlist') || '[]');
      const idx  = list.indexOf(String(productId));
      if (idx === -1) {
        list.push(String(productId));
        wishlistBtn.classList.add('active');
        wishlistBtn.setAttribute('aria-pressed', 'true');
        if (typeof showToast === 'function') showToast('Added to wishlist!', 'success');
      } else {
        list.splice(idx, 1);
        wishlistBtn.classList.remove('active');
        wishlistBtn.setAttribute('aria-pressed', 'false');
        if (typeof showToast === 'function') showToast('Removed from wishlist.', 'info');
      }
      localStorage.setItem('globexWishlist', JSON.stringify(list));
    });
  }

  // Share button
  document.querySelector('[data-share-product], .btn-share')?.addEventListener('click', async () => {
    const title = document.title;
    const url   = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (_) {}
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        if (typeof showToast === 'function') showToast('Link copied to clipboard!', 'success');
      });
    }
  });
}

/* ─────────────────────────────────────────────
   PRODUCT DETAIL: TABS (Reviews, Q&A, Description)
───────────────────────────────────────────── */
async function initProductTabs() {
  const tabContainer = document.querySelector('.product-tabs, [data-product-tabs]');
  if (!tabContainer) return;

  tabContainer.querySelectorAll('[data-tab-target], [data-bs-toggle="tab"]').forEach((tab) => {
    tab.addEventListener('shown.bs.tab', async (e) => {
      const target = e.target.dataset.tabTarget || e.target.getAttribute('data-bs-target');
      if (target === '#reviews-tab' || target === '#reviews') {
        await loadProductReviews();
      } else if (target === '#qa-tab' || target === '#qa') {
        await loadProductQA();
      }
    });
  });
}

async function loadProductReviews() {
  const container = document.querySelector('#reviewsList, [data-reviews-list]');
  if (!container || container.dataset.loaded) return;

  const productId = document.querySelector('[data-product-id]')?.dataset.productId;
  if (!productId) return;

  try {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const res = await fetch(`/api/v1/products/${productId}/reviews`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const reviews = data.data || data || [];
    container.innerHTML = reviews.length
      ? reviews.map((r) => `
        <div class="review-item border-bottom pb-3 mb-3">
          <div class="d-flex justify-content-between">
            <strong>${r.user_name || r.user || 'Anonymous'}</strong>
            <span class="text-warning">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
          </div>
          <p class="mb-1">${r.comment || r.body}</p>
          <small class="text-muted">${new Date(r.created_at).toLocaleDateString()}</small>
        </div>`).join('')
      : '<p class="text-muted">No reviews yet. Be the first to review!</p>';
    container.dataset.loaded = '1';
  } catch (_) {}
}

async function loadProductQA() {
  const container = document.querySelector('#qaList, [data-qa-list]');
  if (!container || container.dataset.loaded) return;

  const productId = document.querySelector('[data-product-id]')?.dataset.productId;
  if (!productId) return;

  try {
    const res  = await fetch(`/api/v1/products/${productId}/qa`);
    const data = await res.json();
    const items = data.data || data || [];
    container.innerHTML = items.length
      ? items.map((q) => `
        <div class="qa-item mb-3">
          <div class="fw-bold">Q: ${q.question}</div>
          <div class="text-muted ms-3 mt-1">A: ${q.answer || 'Awaiting answer'}</div>
        </div>`).join('')
      : '<p class="text-muted">No questions yet. Ask the first question!</p>';
    container.dataset.loaded = '1';
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   REVIEW FORM
───────────────────────────────────────────── */
function initReviewForm() {
  const form = document.querySelector('#reviewForm, [data-review-form]');
  if (!form) return;

  // Star rating UI
  const stars = form.querySelectorAll('.rating-star, [data-rating-star]');
  const ratingInput = form.querySelector('[name="rating"]');
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      const value = index + 1;
      if (ratingInput) ratingInput.value = value;
      stars.forEach((s, i) => s.classList.toggle('active', i < value));
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data       = Object.fromEntries(new FormData(form));
    const productId  = document.querySelector('[data-product-id]')?.dataset.productId;
    if (!productId || !data.rating || !data.comment) {
      if (typeof showToast === 'function') showToast('Please provide a rating and comment.', 'error');
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
    try {
      const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
      await fetch(`/api/v1/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data),
      });
      if (typeof showToast === 'function') showToast('Review submitted!', 'success');
      form.reset();
      stars.forEach((s) => s.classList.remove('active'));
      const container = document.querySelector('#reviewsList, [data-reviews-list]');
      if (container) { delete container.dataset.loaded; await loadProductReviews(); }
    } catch (_) {
      if (typeof showToast === 'function') showToast('Failed to submit review.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
  });
}

/* ─────────────────────────────────────────────
   COMPARISON
───────────────────────────────────────────── */
function initProductComparison() {
  const compareContainer = document.querySelector('.compare-table, [data-compare-table]');
  if (!compareContainer) return;

  const ids = new URLSearchParams(window.location.search).getAll('id');
  if (!ids.length) {
    compareContainer.innerHTML = '<p class="text-muted text-center py-5">No products selected for comparison.</p>';
    return;
  }

  Promise.all(ids.map((id) =>
    fetch(`/api/v1/products/${id}`).then((r) => r.json()).then((d) => d.data || d)
  )).then((products) => {
    if (!products.length) return;
    // Build comparison table headers
    const attrs = ['name', 'price', 'brand', 'category', 'weight', 'dimensions', 'rating', 'stock'];
    const labels = { name: 'Product', price: 'Price', brand: 'Brand', category: 'Category', weight: 'Weight', dimensions: 'Dimensions', rating: 'Rating', stock: 'Stock' };

    compareContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-bordered text-center">
          <thead>
            <tr>
              <th>Feature</th>
              ${products.map((p) => `<th>
                <img src="${p.image || '/assets/images/placeholder.png'}" alt="${p.name}" width="80" class="mb-2 rounded"><br>
                <a href="/pages/sourcing/product-detail.html?id=${p.id}">${p.name}</a>
                <br><button class="btn btn-sm btn-outline-danger mt-1" data-remove-compare="${p.id}">Remove</button>
              </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${attrs.map((attr) => `
              <tr>
                <td class="fw-bold">${labels[attr]}</td>
                ${products.map((p) => `<td>${attr === 'price' ? '$' + parseFloat(p[attr] || 0).toFixed(2) : (p[attr] || '—')}</td>`).join('')}
              </tr>`).join('')}
            <tr>
              <td></td>
              ${products.map((p) => `<td>
                <button class="btn btn-primary btn-sm" data-add-to-cart="${p.id}"
                  data-product-id="${p.id}" data-product-name="${p.name}"
                  data-product-price="${p.price}" data-product-image="${p.image || ''}">
                  Add to Cart
                </button>
              </td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>`;

    // Remove from comparison
    compareContainer.querySelectorAll('[data-remove-compare]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = new URLSearchParams(window.location.search);
        const newIds = ids.filter((id) => id !== btn.dataset.removeCompare);
        const newParams = new URLSearchParams();
        newIds.forEach((id) => newParams.append('id', id));
        window.location.search = newParams.toString();
      });
    });

    // Add to cart from comparison
    compareContainer.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset;
        if (typeof addToCart === 'function') {
          addToCart({ id: d.productId, name: d.productName, price: parseFloat(d.productPrice), image: d.productImage, quantity: 1 });
          if (typeof showToast === 'function') showToast(`${d.productName} added to cart!`, 'success');
        }
      });
    });
  }).catch(() => {
    compareContainer.innerHTML = '<p class="text-danger text-center py-5">Failed to load product data.</p>';
  });
}

/* ─────────────────────────────────────────────
   ADD TO COMPARE FROM LISTING
───────────────────────────────────────────── */
function initAddToCompare() {
  document.querySelectorAll('[data-compare-product]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.compareProduct || btn.closest('[data-product-id]')?.dataset.productId;
      if (!id) return;

      const stored = JSON.parse(localStorage.getItem('globexCompare') || '[]');
      if (stored.includes(String(id))) {
        if (typeof showToast === 'function') showToast('Already in comparison list.', 'info');
        return;
      }
      if (stored.length >= 4) {
        if (typeof showToast === 'function') showToast('You can compare up to 4 products.', 'warning');
        return;
      }
      stored.push(String(id));
      localStorage.setItem('globexCompare', JSON.stringify(stored));
      if (typeof showToast === 'function') showToast('Added to comparison.', 'success');

      const bar = document.querySelector('.compare-bar, [data-compare-bar]');
      if (bar) updateCompareBar(stored, bar);
    });
  });

  const compareBar = document.querySelector('.compare-bar, [data-compare-bar]');
  if (compareBar) {
    const stored = JSON.parse(localStorage.getItem('globexCompare') || '[]');
    if (stored.length) updateCompareBar(stored, compareBar);
  }
}

function updateCompareBar(ids, bar) {
  bar.style.display = ids.length ? 'flex' : 'none';
  const count = bar.querySelector('[data-compare-count]');
  if (count) count.textContent = ids.length;
  const compareBtn = bar.querySelector('[data-go-compare]');
  if (compareBtn) compareBtn.href = `/pages/search/compare.html?${ids.map((id) => `id=${id}`).join('&')}`;
  bar.querySelector('[data-clear-compare]')?.addEventListener('click', () => {
    localStorage.removeItem('globexCompare');
    bar.style.display = 'none';
  });
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initProductFilters();
  initProductListingControls();
  initProductPagination();
  initProductGallery();
  initProductVariants();
  initProductActions();
  initProductTabs();
  initReviewForm();
  initProductComparison();
  initAddToCompare();
});
