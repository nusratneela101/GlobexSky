/**
 * Globex Sky - main.js
 * Global JavaScript: navbar, sidebar, language/currency switchers,
 * tabs, modals, toasts, smooth scroll, counters, countdown,
 * reveal animations, dropdowns, tooltips, and nav link activation.
 */

/* ─────────────────────────────────────────────
   STICKY NAVBAR
───────────────────────────────────────────── */
function initStickyNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // apply on load
}

/* ─────────────────────────────────────────────
   MOBILE HAMBURGER TOGGLE
───────────────────────────────────────────── */
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger, .nav-toggle, [data-toggle="nav"]');
  if (!hamburger) return;

  const mobileNav = document.getElementById('mobile-nav') ||
                    document.querySelector('.mobile-nav, .mobile-menu, #mobile-menu');

  hamburger.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
    const expanded = document.body.classList.contains('nav-open');
    hamburger.setAttribute('aria-expanded', String(expanded));
    if (mobileNav) {
      mobileNav.classList.toggle('open', expanded);
      mobileNav.setAttribute('aria-hidden', String(!expanded));
    }
  });

  // Close on overlay click
  document.addEventListener('click', (e) => {
    if (
      document.body.classList.contains('nav-open') &&
      !e.target.closest('.navbar') &&
      !e.target.closest('.hamburger') &&
      !e.target.closest('.nav-toggle') &&
      !e.target.closest('.mobile-nav') &&
      !e.target.closest('#mobile-nav')
    ) {
      document.body.classList.remove('nav-open');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
      if (mobileNav) {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
      }
    }
  });
}

/* ─────────────────────────────────────────────
   ADMIN SIDEBAR COLLAPSE / EXPAND
───────────────────────────────────────────── */
function initAdminSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar) return;

  // Desktop collapse toggle
  const collapseBtn = document.querySelector('.sidebar-collapse-btn, [data-action="sidebar-collapse"]');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-mini');
      const isMini = sidebar.classList.contains('sidebar-mini');
      localStorage.setItem('sidebarMini', isMini ? '1' : '0');
    });
  }

  // Restore saved state
  if (localStorage.getItem('sidebarMini') === '1') {
    sidebar.classList.add('sidebar-mini');
  }

  // Mobile overlay toggle
  const mobileToggle = document.querySelector('.sidebar-mobile-toggle, [data-action="sidebar-mobile"]');
  const overlay = document.querySelector('.sidebar-overlay');

  const openMobileSidebar = () => {
    sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('sidebar-visible');
  };

  const closeMobileSidebar = () => {
    sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('sidebar-visible');
  };

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.contains('sidebar-open') ? closeMobileSidebar() : openMobileSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }
}

/* ─────────────────────────────────────────────
   LANGUAGE SWITCHER
───────────────────────────────────────────── */
function initLanguageSwitcher() {
  const langItems = document.querySelectorAll('[data-lang]');
  const langDisplay = document.querySelector('.lang-display, .current-lang');

  langItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = item.dataset.lang;
      const label = item.dataset.langLabel || item.textContent.trim();

      localStorage.setItem('globexLang', lang);

      if (langDisplay) {
        langDisplay.textContent = label;
      }

      // Mark active
      langItems.forEach((el) => el.classList.remove('active'));
      item.classList.add('active');

      // Close parent dropdown
      const parentDropdown = item.closest('.dropdown');
      if (parentDropdown) parentDropdown.classList.remove('dropdown-open');
    });
  });

  // Apply saved language on load
  const savedLang = localStorage.getItem('globexLang');
  if (savedLang && langDisplay) {
    const activeItem = document.querySelector(`[data-lang="${savedLang}"]`);
    if (activeItem) {
      langDisplay.textContent = activeItem.dataset.langLabel || activeItem.textContent.trim();
      activeItem.classList.add('active');
    }
  }
}

/* ─────────────────────────────────────────────
   CURRENCY SWITCHER
───────────────────────────────────────────── */
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  SAR: 'SAR ',
  CNY: '¥',
  JPY: '¥',
  CAD: 'CA$',
};

function initCurrencySwitcher() {
  const currencyItems = document.querySelectorAll('[data-currency]');
  const currencyDisplay = document.querySelector('.currency-display, .current-currency');

  const applySymbol = (currency) => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
    document.querySelectorAll('.price-symbol, .currency-symbol').forEach((el) => {
      el.textContent = symbol;
    });
    if (currencyDisplay) currencyDisplay.textContent = currency;
  };

  currencyItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const currency = item.dataset.currency;
      localStorage.setItem('globexCurrency', currency);
      applySymbol(currency);

      currencyItems.forEach((el) => el.classList.remove('active'));
      item.classList.add('active');

      const parentDropdown = item.closest('.dropdown');
      if (parentDropdown) parentDropdown.classList.remove('dropdown-open');
    });
  });

  // Restore on load
  const savedCurrency = localStorage.getItem('globexCurrency') || 'USD';
  applySymbol(savedCurrency);
  const savedItem = document.querySelector(`[data-currency="${savedCurrency}"]`);
  if (savedItem) savedItem.classList.add('active');
}

function initSelectCurrencySwitcher() {
  const selects = document.querySelectorAll('#currency-select, #mobile-currency-select, [data-currency-selector]');
  if (!selects.length) return;

  const applySymbol = (currency) => {
    const symbol = (CURRENCY_SYMBOLS && CURRENCY_SYMBOLS[currency]) || currency + ' ';
    document.querySelectorAll('.price-symbol, .currency-symbol').forEach((el) => {
      el.textContent = symbol;
    });
  };

  selects.forEach((sel) => {
    sel.addEventListener('change', () => {
      const currency = sel.value;
      localStorage.setItem('globexCurrency', currency);
      applySymbol(currency);
      // sync all other selects
      selects.forEach((other) => { if (other !== sel) other.value = currency; });
    });
  });

  // Restore saved currency on load
  const saved = localStorage.getItem('globexCurrency') || 'USD';
  selects.forEach((sel) => { sel.value = saved; });
  applySymbol(saved);
}

/* ─────────────────────────────────────────────
   TAB COMPONENT
───────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      const tabGroup = btn.closest('[data-tab-group], .tabs-wrapper, .tab-container');

      if (!targetId) return;

      // Deactivate sibling buttons
      const siblingBtns = tabGroup
        ? tabGroup.querySelectorAll('.tab-btn')
        : document.querySelectorAll('.tab-btn');

      siblingBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Hide sibling panels
      const panels = tabGroup
        ? tabGroup.querySelectorAll('.tab-content')
        : document.querySelectorAll('.tab-content');

      panels.forEach((panel) => {
        panel.classList.remove('active');
        panel.setAttribute('hidden', '');
      });

      // Show target panel
      const target = document.getElementById(targetId) || document.querySelector(`[data-tab-panel="${targetId}"]`);
      if (target) {
        target.classList.add('active');
        target.removeAttribute('hidden');
      }
    });
  });

  // Activate first tab in each group on load
  document.querySelectorAll('[data-tab-group], .tabs-wrapper, .tab-container').forEach((group) => {
    const firstBtn = group.querySelector('.tab-btn');
    if (firstBtn && !group.querySelector('.tab-btn.active')) {
      firstBtn.click();
    }
  });
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
function openModal(modalId) {
  const modal = document.getElementById(modalId) || document.querySelector(`[data-modal="${modalId}"]`);
  if (!modal) return;
  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-active');
  modal.querySelector('[autofocus], input, button')?.focus();
}

function closeModal(modalId) {
  const modal = modalId
    ? document.getElementById(modalId) || document.querySelector(`[data-modal="${modalId}"]`)
    : document.querySelector('.modal-open');
  if (!modal) return;
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-open')) {
    document.body.classList.remove('modal-active');
  }
}

function initModals() {
  // Open triggers
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal-open]');
    if (trigger) {
      e.preventDefault();
      openModal(trigger.dataset.modalOpen);
    }

    // Close triggers
    const closer = e.target.closest('[data-modal-close], .modal-close');
    if (closer) {
      e.preventDefault();
      const modalId = closer.dataset.modalClose;
      closeModal(modalId || null);
    }

    // Click outside modal content
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal')) {
      closeModal(null);
    }
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(null);
  });
}

/* ─────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────── */
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Display a toast notification.
 * @param {string} message - Message to display.
 * @param {'success'|'error'|'warning'|'info'} type - Toast type.
 * @param {number} [duration=4000] - Auto-dismiss duration in ms.
 */
function showToast(message, type = 'info', duration = 4000) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  const dismiss = () => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return { dismiss };
}

/* ─────────────────────────────────────────────
   SMOOTH SCROLL
───────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTERS
───────────────────────────────────────────── */
/**
 * Animate a numeric counter from 0 to target.
 * @param {HTMLElement} el - Element whose text content will be updated.
 * @param {number} target - Target value.
 * @param {number} [duration=2000] - Animation duration in ms.
 */
function animateCounter(el, target, duration = 2000) {
  const start = performance.now();
  const isFloat = String(target).includes('.');
  const decimals = isFloat ? (String(target).split('.')[1] || '').length : 0;

  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = eased * target;
    el.textContent = isFloat ? value.toFixed(decimals) : Math.floor(value).toLocaleString();

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
          entry.target.dataset.counted = 'true';
          const target = parseFloat(entry.target.dataset.counter);
          const duration = parseInt(entry.target.dataset.counterDuration || '2000', 10);
          animateCounter(entry.target, target, duration);
        }
      });
    },
    { threshold: 0.3 }
  );

  counters.forEach((el) => observer.observe(el));
}

/* ─────────────────────────────────────────────
   COUNTDOWN TIMER
───────────────────────────────────────────── */
/**
 * Start a countdown timer targeting a specific date.
 * @param {HTMLElement} el - Container element; expects child elements with
 *   data attributes: [data-countdown-days], [data-countdown-hours],
 *   [data-countdown-minutes], [data-countdown-seconds]
 * @param {Date|string} targetDate - Target date/time.
 */
function startCountdown(el, targetDate) {
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);

  const daysEl = el.querySelector('[data-countdown-days]');
  const hoursEl = el.querySelector('[data-countdown-hours]');
  const minsEl = el.querySelector('[data-countdown-minutes]');
  const secsEl = el.querySelector('[data-countdown-seconds]');

  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  const tick = () => {
    const diff = target - Date.now();

    if (diff <= 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minsEl) minsEl.textContent = '00';
      if (secsEl) secsEl.textContent = '00';
      el.classList.add('countdown-expired');
      return;
    }

    const totalSecs = Math.floor(diff / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minsEl) minsEl.textContent = pad(mins);
    if (secsEl) secsEl.textContent = pad(secs);

    setTimeout(tick, 1000);
  };

  tick();
}

function initCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const targetDate = el.dataset.countdown;
    if (targetDate) startCountdown(el, targetDate);
  });
}

/* ─────────────────────────────────────────────
   REVEAL ANIMATIONS (IntersectionObserver)
───────────────────────────────────────────── */
function initRevealAnimations() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
}

/* ─────────────────────────────────────────────
   DROPDOWN MENUS
───────────────────────────────────────────── */
function initDropdowns() {
  // Toggle on click
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-dropdown-toggle], .dropdown-toggle');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = trigger.closest('.dropdown') || document.getElementById(trigger.dataset.dropdownToggle);
      if (!dropdown) return;

      const isOpen = dropdown.classList.contains('dropdown-open');

      // Close all open dropdowns
      document.querySelectorAll('.dropdown-open').forEach((d) => d.classList.remove('dropdown-open'));

      if (!isOpen) dropdown.classList.add('dropdown-open');
    } else {
      // Click outside: close all
      document.querySelectorAll('.dropdown-open').forEach((d) => d.classList.remove('dropdown-open'));
    }
  });

  // Keyboard accessibility
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dropdown-open').forEach((d) => d.classList.remove('dropdown-open'));
    }
  });
}

/* ─────────────────────────────────────────────
   TOOLTIPS
───────────────────────────────────────────── */
function initTooltips() {
  let activeTooltip = null;

  const createTooltip = (text) => {
    const tip = document.createElement('div');
    tip.className = 'tooltip-bubble';
    tip.textContent = text;
    document.body.appendChild(tip);
    return tip;
  };

  const positionTooltip = (tip, anchor) => {
    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8 + window.scrollY;
    let left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;

    // Keep within viewport horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  };

  document.querySelectorAll('[data-tooltip], [title]').forEach((el) => {
    const text = el.dataset.tooltip || el.getAttribute('title');
    if (!text) return;

    // Remove default browser tooltip
    if (el.hasAttribute('title')) {
      el.dataset.tooltip = text;
      el.removeAttribute('title');
    }

    el.addEventListener('mouseenter', () => {
      activeTooltip = createTooltip(text);
      requestAnimationFrame(() => {
        positionTooltip(activeTooltip, el);
        activeTooltip.classList.add('tooltip-visible');
      });
    });

    el.addEventListener('mouseleave', () => {
      if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
      }
    });
  });
}

/* ─────────────────────────────────────────────
   ACTIVE NAV LINK
───────────────────────────────────────────── */
function initActiveNavLink() {
  const currentPath = window.location.pathname;

  document.querySelectorAll('.nav-link, .sidebar-link, nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Exact match or starts-with match for sub-paths
    if (
      currentPath === href ||
      (href !== '/' && href !== '/index.html' && currentPath.startsWith(href))
    ) {
      link.classList.add('active');
      // Also mark parent menu items
      const parentItem = link.closest('.nav-item, .sidebar-item, li');
      if (parentItem) parentItem.classList.add('active');
    }
  });
}

/* ─────────────────────────────────────────────
   FLASH SALE COUNTDOWN (Homepage)
───────────────────────────────────────────── */
function initFlashSaleCountdown() {
  const flashSaleEl = document.querySelector('[data-flash-sale], .flash-sale-countdown');
  if (!flashSaleEl) return;

  // If a target date is set via attribute, use it; otherwise default to end of day
  let targetDate = flashSaleEl.dataset.flashSale || flashSaleEl.dataset.countdown;

  if (!targetDate) {
    // Default: next flash sale in 8 hours
    const now = new Date();
    now.setHours(now.getHours() + 8, 0, 0, 0);
    targetDate = now.toISOString();
  }

  startCountdown(flashSaleEl, targetDate);
}

/* ─────────────────────────────────────────────
   INIT ALL
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   GLOBAL EVENT BUS
───────────────────────────────────────────── */
const _eventBusListeners = {};

function eventBusOn(event, cb) {
  if (!_eventBusListeners[event]) _eventBusListeners[event] = [];
  _eventBusListeners[event].push(cb);
}

function eventBusOff(event, cb) {
  if (_eventBusListeners[event]) {
    _eventBusListeners[event] = _eventBusListeners[event].filter((fn) => fn !== cb);
  }
}

function eventBusEmit(event, ...args) {
  (_eventBusListeners[event] || []).forEach((cb) => { try { cb(...args); } catch (_) {} });
}

/* ─────────────────────────────────────────────
   THEME MANAGEMENT (dark / light mode)
───────────────────────────────────────────── */
function initTheme() {
  const THEME_KEY = 'globexTheme';
  const stored    = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme     = stored || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', theme);

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      btn.setAttribute('aria-pressed', String(next === 'dark'));
      eventBusEmit('theme:changed', next);
    });
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  });
}

/* ─────────────────────────────────────────────
   SCROLL-TO-TOP BUTTON
───────────────────────────────────────────── */
function initScrollToTop() {
  const btn = document.querySelector('[data-scroll-top], .scroll-to-top');
  if (!btn) return;

  const onScroll = () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ─────────────────────────────────────────────
   SERVICE WORKER REGISTRATION
───────────────────────────────────────────── */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Update available — refresh to get the latest version.', 'info');
            }
          });
        });
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));
  }
}

/* ─────────────────────────────────────────────
   INIT OPTIONAL MODULES
───────────────────────────────────────────── */
function initOptionalModules() {
  // Currency module
  if (window.Currency && typeof window.Currency.init === 'function') {
    window.Currency.init();
  }

  // i18n module
  if (window.GlobexI18n && typeof window.GlobexI18n.init === 'function') {
    window.GlobexI18n.init();
  }

  // Real-time module — connect when user is logged in
  if (window.Realtime && typeof window.Realtime.connect === 'function') {
    try {
      const session = JSON.parse(localStorage.getItem('globexSession') || 'null');
      if (session && session.token) window.Realtime.connect();
    } catch (_) {}
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initStickyNavbar();
  initMobileMenu();
  initAdminSidebar();
  initLanguageSwitcher();
  initCurrencySwitcher();
  initSelectCurrencySwitcher();
  initTabs();
  initModals();
  initSmoothScroll();
  initCounters();
  initCountdowns();
  initRevealAnimations();
  initDropdowns();
  initTooltips();
  initActiveNavLink();
  initFlashSaleCountdown();
  initTheme();
  initScrollToTop();
  initOptionalModules();
  registerServiceWorker();
});

/* ─────────────────────────────────────────────
   EXPORTS (for use by other modules)
───────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};
Object.assign(window.GlobexSky, {
  openModal,
  closeModal,
  showToast,
  animateCounter,
  startCountdown,
  CURRENCY_SYMBOLS,
  // Event bus
  on:   eventBusOn,
  off:  eventBusOff,
  emit: eventBusEmit,
});
