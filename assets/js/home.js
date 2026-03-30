/**
 * Globex Sky - home.js
 * Homepage functionality: hero slider, countdown timers, product carousels,
 * add-to-cart from homepage cards, wishlist toggles, live stream previews.
 */

/* ─────────────────────────────────────────────
   HERO SLIDER
───────────────────────────────────────────── */
function initHeroSlider() {
  const slider = document.querySelector('.hero-slider, [data-hero-slider]');
  if (!slider) return;

  const slides = slider.querySelectorAll('.slide, .hero-slide');
  if (!slides.length) return;

  let current = 0;
  let timer = null;

  const goTo = (index) => {
    slides[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    updateDots();
  };

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  const start = () => { timer = setInterval(next, 5000); };
  const stop  = () => clearInterval(timer);

  // Dots
  const dotsContainer = slider.querySelector('.slider-dots, [data-slider-dots]');
  const updateDots = () => {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  };

  if (dotsContainer) {
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => { stop(); goTo(i); start(); });
      dotsContainer.appendChild(dot);
    });
  }

  // Prev/Next buttons
  slider.querySelector('.slider-prev, [data-slider-prev]')
    ?.addEventListener('click', () => { stop(); prev(); start(); });
  slider.querySelector('.slider-next, [data-slider-next]')
    ?.addEventListener('click', () => { stop(); next(); start(); });

  // Pause on hover
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', start);

  // Touch/swipe
  let touchStartX = 0;
  slider.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { stop(); diff > 0 ? next() : prev(); start(); }
  });

  // Init
  if (slides.length) slides[0].classList.add('active');
  start();
}

/* ─────────────────────────────────────────────
   FLASH SALE / COUNTDOWN TIMERS
───────────────────────────────────────────── */
function initHomeCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const endTime = new Date(el.dataset.countdown).getTime();
    if (isNaN(endTime)) return;

    const hEl = el.querySelector('[data-h], .countdown-h');
    const mEl = el.querySelector('[data-m], .countdown-m');
    const sEl = el.querySelector('[data-s], .countdown-s');

    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (hEl) hEl.textContent = String(h).padStart(2, '0');
      if (mEl) mEl.textContent = String(m).padStart(2, '0');
      if (sEl) sEl.textContent = String(s).padStart(2, '0');
      if (diff <= 0) {
        clearInterval(id);
        el.closest('.flash-sale-item, .countdown-wrapper')?.classList.add('sale-ended');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
  });
}

/* ─────────────────────────────────────────────
   CATEGORY CAROUSEL
───────────────────────────────────────────── */
function initCategoryCarousel() {
  document.querySelectorAll('.category-carousel, [data-category-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-track, .category-track');
    if (!track) return;

    const prevBtn = carousel.querySelector('.carousel-prev, [data-carousel-prev]');
    const nextBtn = carousel.querySelector('.carousel-next, [data-carousel-next]');

    const scrollBy = () => track.querySelector('.category-item, .carousel-item')?.offsetWidth + 16 || 180;

    if (prevBtn) prevBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollBy(), behavior: 'smooth' }); });
    if (nextBtn) nextBtn.addEventListener('click', () => { track.scrollBy({ left: scrollBy(), behavior: 'smooth' }); });
  });
}

/* ─────────────────────────────────────────────
   FEATURED PRODUCTS — ADD TO CART & WISHLIST
───────────────────────────────────────────── */
function initHomeProductCards() {
  // Event delegation on product grid containers
  document.querySelectorAll('.products-grid, .featured-products, .home-products, [data-products-grid]').forEach((grid) => {
    grid.addEventListener('click', (e) => {
      // Add to cart
      const cartBtn = e.target.closest('[data-add-to-cart]');
      if (cartBtn) {
        e.preventDefault();
        const card = cartBtn.closest('[data-product-id], .product-card');
        if (!card) return;
        const id      = card.dataset.productId  || card.dataset.id;
        const name    = card.dataset.productName || card.querySelector('.product-name, .card-title')?.textContent?.trim();
        const price   = parseFloat(card.dataset.productPrice  || card.querySelector('.product-price, .price')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
        const image   = card.dataset.productImage || card.querySelector('img')?.src || '';
        const supplier = card.dataset.supplier || '';

        if (typeof addToCart === 'function') {
          addToCart({ id, name, price, image, quantity: 1, supplier, minOrder: 1 });
          if (typeof showToast === 'function') showToast(`${name} added to cart`, 'success');
        }
        return;
      }

      // Wishlist toggle
      const wishBtn = e.target.closest('[data-wishlist-toggle], .wishlist-btn');
      if (wishBtn) {
        e.preventDefault();
        const card      = wishBtn.closest('[data-product-id], .product-card');
        const productId = card?.dataset.productId || card?.dataset.id;
        if (!productId) return;

        const wishlist = JSON.parse(localStorage.getItem('globexWishlist') || '[]');
        const idx      = wishlist.indexOf(String(productId));
        if (idx === -1) {
          wishlist.push(String(productId));
          wishBtn.classList.add('active');
          wishBtn.setAttribute('aria-pressed', 'true');
          if (typeof showToast === 'function') showToast('Added to wishlist', 'success');
        } else {
          wishlist.splice(idx, 1);
          wishBtn.classList.remove('active');
          wishBtn.setAttribute('aria-pressed', 'false');
          if (typeof showToast === 'function') showToast('Removed from wishlist', 'info');
        }
        localStorage.setItem('globexWishlist', JSON.stringify(wishlist));
      }
    });
  });

  // Restore wishlist state from localStorage
  const wishlist = JSON.parse(localStorage.getItem('globexWishlist') || '[]');
  document.querySelectorAll('[data-product-id], .product-card').forEach((card) => {
    const id = card.dataset.productId || card.dataset.id;
    if (id && wishlist.includes(String(id))) {
      const btn = card.querySelector('[data-wishlist-toggle], .wishlist-btn');
      if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
    }
  });
}

/* ─────────────────────────────────────────────
   LIVE STREAM PREVIEW
───────────────────────────────────────────── */
function initLiveStreamPreviews() {
  const container = document.querySelector('.livestream-preview, [data-livestream-preview]');
  if (!container) return;

  // Animate viewer count on stream cards
  container.querySelectorAll('.viewer-count, [data-viewer-count]').forEach((el) => {
    const base = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
    setInterval(() => {
      const delta = Math.floor(Math.random() * 11) - 5; // ±5
      const updated = Math.max(1, base + delta);
      el.textContent = updated > 999
        ? (updated / 1000).toFixed(1) + 'K'
        : String(updated);
    }, 5000);
  });

  // "Join Live" click
  container.addEventListener('click', (e) => {
    const joinBtn = e.target.closest('[data-join-stream], .btn-join-live');
    if (!joinBtn) return;
    const streamId = joinBtn.dataset.streamId || joinBtn.closest('[data-stream-id]')?.dataset.streamId;
    if (streamId) {
      window.location.href = `/pages/livestream/watch.html?id=${streamId}`;
    }
  });
}

/* ─────────────────────────────────────────────
   TESTIMONIALS CAROUSEL
───────────────────────────────────────────── */
function initTestimonialsCarousel() {
  const section = document.querySelector('.testimonials-carousel, [data-testimonials]');
  if (!section) return;
  const track = section.querySelector('.testimonials-track, .carousel-track');
  if (!track) return;

  section.querySelector('[data-carousel-prev]')
    ?.addEventListener('click', () => track.scrollBy({ left: -(track.offsetWidth * 0.8), behavior: 'smooth' }));
  section.querySelector('[data-carousel-next]')
    ?.addEventListener('click', () => track.scrollBy({ left: track.offsetWidth * 0.8, behavior: 'smooth' }));
}

/* ─────────────────────────────────────────────
   NEWSLETTER FORM
───────────────────────────────────────────── */
function initNewsletterForm() {
  const form = document.querySelector('.newsletter-form, [data-newsletter-form]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (typeof showToast === 'function') showToast('Please enter a valid email address.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    const originalText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing…'; }

    try {
      const sb = window.supabaseClient ||
        (window.supabase && window.supabase.createClient &&
          window.supabase.createClient(
            'https://czpqbdkarwdvrnhtvysd.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E'
          ));

      if (sb) {
        const { error } = await sb.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email' });
        if (error && error.code !== '23505') throw new Error(error.message);
      }
      if (typeof showToast === 'function') showToast('Thank you for subscribing!', 'success');
      form.reset();
    } catch (_) {
      if (typeof showToast === 'function') showToast('Subscription failed. Please try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
  });
}

/* ─────────────────────────────────────────────
   STATS COUNTER ANIMATION
───────────────────────────────────────────── */
function initStatsCounters() {
  const counters = document.querySelectorAll('.stat-number, [data-stat-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el     = entry.target;
      const target = parseFloat(el.dataset.target || el.textContent.replace(/[^0-9.]/g, '')) || 0;
      const suffix = el.dataset.suffix || el.textContent.replace(/[0-9.]/g, '') || '';
      const duration = 1500;
      const start  = performance.now();
      const animate = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (Number.isInteger(target)
          ? Math.round(target * eased)
          : (target * eased).toFixed(1)) + suffix;
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    });
  }, { threshold: 0.3 });

  counters.forEach((el) => observer.observe(el));
}

/* ─────────────────────────────────────────────
   POPULAR SEARCH TAGS
───────────────────────────────────────────── */
function initPopularSearchTags() {
  document.querySelectorAll('.popular-tag, [data-search-tag]').forEach((tag) => {
    tag.addEventListener('click', () => {
      const query = tag.dataset.query || tag.textContent.trim();
      window.location.href = `/pages/search/index.html?q=${encodeURIComponent(query)}`;
    });
  });
}

/* ─────────────────────────────────────────────
   LAZY LOAD PRODUCT IMAGES
───────────────────────────────────────────── */
function initLazyProductImages() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.dataset.src;
      if (src) { img.src = src; img.removeAttribute('data-src'); }
      observer.unobserve(img);
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
}

/* ─────────────────────────────────────────────
   DYNAMIC DATA LOADING FROM BACKEND API
───────────────────────────────────────────── */

/** Return the configured API base URL. */
function _apiBase() {
  return (typeof GlobexConfig !== 'undefined' && GlobexConfig.API_BASE_URL)
    ? GlobexConfig.API_BASE_URL
    : '/api/v1';
}

/** Render a product card HTML string from an API product object. */
function _buildProductCardHTML(p) {
  const id       = p.id || '';
  const name     = (p.name || 'Product').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' }[c]));
  const price    = parseFloat(p.price || p.min_price || 0).toFixed(2);
  const image    = p.image_url || p.images?.[0] || p.image || 'https://picsum.photos/seed/' + id + '/320/240';
  const supplier = (p.supplier?.company_name || p.supplier_name || '').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' }[c]));
  const rating   = parseFloat(p.rating || 0).toFixed(1);

  return `<article class="product-card" role="listitem"
    data-product-id="${id}"
    data-product-name="${name}"
    data-product-price="${price}"
    data-product-image="${image}"
    data-supplier="${supplier}">
    <div class="product-card-image">
      <a href="pages/sourcing/product-detail.html?id=${id}">
        <img src="${image}" alt="${name}" width="320" height="240" loading="lazy" />
      </a>
      <button class="product-wishlist" data-wishlist-toggle aria-label="Add ${name} to wishlist">
        <i class="far fa-heart" aria-hidden="true"></i>
      </button>
    </div>
    <div class="product-card-body">
      ${supplier ? `<p class="product-supplier"><i class="fas fa-store" aria-hidden="true"></i> ${supplier}</p>` : ''}
      <h3 class="product-name">
        <a href="pages/sourcing/product-detail.html?id=${id}">${name}</a>
      </h3>
      ${rating > 0 ? `<div class="product-rating" aria-label="Rating: ${rating}"><span class="rating-value">${rating}</span></div>` : ''}
      <div class="product-price">$${price}</div>
    </div>
    <div class="product-card-footer">
      <button class="btn btn-primary btn-sm" data-add-to-cart aria-label="Add ${name} to cart">
        <i class="fas fa-cart-plus" aria-hidden="true"></i> Add to Cart
      </button>
    </div>
  </article>`;
}

/** Render a category card HTML string from an API category object. */
function _buildCategoryCardHTML(cat) {
  const name  = (cat.name || 'Category').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' }[c]));
  const icon  = cat.icon || 'fas fa-tag';
  const slug  = cat.slug || cat.id || '';
  return `<a href="pages/sourcing/products.html?category=${encodeURIComponent(slug)}" class="category-item" data-category-id="${cat.id || ''}">
    <div class="category-icon"><i class="${icon}" aria-hidden="true"></i></div>
    <span class="category-name">${name}</span>
  </a>`;
}

/**
 * Load featured / trending products from the backend and populate
 * containers that have the `data-load-products="featured"` or
 * `data-load-products="trending"` attribute.
 * Falls back silently if the API is unavailable.
 */
async function loadFeaturedProductsFromAPI() {
  const containers = document.querySelectorAll('[data-load-products]');
  if (!containers.length) return;

  const base = _apiBase();

  for (const container of containers) {
    const source = container.dataset.loadProducts || 'featured';
    const path   = source === 'trending' ? '/products/trending' : '/products/featured';
    try {
      const res  = await fetch(`${base}${path}`);
      if (!res.ok) continue;
      const json = await res.json();
      const products = (json.data || []).slice(0, 12);
      if (!products.length) continue;
      container.innerHTML = products.map(_buildProductCardHTML).join('');
    } catch (err) {
      console.warn('[home.js] Failed to load products from API:', err.message);
      // API unavailable — keep whatever static content is present
    }
  }
}

/**
 * Load product categories from the backend and populate containers
 * with the `data-load-categories` attribute.
 */
async function loadCategoriesFromAPI() {
  const containers = document.querySelectorAll('[data-load-categories]');
  if (!containers.length) return;

  const base = _apiBase();
  try {
    const res  = await fetch(`${base}/products/categories`);
    if (!res.ok) return;
    const json = await res.json();
    const categories = (json.data || []).slice(0, 16);
    if (!categories.length) return;
    const html = categories.map(_buildCategoryCardHTML).join('');
    containers.forEach((c) => { c.innerHTML = html; });
  } catch (err) {
    console.warn('[home.js] Failed to load categories from API:', err.message);
    // API unavailable — keep whatever static content is present
  }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   SEARCH TABS
───────────────────────────────────────────── */
function initSearchTabs() {
  const tabs = document.querySelectorAll('.search-tab[data-tab]');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const input = document.getElementById('nav-search-input');
      if (input) {
        const placeholders = {
          ai: 'Ask AI: find me the best suppliers for...',
          products: 'Search products, categories...',
          manufacturers: 'Search manufacturers and factories...',
          worldwide: 'Search worldwide suppliers and trade...',
        };
        input.placeholder = placeholders[tab.dataset.tab] || input.placeholder;
      }
    });
  });
}

/* ─────────────────────────────────────────────
   CATEGORY SIDEBAR
───────────────────────────────────────────── */
function initCatSidebar() {
  const sidebar = document.querySelector('.cat-sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('.cat-sidebar-link').forEach((link) => {
    link.addEventListener('mouseenter', () => {
      sidebar.querySelectorAll('.cat-sidebar-item').forEach((item) => item.classList.remove('hovered'));
      link.closest('.cat-sidebar-item')?.classList.add('hovered');
    });
  });
}

/* ─────────────────────────────────────────────
   TOP DEALS HORIZONTAL SCROLL
───────────────────────────────────────────── */
function initTopDealsScroll() {
  const scroll = document.querySelector('.top-deals-scroll');
  if (!scroll) return;

  const prevBtn = document.querySelector('.deals-scroll-prev');
  const nextBtn = document.querySelector('.deals-scroll-next');
  const cardWidth = 220 + 14;

  if (prevBtn) prevBtn.addEventListener('click', () => {
    scroll.scrollBy({ left: -(cardWidth * 2), behavior: 'smooth' });
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    scroll.scrollBy({ left: cardWidth * 2, behavior: 'smooth' });
  });

  let startX = 0;
  scroll.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  scroll.addEventListener('touchend', (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      scroll.scrollBy({ left: diff > 0 ? cardWidth * 2 : -(cardWidth * 2), behavior: 'smooth' });
    }
  });
}

/* ─────────────────────────────────────────────
   RANKING TABS
───────────────────────────────────────────── */
function initRankingTabs() {
  const tabs = document.querySelectorAll('.ranking-tab[data-rtab]');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    });
  });
}

/* ─────────────────────────────────────────────
   DEALS COUNTDOWN TIMER
───────────────────────────────────────────── */
function initDealsCountdown() {
  const timerEls = document.querySelectorAll('#flash-hours, #flash-minutes, #flash-seconds');
  if (!timerEls.length) return;

  let endTime = parseInt(sessionStorage.getItem('flashSaleEnd') || '0', 10);
  if (!endTime || endTime < Date.now()) {
    endTime = Date.now() + 8 * 3600 * 1000 + 45 * 60 * 1000;
    sessionStorage.setItem('flashSaleEnd', String(endTime));
  }

  const hEl = document.getElementById('flash-hours');
  const mEl = document.getElementById('flash-minutes');
  const sEl = document.getElementById('flash-seconds');

  const tick = () => {
    const diff = Math.max(0, endTime - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
    if (diff <= 0) clearInterval(id);
  };
  tick();
  const id = setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroSlider();
  initHomeCountdowns();
  initCategoryCarousel();
  initHomeProductCards();
  initLiveStreamPreviews();
  initTestimonialsCarousel();
  initNewsletterForm();
  initStatsCounters();
  initPopularSearchTags();
  initLazyProductImages();

  // New Alibaba-style features
  initSearchTabs();
  initCatSidebar();
  initTopDealsScroll();
  initRankingTabs();
  initDealsCountdown();

  // Load dynamic data from backend (no-op when containers are absent or API unavailable)
  if (typeof GlobexConfig !== 'undefined' && typeof GlobexConfig.getConfig === 'function') {
    GlobexConfig.getConfig().then(() => {
      loadFeaturedProductsFromAPI();
      loadCategoriesFromAPI();
    });
  } else {
    loadFeaturedProductsFromAPI();
    loadCategoriesFromAPI();
  }
});
