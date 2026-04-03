/**
 * Globex Sky - Language Switcher
 * Renders language dropdown into #lang-switcher-root and #mobile-lang-switcher-root
 * Delegates language switching to GlobexSky.i18n.switchLanguage() when available.
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'en', label: 'EN', name: 'English',           flag: '🇺🇸' },
    { code: 'es', label: 'ES', name: 'Español',           flag: '🇪🇸' },
    { code: 'fr', label: 'FR', name: 'Français',          flag: '🇫🇷' },
    { code: 'de', label: 'DE', name: 'Deutsch',           flag: '🇩🇪' },
    { code: 'it', label: 'IT', name: 'Italiano',          flag: '🇮🇹' },
    { code: 'pt', label: 'PT', name: 'Português',         flag: '🇧🇷' },
    { code: 'ru', label: 'RU', name: 'Русский',           flag: '🇷🇺' },
    { code: 'zh', label: 'ZH', name: '中文',              flag: '🇨🇳' },
    { code: 'ja', label: 'JA', name: '日本語',            flag: '🇯🇵' },
    { code: 'ko', label: 'KO', name: '한국어',            flag: '🇰🇷' },
    { code: 'ar', label: 'AR', name: 'العربية',           flag: '🇸🇦' },
    { code: 'hi', label: 'HI', name: 'हिन्दी',            flag: '🇮🇳' },
    { code: 'bn', label: 'BN', name: 'বাংলা',             flag: '🇧🇩' },
    { code: 'tr', label: 'TR', name: 'Türkçe',            flag: '🇹🇷' },
    { code: 'vi', label: 'VI', name: 'Tiếng Việt',        flag: '🇻🇳' },
    { code: 'th', label: 'TH', name: 'ไทย',               flag: '🇹🇭' },
    { code: 'id', label: 'ID', name: 'Bahasa Indonesia',  flag: '🇮🇩' },
    { code: 'ms', label: 'MS', name: 'Bahasa Melayu',     flag: '🇲🇾' },
    { code: 'nl', label: 'NL', name: 'Nederlands',        flag: '🇳🇱' },
    { code: 'pl', label: 'PL', name: 'Polski',            flag: '🇵🇱' },
    { code: 'sv', label: 'SV', name: 'Svenska',           flag: '🇸🇪' },
    { code: 'uk', label: 'UK', name: 'Українська',        flag: '🇺🇦' },
    { code: 'he', label: 'HE', name: 'עברית',             flag: '🇮🇱' },
    { code: 'ur', label: 'UR', name: 'اردو',              flag: '🇵🇰' },
  ];

  var saved = localStorage.getItem('globexLang') || 'en';

  /** Switch language: delegate to i18n engine when available, else fall back. */
  function selectLanguage(code) {
    saved = code;
    localStorage.setItem('globexLang', code);
    // Delegate full translation to i18n engine
    if (window.GlobexSky && window.GlobexSky.i18n && window.GlobexSky.i18n.switchLanguage) {
      window.GlobexSky.i18n.switchLanguage(code);
    } else if (window.i18n && window.i18n.switchLanguage) {
      window.i18n.switchLanguage(code);
    } else {
      document.documentElement.lang = code;
    }
    // Update all mounted switchers to reflect new selection
    init();
  }

  function buildDropdown(rootEl) {
    var current = LANGS.find(function(l){ return l.code === saved; }) || LANGS[0];
    rootEl.innerHTML = '';
    rootEl.style.cssText = 'position:relative;display:inline-block';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-select lang-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.style.cssText = 'cursor:pointer;border:1px solid #ddd;border-radius:6px;padding:6px 10px;background:#fff;font-size:.85rem;font-family:inherit;display:flex;align-items:center;gap:4px';
    btn.innerHTML = (current.flag ? '<span aria-hidden="true">' + current.flag + '</span> ' : '<i class="fas fa-globe" aria-hidden="true"></i> ') +
      '<span class="lang-current-label">' + current.label + '</span> <i class="fas fa-chevron-down" aria-hidden="true" style="font-size:.7rem"></i>';

    var menu = document.createElement('ul');
    menu.role = 'listbox';
    menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);list-style:none;padding:6px 0;min-width:170px;z-index:9999;max-height:320px;overflow-y:auto';

    LANGS.forEach(function(lang) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-lang', lang.code);
      li.setAttribute('data-lang-label', lang.label);
      li.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:.85rem;display:flex;align-items:center;gap:8px;white-space:nowrap';
      if (lang.code === saved) { li.style.fontWeight = '600'; li.style.color = '#0052CC'; }
      li.innerHTML = (lang.flag ? '<span aria-hidden="true">' + lang.flag + '</span>' : '') + ' ' + lang.name;

      li.addEventListener('click', function(e) {
        e.stopPropagation();
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        selectLanguage(lang.code);
      });

      menu.appendChild(li);
    });

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = menu.style.display === 'block';
      // Close all other lang menus
      document.querySelectorAll('.globex-lang-menu').forEach(function(m){ m.style.display = 'none'; });
      menu.style.display = isOpen ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!isOpen));
    });

    menu.className = 'globex-lang-menu';
    rootEl.appendChild(btn);
    rootEl.appendChild(menu);
  }

  document.addEventListener('click', function() {
    document.querySelectorAll('.globex-lang-menu').forEach(function(m){ m.style.display = 'none'; });
    document.querySelectorAll('.lang-btn').forEach(function(b){ b.setAttribute('aria-expanded','false'); });
  });

  function init() {
    ['lang-switcher-root', 'mobile-lang-switcher-root'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) buildDropdown(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
