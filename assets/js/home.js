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
    const originalText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Subscribing…'; }

    try {
      const base = (typeof GlobexConfig !== 'undefined' && GlobexConfig.API_BASE_URL) || '/api/v1';
      await fetch(`${base}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (typeof showToast === 'function') showToast('Thank you for subscribing!', 'success');
      form.reset();
    } catch (_) {
      if (typeof showToast === 'function') showToast('Subscription failed. Please try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
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
   INIT
───────────────────────────────────────────── */
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
});
