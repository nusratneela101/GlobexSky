/**
 * Globex Sky — Language Switcher Component
 * Renders a searchable dropdown with flag emoji + language name.
 * Usage: <div id="language-switcher"></div>
 * The component mounts itself inside every element matching the selector.
 */

(function (window) {
  'use strict';

  /* ─── Language metadata (must stay in sync with i18n.js) ─── */
  var LANGUAGES = [
    /* Most Popular */
    { code: 'en', label: 'English',           native: 'English',            flag: '🇬🇧', dir: 'ltr', popular: true },
    { code: 'zh', label: 'Chinese',           native: '中文',               flag: '🇨🇳', dir: 'ltr', popular: true },
    { code: 'ar', label: 'Arabic',            native: 'العربية',            flag: '🇸🇦', dir: 'rtl', popular: true },
    { code: 'hi', label: 'Hindi',             native: 'हिन्दी',             flag: '🇮🇳', dir: 'ltr', popular: true },
    { code: 'bn', label: 'Bengali',           native: 'বাংলা',              flag: '🇧🇩', dir: 'ltr', popular: true },
    { code: 'fr', label: 'French',            native: 'Français',           flag: '🇫🇷', dir: 'ltr', popular: true },
    { code: 'es', label: 'Spanish',           native: 'Español',            flag: '🇪🇸', dir: 'ltr', popular: true },
    { code: 'pt', label: 'Portuguese',        native: 'Português',          flag: '🇧🇷', dir: 'ltr', popular: true },
    /* All Languages */
    { code: 'ru', label: 'Russian',           native: 'Русский',            flag: '🇷🇺', dir: 'ltr', popular: false },
    { code: 'de', label: 'German',            native: 'Deutsch',            flag: '🇩🇪', dir: 'ltr', popular: false },
    { code: 'ja', label: 'Japanese',          native: '日本語',             flag: '🇯🇵', dir: 'ltr', popular: false },
    { code: 'ko', label: 'Korean',            native: '한국어',             flag: '🇰🇷', dir: 'ltr', popular: false },
    { code: 'tr', label: 'Turkish',           native: 'Türkçe',             flag: '🇹🇷', dir: 'ltr', popular: false },
    { code: 'id', label: 'Indonesian',        native: 'Bahasa Indonesia',   flag: '🇮🇩', dir: 'ltr', popular: false },
    { code: 'ms', label: 'Malay',             native: 'Bahasa Melayu',      flag: '🇲🇾', dir: 'ltr', popular: false },
    { code: 'th', label: 'Thai',              native: 'ภาษาไทย',           flag: '🇹🇭', dir: 'ltr', popular: false },
    { code: 'vi', label: 'Vietnamese',        native: 'Tiếng Việt',         flag: '🇻🇳', dir: 'ltr', popular: false },
    { code: 'ur', label: 'Urdu',              native: 'اردو',               flag: '🇵🇰', dir: 'rtl', popular: false },
    { code: 'fa', label: 'Persian',           native: 'فارسی',              flag: '🇮🇷', dir: 'rtl', popular: false },
    { code: 'sw', label: 'Swahili',           native: 'Kiswahili',          flag: '🇰🇪', dir: 'ltr', popular: false },
  ];

  var STORAGE_KEY = 'globexLang';
  var MOUNT_SELECTOR = '#language-switcher, [data-language-switcher]';

  /* ─── Helpers ─── */
  function getCurrentLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function getLangMeta(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return LANGUAGES[0];
  }

  /* ─── CSS ─── */
  function injectStyles() {
    if (document.getElementById('gs-lang-switcher-styles')) return;
    var style = document.createElement('style');
    style.id = 'gs-lang-switcher-styles';
    style.textContent = [
      '.gs-ls-wrap { position: relative; display: inline-block; font-family: "Inter", sans-serif; }',
      '.gs-ls-btn {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  background: transparent; border: 1px solid rgba(255,255,255,0.25);',
      '  border-radius: 8px; padding: 7px 12px; cursor: pointer;',
      '  color: inherit; font-size: 0.875rem; white-space: nowrap;',
      '  transition: background 0.2s, border-color 0.2s;',
      '}',
      '.gs-ls-btn:hover, .gs-ls-btn:focus { background: rgba(0,0,0,0.08); outline: none; }',
      '.gs-ls-btn .gs-ls-chevron { font-size: 0.65rem; transition: transform 0.2s; }',
      '.gs-ls-btn[aria-expanded="true"] .gs-ls-chevron { transform: rotate(180deg); }',

      '.gs-ls-dropdown {',
      '  position: absolute; top: calc(100% + 6px); right: 0;',
      '  width: 280px; background: #fff; border-radius: 12px;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.14); z-index: 9999;',
      '  opacity: 0; visibility: hidden; transform: translateY(-6px);',
      '  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;',
      '  overflow: hidden;',
      '}',
      '.gs-ls-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }',

      '.gs-ls-search-wrap { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }',
      '.gs-ls-search {',
      '  width: 100%; box-sizing: border-box;',
      '  border: 1.5px solid #e2e8f0; border-radius: 8px;',
      '  padding: 7px 12px; font-size: 0.82rem; font-family: inherit;',
      '  outline: none; color: #1e293b;',
      '}',
      '.gs-ls-search:focus { border-color: #0052CC; box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }',

      '.gs-ls-list { max-height: 300px; overflow-y: auto; padding: 6px 0; }',
      '.gs-ls-group-label {',
      '  padding: 6px 14px 4px; font-size: 0.72rem; font-weight: 700;',
      '  color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;',
      '}',
      '.gs-ls-item {',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 8px 14px; cursor: pointer;',
      '  font-size: 0.85rem; color: #1e293b;',
      '  transition: background 0.15s;',
      '}',
      '.gs-ls-item:hover { background: #f4f6fa; }',
      '.gs-ls-item.active { color: #0052CC; font-weight: 600; background: #eff6ff; }',
      '.gs-ls-flag { font-size: 1.1rem; line-height: 1; flex-shrink: 0; }',
      '.gs-ls-name { flex: 1; }',
      '.gs-ls-native { font-size: 0.78rem; color: #94a3b8; }',
      '.gs-ls-check { font-size: 0.8rem; color: #0052CC; }',
      '.gs-ls-no-results { padding: 12px 14px; color: #94a3b8; font-size: 0.85rem; text-align: center; }',

      /* Mobile */
      '@media (max-width: 600px) {',
      '  .gs-ls-dropdown { right: auto; left: 0; width: calc(100vw - 32px); max-width: 320px; }',
      '}',

      /* RTL */
      '[dir="rtl"] .gs-ls-dropdown { right: auto; left: 0; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── Render ─── */
  function renderDropdownContent(wrap, dropdown, searchQuery) {
    var list = dropdown.querySelector('.gs-ls-list');
    var currentCode = getCurrentLang();

    var popular = LANGUAGES.filter(function (l) { return l.popular; });
    var all = LANGUAGES.filter(function (l) { return !l.popular; });

    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      var filtered = LANGUAGES.filter(function (l) {
        return l.label.toLowerCase().indexOf(q) !== -1 ||
               l.native.toLowerCase().indexOf(q) !== -1 ||
               l.code.toLowerCase().indexOf(q) !== -1;
      });
      list.innerHTML = '';
      if (filtered.length === 0) {
        list.innerHTML = '<div class="gs-ls-no-results">No languages found</div>';
        return;
      }
      filtered.forEach(function (lang) {
        list.appendChild(buildItem(lang, currentCode));
      });
      return;
    }

    list.innerHTML = '';

    /* Most Popular group */
    var popLabel = document.createElement('div');
    popLabel.className = 'gs-ls-group-label';
    popLabel.textContent = 'Most Popular';
    list.appendChild(popLabel);
    popular.forEach(function (lang) {
      list.appendChild(buildItem(lang, currentCode));
    });

    /* All Languages group */
    var allLabel = document.createElement('div');
    allLabel.className = 'gs-ls-group-label';
    allLabel.textContent = 'All Languages';
    list.appendChild(allLabel);
    all.forEach(function (lang) {
      list.appendChild(buildItem(lang, currentCode));
    });
  }

  function buildItem(lang, currentCode) {
    var item = document.createElement('div');
    item.className = 'gs-ls-item' + (lang.code === currentCode ? ' active' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', lang.code === currentCode ? 'true' : 'false');
    item.setAttribute('data-lang-code', lang.code);

    var flag = document.createElement('span');
    flag.className = 'gs-ls-flag';
    flag.textContent = lang.flag;

    var nameWrap = document.createElement('span');
    nameWrap.className = 'gs-ls-name';

    var nameEl = document.createElement('div');
    nameEl.textContent = lang.native;

    var nativeEl = document.createElement('div');
    nativeEl.className = 'gs-ls-native';
    nativeEl.textContent = lang.label;

    nameWrap.appendChild(nameEl);
    nameWrap.appendChild(nativeEl);

    item.appendChild(flag);
    item.appendChild(nameWrap);

    if (lang.code === currentCode) {
      var check = document.createElement('span');
      check.className = 'gs-ls-check';
      check.textContent = '✓';
      item.appendChild(check);
    }

    item.addEventListener('click', function () {
      selectLanguage(lang.code);
    });

    return item;
  }

  function selectLanguage(code) {
    localStorage.setItem(STORAGE_KEY, code);

    /* Delegate to GlobexSky.i18n if available */
    if (window.GlobexSky && window.GlobexSky.i18n) {
      window.GlobexSky.i18n.switchLanguage(code);
    } else if (window.i18n && window.i18n.switchLanguage) {
      window.i18n.switchLanguage(code);
    }

    /* Update all mounted switchers */
    mountAll();

    /* Close all open dropdowns */
    document.querySelectorAll('.gs-ls-dropdown.open').forEach(function (d) {
      d.classList.remove('open');
      var btn = d.previousSibling;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  /* ─── Mount a single root element ─── */
  function mount(root) {
    root.innerHTML = '';

    var currentCode = getCurrentLang();
    var meta = getLangMeta(currentCode);

    var wrap = document.createElement('div');
    wrap.className = 'gs-ls-wrap';

    /* Toggle button */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gs-ls-btn';
    btn.id = 'gs-ls-btn-' + Math.random().toString(36).substr(2, 6);
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Select language: ' + meta.native);

    var flagEl = document.createElement('span');
    flagEl.textContent = meta.flag;

    var labelEl = document.createElement('span');
    labelEl.textContent = meta.native;

    var chevron = document.createElement('span');
    chevron.className = 'gs-ls-chevron';
    chevron.textContent = '▾';

    btn.appendChild(flagEl);
    btn.appendChild(labelEl);
    btn.appendChild(chevron);

    /* Dropdown */
    var dropdown = document.createElement('div');
    dropdown.className = 'gs-ls-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Language selector');

    var searchWrap = document.createElement('div');
    searchWrap.className = 'gs-ls-search-wrap';

    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'gs-ls-search';
    searchInput.placeholder = 'Search languages…';
    searchInput.setAttribute('aria-label', 'Search languages');
    searchWrap.appendChild(searchInput);

    var list = document.createElement('div');
    list.className = 'gs-ls-list';

    dropdown.appendChild(searchWrap);
    dropdown.appendChild(list);

    /* Populate list */
    renderDropdownContent(wrap, dropdown, '');

    /* Search handler */
    searchInput.addEventListener('input', function () {
      renderDropdownContent(wrap, dropdown, searchInput.value.trim());
    });

    /* Toggle open/close */
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        searchInput.value = '';
        renderDropdownContent(wrap, dropdown, '');
        setTimeout(function () { searchInput.focus(); }, 50);
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(dropdown);
    root.appendChild(wrap);
  }

  /* ─── Mount all roots on the page ─── */
  function mountAll() {
    document.querySelectorAll(MOUNT_SELECTOR).forEach(mount);
  }

  /* ─── Close dropdowns on outside click ─── */
  document.addEventListener('click', function () {
    document.querySelectorAll('.gs-ls-dropdown.open').forEach(function (d) {
      d.classList.remove('open');
      var btn = d.parentNode && d.parentNode.querySelector('.gs-ls-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });

  /* ─── Init ─── */
  function init() {
    injectStyles();
    mountAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-mount after language change so active indicator updates */
  window.addEventListener('globex:langChanged', function () {
    mountAll();
  });

  /* Expose for manual use */
  if (!window.GlobexSky) window.GlobexSky = {};
  window.GlobexSky.LanguageSwitcher = { mount: mount, mountAll: mountAll };

}(window));
