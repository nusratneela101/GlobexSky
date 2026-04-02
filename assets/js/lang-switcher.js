/**
 * Globex Sky - Minimal Language Switcher
 * Renders language dropdown into #lang-switcher-root and #mobile-lang-switcher-root
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'ar', label: 'AR', name: 'العربية' },
    { code: 'zh', label: 'ZH', name: '中文' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
  ];

  var saved = localStorage.getItem('globexLang') || 'en';

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
    btn.innerHTML = '<i class="fas fa-globe" aria-hidden="true"></i> <span class="lang-current-label">' + current.label + '</span> <i class="fas fa-chevron-down" aria-hidden="true" style="font-size:.7rem"></i>';

    var menu = document.createElement('ul');
    menu.role = 'listbox';
    menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);list-style:none;padding:6px 0;min-width:140px;z-index:9999';

    LANGS.forEach(function(lang) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-lang', lang.code);
      li.setAttribute('data-lang-label', lang.label);
      li.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:.85rem;display:flex;align-items:center;gap:8px;white-space:nowrap';
      if (lang.code === saved) { li.style.fontWeight = '600'; li.style.color = '#0052CC'; }
      li.textContent = lang.name + ' (' + lang.label + ')';

      li.addEventListener('click', function() {
        saved = lang.code;
        localStorage.setItem('globexLang', lang.code);
        document.documentElement.lang = lang.code;
        // Update all lang dropdowns
        document.querySelectorAll('.lang-current-label').forEach(function(el){ el.textContent = lang.label; });
        document.querySelectorAll('[data-lang]').forEach(function(el){
          el.style.fontWeight = el.getAttribute('data-lang') === lang.code ? '600' : '';
          el.style.color = el.getAttribute('data-lang') === lang.code ? '#0052CC' : '';
        });
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        // Emit for i18n modules
        if (window.GlobexSky && window.GlobexSky.emit) window.GlobexSky.emit('lang:changed', lang.code);
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
