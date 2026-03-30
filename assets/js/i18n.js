/**
 * Globex Sky — i18n.js
 * Internationalization engine: detects browser language, loads JSON
 * translation files, translates DOM elements with data-i18n attributes,
 * persists language preference in localStorage, and exposes switchLanguage().
 */

(function (window) {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */
  const STORAGE_KEY   = 'globexLang';
  const DEFAULT_LANG  = 'en';
  // Resolve the site root dynamically from the current script src so the path
  // works regardless of where the site is hosted (root or sub-directory).
  // Strategy: find this script's URL, then strip path segments until we reach
  // the directory that contains 'locales/'.  The locales/ folder is expected
  // to live at the repository/site root (same level as index.html).
  const _scriptBase = (function () {
    try {
      const scripts = document.querySelectorAll('script[src]');
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].getAttribute('src') || '';
        if (src.indexOf('i18n') !== -1) {
          // Split on '/', drop the filename, then keep popping segments until
          // we find the root (the segment that precedes 'assets').
          const parts = src.replace(/\\/g, '/').split('/');
          parts.pop(); // remove filename (i18n.js)
          // Walk up past any directory segments until 'assets' is removed
          while (parts.length > 0 && parts[parts.length - 1] !== '') {
            const segment = parts[parts.length - 1];
            parts.pop();
            if (segment === 'assets') break; // we've reached the root
          }
          return parts.length ? parts.join('/') + '/' : './';
        }
      }
    } catch (e) { /* ignore */ }
    return './';
  }());
  const LOCALES_PATH  = _scriptBase + 'locales/';
  const RTL_CSS_ID    = 'globex-rtl-stylesheet';

  /** Supported languages with display names and flag emoji. */
  const LANGUAGES = {
    en: { label: 'English',           flag: '🇬🇧', dir: 'ltr' },
    bn: { label: 'বাংলা',             flag: '🇧🇩', dir: 'ltr' },
    ar: { label: 'العربية',           flag: '🇸🇦', dir: 'rtl' },
    hi: { label: 'हिन्दी',            flag: '🇮🇳', dir: 'ltr' },
    zh: { label: '中文',              flag: '🇨🇳', dir: 'ltr' },
    fr: { label: 'Français',          flag: '🇫🇷', dir: 'ltr' },
    es: { label: 'Español',           flag: '🇪🇸', dir: 'ltr' },
    pt: { label: 'Português',         flag: '🇧🇷', dir: 'ltr' },
    ru: { label: 'Русский',           flag: '🇷🇺', dir: 'ltr' },
    de: { label: 'Deutsch',           flag: '🇩🇪', dir: 'ltr' },
    ja: { label: '日本語',            flag: '🇯🇵', dir: 'ltr' },
    ko: { label: '한국어',            flag: '🇰🇷', dir: 'ltr' },
    tr: { label: 'Türkçe',            flag: '🇹🇷', dir: 'ltr' },
    id: { label: 'Bahasa Indonesia',  flag: '🇮🇩', dir: 'ltr' },
    ms: { label: 'Bahasa Melayu',     flag: '🇲🇾', dir: 'ltr' },
    th: { label: 'ภาษาไทย',          flag: '🇹🇭', dir: 'ltr' },
    vi: { label: 'Tiếng Việt',        flag: '🇻🇳', dir: 'ltr' },
    ur: { label: 'اردو',              flag: '🇵🇰', dir: 'rtl' },
    fa: { label: 'فارسی',             flag: '🇮🇷', dir: 'rtl' },
    sw: { label: 'Kiswahili',         flag: '🇰🇪', dir: 'ltr' },
  };

  /** RTL language codes. */
  const RTL_LANGS = ['ar', 'ur', 'fa', 'he'];

  /* ─────────────────────────────────────────────
     INTERNAL STATE
  ───────────────────────────────────────────── */
  let _currentLang = DEFAULT_LANG;
  let _translations = {};

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  /**
   * Resolve a dot-separated key path inside a nested object.
   * e.g. getNestedValue({ nav: { home: 'Home' } }, 'nav.home') → 'Home'
   * @param {Object} obj
   * @param {string} keyPath
   * @returns {string|undefined}
   */
  function getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce(function (acc, key) {
      return acc && acc[key] !== undefined ? acc[key] : undefined;
    }, obj);
  }

  /**
   * Detect the best matching language from the browser's preferred languages.
   * Falls back to DEFAULT_LANG if nothing matches.
   * @returns {string} language code
   */
  function detectBrowserLanguage() {
    const preferred = (navigator.languages || [navigator.language || navigator.userLanguage]);
    for (var i = 0; i < preferred.length; i++) {
      const code = preferred[i].toLowerCase().split('-')[0];
      if (LANGUAGES[code]) {
        return code;
      }
    }
    return DEFAULT_LANG;
  }

  /**
   * Resolve the initial language: stored preference → browser detection → default.
   * @returns {string} language code
   */
  function resolveInitialLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES[stored]) {
      return stored;
    }
    return detectBrowserLanguage();
  }

  /* ─────────────────────────────────────────────
     TRANSLATION LOADING
  ───────────────────────────────────────────── */

  /**
   * Fetch a locale JSON file and return the parsed object.
   * @param {string} lang
   * @returns {Promise<Object>}
   */
  function fetchTranslations(lang) {
    return fetch(LOCALES_PATH + lang + '.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('i18n: failed to load locale "' + lang + '" (' + response.status + ')');
        }
        return response.json();
      });
  }

  /* ─────────────────────────────────────────────
     DOM TRANSLATION
  ───────────────────────────────────────────── */

  /**
   * Translate a single element according to its data-i18n attributes.
   * Supported attributes:
   *   data-i18n          → sets textContent
   *   data-i18n-html     → sets innerHTML
   *   data-i18n-placeholder → sets placeholder attribute
   *   data-i18n-title    → sets title attribute
   *   data-i18n-aria-label → sets aria-label attribute
   * @param {HTMLElement} el
   */
  function translateElement(el) {
    const key             = el.dataset.i18n;
    const keyHtml         = el.dataset.i18nHtml;
    const keyPlaceholder  = el.dataset.i18nPlaceholder;
    const keyTitle        = el.dataset.i18nTitle;
    const keyAriaLabel    = el.dataset.i18nAriaLabel;

    if (key) {
      const val = getNestedValue(_translations, key);
      if (val !== undefined) {
        el.textContent = val;
      }
    }

    if (keyHtml) {
      const val = getNestedValue(_translations, keyHtml);
      if (val !== undefined) {
        el.innerHTML = val;
      }
    }

    if (keyPlaceholder) {
      const val = getNestedValue(_translations, keyPlaceholder);
      if (val !== undefined) {
        el.setAttribute('placeholder', val);
      }
    }

    if (keyTitle) {
      const val = getNestedValue(_translations, keyTitle);
      if (val !== undefined) {
        el.setAttribute('title', val);
      }
    }

    if (keyAriaLabel) {
      const val = getNestedValue(_translations, keyAriaLabel);
      if (val !== undefined) {
        el.setAttribute('aria-label', val);
      }
    }
  }

  /**
   * Walk the DOM and translate every element that has a data-i18n* attribute.
   */
  function translateDOM() {
    const selector = [
      '[data-i18n]',
      '[data-i18n-html]',
      '[data-i18n-placeholder]',
      '[data-i18n-title]',
      '[data-i18n-aria-label]',
    ].join(',');

    document.querySelectorAll(selector).forEach(translateElement);
  }

  /* ─────────────────────────────────────────────
     RTL SUPPORT
  ───────────────────────────────────────────── */

  /**
   * Apply or remove RTL direction and stylesheet.
   * @param {boolean} isRtl
   */
  function applyDirection(isRtl) {
    const htmlEl = document.documentElement;

    if (isRtl) {
      htmlEl.setAttribute('dir', 'rtl');
      htmlEl.setAttribute('lang', _currentLang);

      // Inject rtl.css if not already present
      if (!document.getElementById(RTL_CSS_ID)) {
        const link = document.createElement('link');
        link.id   = RTL_CSS_ID;
        link.rel  = 'stylesheet';
        link.href = '/assets/css/rtl.css';
        document.head.appendChild(link);
      }
    } else {
      htmlEl.setAttribute('dir', 'ltr');
      htmlEl.setAttribute('lang', _currentLang);

      // Remove rtl.css if present
      const existing = document.getElementById(RTL_CSS_ID);
      if (existing) {
        existing.parentNode.removeChild(existing);
      }
    }
  }

  /* ─────────────────────────────────────────────
     LANGUAGE SWITCHER UI
  ───────────────────────────────────────────── */

  /**
   * Update all language switcher buttons/items in the page to reflect
   * the newly active language.
   * @param {string} lang
   */
  function updateSwitcherUI(lang) {
    const meta = LANGUAGES[lang];

    // Update the main switcher button label (created by buildSwitcherDropdown)
    const btn = document.getElementById('lang-switcher-btn');
    if (btn) {
      const flagEl  = btn.querySelector('.lang-flag');
      const labelEl = btn.querySelector('.lang-label');
      if (flagEl)  flagEl.textContent  = meta.flag;
      if (labelEl) labelEl.textContent = meta.label;
    }

    // Mark active item inside the dropdown list
    document.querySelectorAll('[data-lang]').forEach(function (item) {
      if (item.dataset.lang === lang) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'true');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    // Also keep the legacy <select> in sync (index.html has id="lang-select")
    const legacySelect = document.getElementById('lang-select');
    if (legacySelect) {
      legacySelect.value = lang;
    }
  }

  /* ─────────────────────────────────────────────
     PUBLIC API — switchLanguage()
  ───────────────────────────────────────────── */

  /**
   * Switch the active language, load its translations, translate the DOM,
   * apply RTL if needed, and persist the choice.
   * @param {string} lang - One of the supported language codes.
   * @returns {Promise<void>}
   */
  function switchLanguage(lang) {
    if (!LANGUAGES[lang]) {
      console.warn('i18n: unsupported language "' + lang + '". Falling back to "' + DEFAULT_LANG + '".');
      lang = DEFAULT_LANG;
    }

    return fetchTranslations(lang)
      .then(function (data) {
        _translations = data;
        _currentLang  = lang;

        // Persist
        localStorage.setItem(STORAGE_KEY, lang);

        // Apply RTL / LTR — use LANGUAGES map (locale JSON files don't include an rtl property)
        const isRtl = (LANGUAGES[lang] && LANGUAGES[lang].dir === 'rtl') || RTL_LANGS.indexOf(lang) !== -1;
        applyDirection(isRtl);

        // Translate DOM
        translateDOM();

        // Update switcher UI
        updateSwitcherUI(lang);

        // Dispatch custom event so other scripts can react
        window.dispatchEvent(new CustomEvent('globex:langChanged', {
          detail: { lang: lang, rtl: isRtl, translations: data },
        }));
      })
      .catch(function (err) {
        console.error(err);
        // Fall back to English if the requested locale fails to load
        if (lang !== DEFAULT_LANG) {
          console.warn('i18n: falling back to "' + DEFAULT_LANG + '".');
          return fetchTranslations(DEFAULT_LANG).then(function (fallbackData) {
            _translations = fallbackData;
            _currentLang  = DEFAULT_LANG;
            translateDOM();
          }).catch(function () {
            console.error('i18n: English locale also unavailable. Translations will not be applied.');
          });
        }
      });
  }

  /* ─────────────────────────────────────────────
     LANGUAGE SWITCHER DROPDOWN — BUILD IN DOM
  ───────────────────────────────────────────── */

  /**
   * Build a proper dropdown language switcher and inject it into any
   * element with id="lang-switcher-root" or data-lang-switcher="root".
   * Also replaces the legacy <select id="lang-select"> if found.
   */
  function buildSwitcherDropdown() {
    const roots = document.querySelectorAll('#lang-switcher-root, [data-lang-switcher="root"]');

    roots.forEach(function (root) {
      root.innerHTML = '';

      // Wrapper div (acts as dropdown trigger)
      const wrapper = document.createElement('div');
      wrapper.className = 'dropdown lang-switcher';

      // Toggle button
      const btn = document.createElement('button');
      btn.id          = 'lang-switcher-btn';
      btn.type        = 'button';
      btn.className   = 'lang-switcher-btn dropdown-trigger';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'lang-switcher-menu');
      btn.setAttribute('aria-label', 'Select language');

      const flagSpan  = document.createElement('span');
      flagSpan.className = 'lang-flag';
      flagSpan.setAttribute('aria-hidden', 'true');
      flagSpan.textContent = LANGUAGES[_currentLang].flag;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'lang-label';
      labelSpan.textContent = LANGUAGES[_currentLang].label;

      const chevron   = document.createElement('i');
      chevron.className = 'fas fa-chevron-down lang-chevron';
      chevron.setAttribute('aria-hidden', 'true');

      btn.appendChild(flagSpan);
      btn.appendChild(labelSpan);
      btn.appendChild(chevron);

      // Dropdown menu
      const menu = document.createElement('ul');
      menu.id        = 'lang-switcher-menu';
      menu.className = 'lang-switcher-dropdown';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Language options');

      Object.keys(LANGUAGES).forEach(function (code) {
        const lang = LANGUAGES[code];
        const li   = document.createElement('li');
        li.setAttribute('role', 'none');

        const a = document.createElement('a');
        a.href          = '#';
        a.className     = 'lang-item' + (code === _currentLang ? ' active' : '');
        a.setAttribute('role', 'menuitem');
        a.setAttribute('data-lang', code);
        if (code === _currentLang) a.setAttribute('aria-current', 'true');

        const itemFlag  = document.createElement('span');
        itemFlag.className = 'lang-item-flag';
        itemFlag.setAttribute('aria-hidden', 'true');
        itemFlag.textContent = lang.flag;

        const itemLabel = document.createElement('span');
        itemLabel.className = 'lang-item-label';
        itemLabel.textContent = lang.label;

        a.appendChild(itemFlag);
        a.appendChild(itemLabel);
        li.appendChild(a);
        menu.appendChild(li);

        // Click handler
        a.addEventListener('click', function (e) {
          e.preventDefault();
          switchLanguage(code);
          menu.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
          chevron.style.transform = '';
        });
      });

      // Toggle dropdown open/close
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
      });

      // Close on outside click
      document.addEventListener('click', function () {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        chevron.style.transform = '';
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(menu);
      root.appendChild(wrapper);
    });

    // Enhance legacy <select id="lang-select"> with change handler
    const legacySelect = document.getElementById('lang-select');
    if (legacySelect) {
      legacySelect.addEventListener('change', function () {
        switchLanguage(legacySelect.value);
      });
      // Set current value
      legacySelect.value = _currentLang;
    }
  }

  /* ─────────────────────────────────────────────
     INLINE STYLES FOR THE SWITCHER
  ───────────────────────────────────────────── */

  /** Inject minimal CSS for the language switcher dropdown widget. */
  function injectSwitcherStyles() {
    if (document.getElementById('globex-i18n-styles')) return;

    const style = document.createElement('style');
    style.id = 'globex-i18n-styles';
    style.textContent = [
      '.lang-switcher { position: relative; display: inline-flex; align-items: center; }',
      '.lang-switcher-btn {',
      '  display: inline-flex; align-items: center; gap: 0.375rem;',
      '  background: transparent; border: 1px solid rgba(255,255,255,0.25);',
      '  border-radius: 0.5rem; padding: 0.35rem 0.65rem;',
      '  color: inherit; cursor: pointer; font-size: 0.875rem;',
      '  transition: background 0.2s, border-color 0.2s;',
      '}',
      '.lang-switcher-btn:hover, .lang-switcher-btn:focus { background: rgba(0,0,0,0.08); outline: none; }',
      '.lang-chevron { font-size: 0.65rem; transition: transform 0.2s; }',
      '.lang-switcher-dropdown {',
      '  position: absolute; top: calc(100% + 8px); right: 0;',
      '  min-width: 160px; background: #fff; border-radius: 0.625rem;',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.12); list-style: none;',
      '  padding: 0.5rem 0; margin: 0; z-index: 9999;',
      '  opacity: 0; visibility: hidden; transform: translateY(-8px);',
      '  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;',
      '}',
      '.lang-switcher-dropdown.open {',
      '  opacity: 1; visibility: visible; transform: translateY(0);',
      '}',
      '.lang-item {',
      '  display: flex; align-items: center; gap: 0.5rem;',
      '  padding: 0.5rem 1rem; color: #1a1a2e; text-decoration: none;',
      '  font-size: 0.875rem; transition: background 0.15s;',
      '}',
      '.lang-item:hover { background: #f4f6fa; }',
      '.lang-item.active { color: #0052CC; font-weight: 600; }',
      '.lang-item-flag { font-size: 1.1rem; line-height: 1; }',
      '[dir="rtl"] .lang-switcher-dropdown { right: auto; left: 0; }',
    ].join('\n');

    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
     INITIALISATION
  ───────────────────────────────────────────── */

  /**
   * Bootstrap the i18n system.
   * Called automatically on DOMContentLoaded.
   */
  function init() {
    const lang = resolveInitialLanguage();

    injectSwitcherStyles();

    switchLanguage(lang).then(function () {
      buildSwitcherDropdown();
    });
  }

  /* ─────────────────────────────────────────────
     EXPOSE PUBLIC API
  ───────────────────────────────────────────── */

  /**
   * Public i18n object exposed on window.GlobexSky.i18n
   * and also as window.i18n for convenience.
   */
  const i18n = {
    /** Switch to a different language (alias: setLanguage). */
    switchLanguage: switchLanguage,

    /**
     * Set the active language, save preference, re-render page.
     * Alias for switchLanguage().
     * @param {string} langCode
     * @returns {Promise<void>}
     */
    setLanguage: switchLanguage,

    /**
     * Load a language file and cache it (does not change active language).
     * @param {string} langCode
     * @returns {Promise<Object>}
     */
    loadLanguage: fetchTranslations,

    /**
     * Detect the best language to use.
     * Priority: 1) localStorage, 2) browser navigator.language, 3) default 'en'.
     * @returns {string} language code
     */
    detectLanguage: resolveInitialLanguage,

    /**
     * Run on page load: detect and apply language.
     * Already called automatically — exposed for manual re-init scenarios.
     */
    autoInit: init,

    /**
     * Return true if the current language is RTL (Arabic, Urdu, Persian, Hebrew).
     * @returns {boolean}
     */
    getRTL: function () {
      return RTL_LANGS.indexOf(_currentLang) !== -1;
    },

    /**
     * Format a currency amount using Intl.NumberFormat for the current locale.
     * @param {number} amount
     * @param {string} [currencyCode] - ISO 4217 code, e.g. 'USD', 'EUR'.
     * @returns {string}
     */
    formatCurrency: function (amount, currencyCode) {
      var currency = currencyCode || 'USD';
      try {
        return new Intl.NumberFormat(_currentLang, {
          style: 'currency',
          currency: currency,
        }).format(amount);
      } catch (e) {
        return amount.toString();
      }
    },

    /**
     * Format a date using Intl.DateTimeFormat for the current locale.
     * @param {Date|string|number} date
     * @param {Intl.DateTimeFormatOptions} [options]
     * @returns {string}
     */
    formatDate: function (date, options) {
      try {
        return new Intl.DateTimeFormat(_currentLang, options || {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(date));
      } catch (e) {
        return String(date);
      }
    },

    /**
     * Return a pluralized translation string based on count.
     * Expects translation keys: key + '_one' and key + '_other' (or just key).
     * @param {string} key - Base translation key.
     * @param {number} count
     * @returns {string}
     */
    pluralize: function (key, count) {
      var pluralKey = count === 1 ? key + '_one' : key + '_other';
      var val = getNestedValue(_translations, pluralKey);
      if (val === undefined) {
        val = getNestedValue(_translations, key);
      }
      if (val === undefined) return key;
      return val.replace(/\{count\}/g, count);
    },

    /**
     * Translate a single key.
     * @param {string} key - Dot-notation key, e.g. 'nav.home'.
     * @param {Object} [vars] - Optional placeholder replacements, e.g. { min: 3 }.
     * @returns {string}
     */
    t: function (key, vars) {
      let val = getNestedValue(_translations, key);
      if (val === undefined) return key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
        });
      }
      return val;
    },

    /** Return the currently active language code. */
    getCurrentLang: function () { return _currentLang; },

    /** Return metadata for all supported languages. */
    getLanguages: function () { return Object.assign({}, LANGUAGES); },

    /** Re-translate the DOM (useful after dynamic content injection). */
    translateDOM: translateDOM,
  };

  // Attach to window.GlobexSky namespace (created by main.js if needed)
  if (!window.GlobexSky) {
    window.GlobexSky = {};
  }
  window.GlobexSky.i18n = i18n;

  // Convenience alias
  window.i18n = i18n;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
