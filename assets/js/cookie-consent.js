/**
 * Globex Sky — cookie-consent.js
 * GDPR-compliant cookie consent banner.
 * Shows on first visit; blocks analytics/tracking until consent is given.
 * Stores user preference in localStorage under 'globexCookieConsent'.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'globexCookieConsent';
  var BANNER_ID = 'cookie-consent-banner';

  /* ─── Consent Categories ──────────────────────────────────────────────── */

  var DEFAULT_CONSENT = {
    necessary: true,       // always on
    analytics: false,
    marketing: false,
    preferences: false,
  };

  function getConsent() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  }

  function saveConsent(consent) {
    var data = Object.assign({}, DEFAULT_CONSENT, consent, {
      necessary: true,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    applyConsent(data);
    hideBanner();
    return data;
  }

  /* ─── Apply Consent (load/block scripts) ─────────────────────────────── */

  function applyConsent(consent) {
    // Fire a custom event so analytics integrations can listen
    var event = new CustomEvent('globexConsentUpdated', { detail: consent });
    window.dispatchEvent(event);

    // Load Google Analytics only if analytics consent is given
    if (consent.analytics && typeof window.gtag === 'undefined') {
      loadGoogleAnalytics();
    }
  }

  function loadGoogleAnalytics() {
    // Placeholder — replace GA_MEASUREMENT_ID with real value
    var GA_ID = (window.GlobexConfig && window.GlobexConfig.GA_ID) || 'G-XXXXXXXXXX';
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  /* ─── Banner HTML ─────────────────────────────────────────────────────── */

  var BANNER_HTML = `
<div id="${BANNER_ID}" class="cookie-banner" role="dialog"
     aria-modal="true" aria-label="Cookie Consent" aria-live="polite">
  <div class="cookie-banner__inner">
    <div class="cookie-banner__content">
      <div class="cookie-banner__icon" aria-hidden="true">🍪</div>
      <div class="cookie-banner__text">
        <p class="cookie-banner__title">We use cookies</p>
        <p class="cookie-banner__description">
          We use cookies to improve your experience, analyse site traffic, and
          personalise content. You can choose which categories to allow.
          <a href="/pages/cookie-policy.html" target="_blank" class="cookie-banner__link">
            Learn more
          </a>
        </p>
      </div>
    </div>
    <div class="cookie-banner__actions">
      <button id="cookie-accept-all" class="btn cookie-btn cookie-btn--accept">
        Accept All
      </button>
      <button id="cookie-reject" class="btn cookie-btn cookie-btn--reject">
        Reject Non-Essential
      </button>
      <button id="cookie-customize" class="btn cookie-btn cookie-btn--customize">
        Customize
      </button>
    </div>
  </div>

  <!-- Customise panel (hidden by default) -->
  <div id="cookie-customize-panel" class="cookie-customize-panel" hidden>
    <h3 class="cookie-customize-panel__title">Cookie Preferences</h3>
    <ul class="cookie-category-list">
      <li class="cookie-category-item">
        <label class="cookie-category-label">
          <span class="cookie-category-name">Necessary</span>
          <span class="cookie-category-desc">Required for the site to function. Cannot be disabled.</span>
        </label>
        <input type="checkbox" checked disabled class="cookie-toggle" aria-label="Necessary cookies (always on)"/>
      </li>
      <li class="cookie-category-item">
        <label class="cookie-category-label" for="consent-analytics">
          <span class="cookie-category-name">Analytics</span>
          <span class="cookie-category-desc">Help us understand how visitors interact with the site.</span>
        </label>
        <input type="checkbox" id="consent-analytics" class="cookie-toggle" aria-label="Analytics cookies"/>
      </li>
      <li class="cookie-category-item">
        <label class="cookie-category-label" for="consent-marketing">
          <span class="cookie-category-name">Marketing</span>
          <span class="cookie-category-desc">Used to deliver relevant advertisements and track campaigns.</span>
        </label>
        <input type="checkbox" id="consent-marketing" class="cookie-toggle" aria-label="Marketing cookies"/>
      </li>
      <li class="cookie-category-item">
        <label class="cookie-category-label" for="consent-preferences">
          <span class="cookie-category-name">Preferences</span>
          <span class="cookie-category-desc">Remember your settings such as language and currency.</span>
        </label>
        <input type="checkbox" id="consent-preferences" class="cookie-toggle" aria-label="Preferences cookies"/>
      </li>
    </ul>
    <div class="cookie-customize-panel__actions">
      <button id="cookie-save-prefs" class="btn cookie-btn cookie-btn--accept">Save My Preferences</button>
    </div>
  </div>
</div>
<style>
.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;
  background:#fff;box-shadow:0 -4px 24px rgba(0,0,0,.12);
  border-top:3px solid #0052CC;padding:16px 24px;
  font-family:'Inter',sans-serif;font-size:.9rem;color:#1a1a2e;
  transform:translateY(100%);transition:transform .35s ease;
  animation:slideUpBanner .4s .5s forwards}
@keyframes slideUpBanner{to{transform:translateY(0)}}
.cookie-banner__inner{max-width:1400px;margin:0 auto;display:flex;
  align-items:flex-start;gap:24px;flex-wrap:wrap}
.cookie-banner__content{display:flex;gap:14px;align-items:flex-start;flex:1;min-width:0}
.cookie-banner__icon{font-size:2rem;flex-shrink:0}
.cookie-banner__title{font-weight:700;font-size:1rem;margin:0 0 4px;color:#0a0e27}
.cookie-banner__description{margin:0;color:#4b5563;line-height:1.5}
.cookie-banner__link{color:#0052CC;text-decoration:underline}
.cookie-banner__actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex-shrink:0}
.cookie-btn{padding:8px 18px;border-radius:8px;font-size:.85rem;
  font-weight:600;cursor:pointer;border:none;font-family:'Poppins',sans-serif;
  white-space:nowrap;transition:all .2s}
.cookie-btn--accept{background:#0052CC;color:#fff}
.cookie-btn--accept:hover{background:#003d99}
.cookie-btn--reject{background:#f1f5f9;color:#374151;border:1px solid #e2e8f0}
.cookie-btn--reject:hover{background:#e2e8f0}
.cookie-btn--customize{background:transparent;color:#0052CC;border:1.5px solid #0052CC}
.cookie-btn--customize:hover{background:#f0f4ff}
.cookie-customize-panel{padding:16px 0 0;border-top:1px solid #e2e8f0;width:100%}
.cookie-customize-panel__title{font-weight:700;margin:0 0 12px;font-size:.95rem;color:#0a0e27}
.cookie-category-list{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:10px}
.cookie-category-item{display:flex;justify-content:space-between;align-items:flex-start;
  gap:12px;padding:10px 14px;border-radius:8px;background:#f8fafc}
.cookie-category-label{flex:1;cursor:pointer}
.cookie-category-name{font-weight:600;display:block;color:#0a0e27;font-size:.88rem}
.cookie-category-desc{font-size:.8rem;color:#6b7280;display:block;margin-top:2px}
.cookie-toggle{width:38px;height:22px;appearance:none;background:#d1d5db;
  border-radius:99px;cursor:pointer;flex-shrink:0;position:relative;
  transition:background .2s;margin-top:2px}
.cookie-toggle:checked{background:#0052CC}
.cookie-toggle:disabled{opacity:.5;cursor:not-allowed}
.cookie-toggle::after{content:'';position:absolute;top:3px;left:3px;
  width:16px;height:16px;background:#fff;border-radius:50%;transition:left .2s}
.cookie-toggle:checked::after{left:19px}
.cookie-customize-panel__actions{display:flex;justify-content:flex-end}
</style>`;

  /* ─── Banner Logic ────────────────────────────────────────────────────── */

  function createBanner() {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = BANNER_HTML;
    document.body.appendChild(wrapper.firstElementChild);

    // Buttons
    document.getElementById('cookie-accept-all').addEventListener('click', function () {
      saveConsent({ analytics: true, marketing: true, preferences: true });
    });

    document.getElementById('cookie-reject').addEventListener('click', function () {
      saveConsent({ analytics: false, marketing: false, preferences: false });
    });

    document.getElementById('cookie-customize').addEventListener('click', function () {
      var panel = document.getElementById('cookie-customize-panel');
      if (panel) panel.hidden = !panel.hidden;
      this.setAttribute('aria-expanded', String(!panel.hidden));
    });

    document.getElementById('cookie-save-prefs').addEventListener('click', function () {
      var consent = {
        analytics: document.getElementById('consent-analytics').checked,
        marketing: document.getElementById('consent-marketing').checked,
        preferences: document.getElementById('consent-preferences').checked,
      };
      saveConsent(consent);
    });
  }

  function hideBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (banner) {
      banner.style.transform = 'translateY(100%)';
      setTimeout(function () { banner.remove(); }, 400);
    }
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */

  function init() {
    var existingConsent = getConsent();
    if (existingConsent) {
      // Consent already given — just apply it
      applyConsent(existingConsent);
      return;
    }
    // First visit: show banner
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      createBanner();
    }
  }

  init();

  /* ─── Public API ─────────────────────────────────────────────────────── */
  window.GlobexCookieConsent = {
    getConsent: getConsent,
    resetConsent: function () {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
    hasConsent: function (category) {
      var c = getConsent();
      return c ? Boolean(c[category]) : false;
    },
  };
})();
