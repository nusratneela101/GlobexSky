/**
 * custom-code-loader.js
 * Loads and injects custom CSS/JS from the backend or localStorage
 * Include this script on all frontend pages to apply admin-defined custom styles
 */
(function() {
  'use strict';

  const API_BASE = '/api/v1/custom-styles';
  const LS_CODE_KEY = 'globexsky_custom_code';
  const LS_ENABLED_KEY = 'globexsky_custom_code_enabled';

  /**
   * Load custom styles from API
   */
  async function loadFromAPI() {
    try {
      const response = await fetch(`${API_BASE}/active`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (err) {
      console.warn('Failed to load custom styles from API:', err);
      return null;
    }
  }

  /**
   * Load custom styles from localStorage (fallback)
   */
  function loadFromLocalStorage() {
    try {
      const enabled = localStorage.getItem(LS_ENABLED_KEY);
      if (enabled === 'false') return null;
      
      const code = JSON.parse(localStorage.getItem(LS_CODE_KEY) || '{}');
      return {
        css: code.css || '',
        js: code.js || ''
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Inject CSS into the page
   */
  function injectCSS(css) {
    if (!css || !css.trim()) return;
    
    const style = document.createElement('style');
    style.id = 'globexsky-custom-css';
    style.type = 'text/css';
    style.textContent = css;
    
    // Remove existing custom CSS if present
    const existing = document.getElementById('globexsky-custom-css');
    if (existing) existing.remove();
    
    document.head.appendChild(style);
  }

  /**
   * Inject JS into the page
   */
  function injectJS(js) {
    if (!js || !js.trim()) return;
    
    try {
      // Remove existing custom JS if present
      const existing = document.getElementById('globexsky-custom-js');
      if (existing) existing.remove();
      
      const script = document.createElement('script');
      script.id = 'globexsky-custom-js';
      script.type = 'text/javascript';
      script.textContent = `
        try {
          ${js}
        } catch (e) {
          console.error('GlobexSky Custom JS Error:', e);
        }
      `;
      document.body.appendChild(script);
    } catch (err) {
      console.error('Failed to inject custom JS:', err);
    }
  }

  /**
   * Main initialization
   */
  async function init() {
    // Try API first, fall back to localStorage
    let styles = await loadFromAPI();
    
    if (!styles) {
      styles = loadFromLocalStorage();
    }
    
    if (styles) {
      injectCSS(styles.css);
      injectJS(styles.js);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual refresh if needed
  window.GlobexSkyCustomLoader = {
    reload: init
  };
})();
