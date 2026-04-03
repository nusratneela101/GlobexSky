/**
 * Globex Sky — Performance Utilities
 * Lazy loading, link prefetching, and API response caching.
 */
(function () {
  'use strict';

  const Performance = {
    init() {
      this.lazyLoadImages();
      this.prefetchLinks();
    },

    /* ── Lazy load images with data-src / data-lazy-src ── */
    lazyLoadImages() {
      if (!('IntersectionObserver' in window)) {
        // Fallback: load all images immediately
        document.querySelectorAll('img[data-src], img[data-lazy-src]').forEach(function (img) {
          img.src = img.dataset.src || img.dataset.lazySrc;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          img.classList.add('loaded');
        });
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            img.src = img.dataset.src || img.dataset.lazySrc;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '200px' });

      document.querySelectorAll('img[data-src], img[data-lazy-src]').forEach(function (img) {
        observer.observe(img);
      });
    },

    /* ── Prefetch same-origin links on hover ── */
    prefetchLinks() {
      var prefetched = new Set();
      document.addEventListener('mouseover', function (e) {
        var link = e.target.closest('a[href]');
        if (link && !prefetched.has(link.href) && link.href.startsWith(location.origin)) {
          var el = document.createElement('link');
          el.rel = 'prefetch';
          el.href = link.href;
          document.head.appendChild(el);
          prefetched.add(link.href);
        }
      });
    },

    /* ── Debounce helper ── */
    debounce(fn, delay) {
      var timer;
      return function () {
        var self = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(self, args); }, delay);
      };
    },

    /* ── Cache API responses in sessionStorage ── */
    cacheResponse(key, data, ttlMs) {
      ttlMs = ttlMs || 300000;
      try {
        sessionStorage.setItem(key, JSON.stringify({ data: data, expires: Date.now() + ttlMs }));
      } catch (e) { /* quota exceeded — ignore */ }
    },

    getCached(key) {
      try {
        var item = sessionStorage.getItem(key);
        if (!item) return null;
        var parsed = JSON.parse(item);
        return Date.now() < parsed.expires ? parsed.data : null;
      } catch (e) {
        return null;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', function () { Performance.init(); });

  window.GlobexPerformance = Performance;
}());
