/**
 * custom-code-admin.js
 * Custom CSS/JS Admin Panel – JavaScript module
 */
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  const LS_CODE_KEY     = 'globexsky_custom_code';
  const LS_HISTORY_KEY  = 'globexsky_custom_code_history';
  const LS_ENABLED_KEY  = 'globexsky_custom_code_enabled';
  const MAX_HISTORY     = 20;
  const API_BASE        = '/api/v1/admin/custom-styles';

  /* ── API Helper Functions ────────────────────────────────────── */
  async function apiRequest(endpoint, options = {}) {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (err) {
      console.warn('API request failed, falling back to localStorage:', err.message);
      return null;
    }
  }

  async function saveToAPI(css, js, isActive) {
    try {
      // Try to get existing style first
      const listResult = await apiRequest('/');
      
      if (listResult && listResult.data && listResult.data.length > 0) {
        // Update existing style
        const styleId = listResult.data[0].id;
        return await apiRequest(`/${styleId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: 'Admin Custom Code',
            css_content: css,
            js_content: js,
            is_active: isActive
          })
        });
      } else {
        // Create new style
        return await apiRequest('/', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Admin Custom Code',
            css_content: css,
            js_content: js,
            is_active: isActive,
            applied_pages: 'all'
          })
        });
      }
    } catch (err) {
      console.warn('Failed to save to API:', err);
      return null;
    }
  }

  async function loadFromAPI() {
    try {
      const result = await apiRequest('/');
      if (result && result.data && result.data.length > 0) {
        const style = result.data[0];
        return {
          css: style.css_content || '',
          js: style.js_content || '',
          is_active: style.is_active
        };
      }
      return null;
    } catch (err) {
      console.warn('Failed to load from API:', err);
      return null;
    }
  }

  /* ── Default snippet library ────────────────────────────────── */
  const DEFAULT_SNIPPETS = [
    {
      id: 'hide-header',
      name: 'Hide Header on Scroll',
      desc: 'Hides the site header when user scrolls down.',
      type: 'both',
      css: `/* Hide header on scroll */
.site-header {
  transition: transform 0.3s ease;
}
.site-header.hidden {
  transform: translateY(-100%);
}`,
      js: `// Hide header on scroll
(function() {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var lastY = 0;
  window.addEventListener('scroll', function() {
    var y = window.scrollY;
    if (y > lastY && y > 80) {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
    }
    lastY = y;
  });
})();`
    },
    {
      id: 'custom-btn-color',
      name: 'Custom Button Colors',
      desc: 'Override primary button color scheme.',
      type: 'css',
      css: `/* Custom button color override */
.btn-primary,
button[type="submit"],
.cta-button {
  background: #e63946 !important;
  border-color: #e63946 !important;
  color: #fff !important;
}
.btn-primary:hover,
button[type="submit"]:hover,
.cta-button:hover {
  background: #c1121f !important;
  border-color: #c1121f !important;
}`,
      js: ''
    },
    {
      id: 'back-to-top',
      name: 'Back-to-Top Button',
      desc: 'Floating button that scrolls page to top.',
      type: 'both',
      css: `/* Back-to-top button */
#gs-back-top {
  position: fixed;
  bottom: 32px;
  right: 28px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #0052CC;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  box-shadow: 0 4px 14px rgba(0,82,204,.35);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity .2s;
}
#gs-back-top.visible { display: flex; }`,
      js: `// Back-to-top button
(function() {
  var btn = document.createElement('button');
  btn.id = 'gs-back-top';
  btn.innerHTML = '&#8679;';
  btn.title = 'Back to top';
  document.body.appendChild(btn);
  window.addEventListener('scroll', function() {
    btn.classList.toggle('visible', window.scrollY > 300);
  });
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();`
    },
    {
      id: 'dark-mode',
      name: 'Dark Mode Toggle',
      desc: 'Adds a dark-mode class toggle to the body.',
      type: 'both',
      css: `/* Dark mode variables */
body.dark-mode {
  background: #0f172a;
  color: #e2e8f0;
}
body.dark-mode a { color: #93c5fd; }
body.dark-mode .card,
body.dark-mode .admin-card {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #334155;
}`,
      js: `// Dark mode toggle
(function() {
  var saved = localStorage.getItem('gs_dark_mode');
  if (saved === 'true') document.body.classList.add('dark-mode');
  var btn = document.createElement('button');
  btn.id = 'gs-dark-toggle';
  btn.title = 'Toggle dark mode';
  btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:9998;background:#1e293b;color:#e2e8f0;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.8rem';
  btn.textContent = '🌙 Dark';
  document.body.appendChild(btn);
  btn.addEventListener('click', function() {
    var on = document.body.classList.toggle('dark-mode');
    localStorage.setItem('gs_dark_mode', on);
    btn.textContent = on ? '☀️ Light' : '🌙 Dark';
  });
})();`
    },
    {
      id: 'sticky-cta',
      name: 'Sticky CTA Banner',
      desc: 'Shows a sticky call-to-action at the bottom.',
      type: 'both',
      css: `/* Sticky CTA Banner */
#gs-sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #0052CC;
  color: #fff;
  text-align: center;
  padding: 12px 20px;
  font-size: .9rem;
  font-weight: 600;
  z-index: 9990;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
#gs-sticky-cta a {
  color: #bfdbfe;
  text-decoration: underline;
}
#gs-sticky-cta-close {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 4px;
}`,
      js: `// Sticky CTA Banner
(function() {
  if (sessionStorage.getItem('gs_cta_closed')) return;
  var bar = document.createElement('div');
  bar.id = 'gs-sticky-cta';
  bar.innerHTML = '🚀 Free shipping on orders over $500! <a href="/pages/products.html">Shop now</a>' +
    '<button id="gs-sticky-cta-close" aria-label="Close">&times;</button>';
  document.body.appendChild(bar);
  document.getElementById('gs-sticky-cta-close').addEventListener('click', function() {
    bar.remove();
    sessionStorage.setItem('gs_cta_closed', '1');
  });
})();`
    },
    {
      id: 'custom-font',
      name: 'Custom Font Override',
      desc: 'Apply a custom Google Font across the site.',
      type: 'css',
      css: `/* Custom font override – requires Google Fonts link in head */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap');

body, input, button, select, textarea {
  font-family: 'Nunito', sans-serif !important;
}`,
      js: ''
    }
  ];

  /* ── State ──────────────────────────────────────────────────── */
  let cssEditor = null;
  let jsEditor  = null;
  let previewDebounce = null;
  let currentSnippetId = null;

  /* ── Init ───────────────────────────────────────────────────── */
  async function init() {
    initEditors();
    await loadSavedCode();
    renderSnippetLibrary();
    renderVersionHistory();
    updateStatusBar();
    bindEvents();
    schedulePreviewUpdate();
  }

  /* ── CodeMirror Editors ─────────────────────────────────────── */
  function initEditors() {
    var cssEl = document.getElementById('css-editor-textarea');
    var jsEl  = document.getElementById('js-editor-textarea');
    if (!cssEl || !jsEl) return;

    if (window.CodeMirror) {
      cssEditor = CodeMirror.fromTextArea(cssEl, {
        mode: 'css',
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: false,
        extraKeys: { 'Ctrl-Space': 'autocomplete' }
      });
      jsEditor = CodeMirror.fromTextArea(jsEl, {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: false,
        extraKeys: { 'Ctrl-Space': 'autocomplete' }
      });

      cssEditor.on('change', onEditorChange);
      jsEditor.on('change',  onEditorChange);

      // Make editors fill their containers
      cssEditor.setSize('100%', '100%');
      jsEditor.setSize('100%', '100%');
    }
  }

  function onEditorChange() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(function () {
      schedulePreviewUpdate();
      validateCode();
      updateStatusBar();
    }, 600);
  }

  /* ── Load / Save ────────────────────────────────────────────── */
  function getSavedCode() {
    try {
      return JSON.parse(localStorage.getItem(LS_CODE_KEY)) || { css: '', js: '' };
    } catch (e) { return { css: '', js: '' }; }
  }

  async function loadSavedCode() {
    // Try to load from API first
    var apiData = await loadFromAPI();
    var code;
    
    if (apiData) {
      code = { css: apiData.css, js: apiData.js };
      // Sync to localStorage
      localStorage.setItem(LS_CODE_KEY, JSON.stringify(code));
      localStorage.setItem(LS_ENABLED_KEY, apiData.is_active ? 'true' : 'false');
    } else {
      // Fall back to localStorage
      code = getSavedCode();
    }
    
    setEditorValue(cssEditor, 'css-editor-textarea', code.css || '');
    setEditorValue(jsEditor,  'js-editor-textarea',  code.js  || '');
    var enabledToggle = document.getElementById('code-enabled-toggle');
    if (enabledToggle) {
      enabledToggle.checked = localStorage.getItem(LS_ENABLED_KEY) !== 'false';
    }
  }

  function setEditorValue(editor, textareaId, value) {
    if (editor) {
      editor.setValue(value);
    } else {
      var el = document.getElementById(textareaId);
      if (el) el.value = value;
    }
  }

  function getEditorValue(editor, textareaId) {
    if (editor) return editor.getValue();
    var el = document.getElementById(textareaId);
    return el ? el.value : '';
  }

  async function saveCode(label) {
    var css = getEditorValue(cssEditor, 'css-editor-textarea');
    var js  = getEditorValue(jsEditor,  'js-editor-textarea');
    var code = { css: css, js: js };
    var enabled = document.getElementById('code-enabled-toggle');
    var isEnabled = !enabled || enabled.checked;
    
    // Save to localStorage
    localStorage.setItem(LS_CODE_KEY, JSON.stringify(code));

    // Save to version history (localStorage)
    var history = getHistory();
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleString(),
      label: label || 'Saved',
      css: css,
      js: js
    });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));

    // Save to API
    var apiResult = await saveToAPI(css, js, isEnabled);
    
    renderVersionHistory();
    if (apiResult) {
      showToast('Code saved to server successfully!', 'success');
    } else {
      showToast('Code saved locally (API unavailable)', 'warning');
    }
    updateStatusBar();
  }

  function exportCode() {
    var css = getEditorValue(cssEditor, 'css-editor-textarea');
    var js  = getEditorValue(jsEditor,  'js-editor-textarea');
    var payload = { css: css, js: js, exported: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'globexsky-custom-code.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCode(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (data && (data.css !== undefined || data.js !== undefined)) {
          setEditorValue(cssEditor, 'css-editor-textarea', data.css || '');
          setEditorValue(jsEditor,  'js-editor-textarea',  data.js  || '');
          schedulePreviewUpdate();
          showToast('Code imported successfully!', 'success');
        } else {
          showToast('Invalid import file format.', 'error');
        }
      } catch (err) {
        showToast('Failed to parse import file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ── Version History ────────────────────────────────────────── */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(LS_HISTORY_KEY)) || [];
    } catch (e) { return []; }
  }

  function renderVersionHistory() {
    var list = document.getElementById('version-list');
    if (!list) return;
    var history = getHistory();
    if (!history.length) {
      list.innerHTML = '<div style="padding:12px;font-size:.8rem;color:#94a3b8;text-align:center">No saved versions yet</div>';
      return;
    }
    list.innerHTML = history.map(function (v, i) {
      return '<div class="version-item' + (i === 0 ? ' current' : '') + '" onclick="CustomCodeAdmin.restoreVersion(' + v.id + ')" title="Restore this version">' +
        '<span class="version-num">v' + (history.length - i) + '</span>' +
        '<div class="version-meta"><div class="version-label">' + escHtml(v.label) + '</div>' +
        '<div class="version-date">' + escHtml(v.date) + '</div></div>' +
        '<button class="btn btn-sm btn-danger btn-icon" onclick="event.stopPropagation();CustomCodeAdmin.deleteVersion(' + v.id + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div>';
    }).join('');
  }

  function restoreVersion(id) {
    var history = getHistory();
    var version = history.find(function (v) { return v.id === id; });
    if (!version) return;
    setEditorValue(cssEditor, 'css-editor-textarea', version.css || '');
    setEditorValue(jsEditor,  'js-editor-textarea',  version.js  || '');
    schedulePreviewUpdate();
    showToast('Version restored!', 'success');
  }

  function deleteVersion(id) {
    var history = getHistory().filter(function (v) { return v.id !== id; });
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
    renderVersionHistory();
  }

  /* ── Live Preview ───────────────────────────────────────────── */
  function schedulePreviewUpdate() {
    var iframe = document.getElementById('preview-iframe');
    if (!iframe) return;
    var css = getEditorValue(cssEditor, 'css-editor-textarea');
    var js  = getEditorValue(jsEditor,  'js-editor-textarea');
    var enabled = document.getElementById('code-enabled-toggle');
    var isEnabled = !enabled || enabled.checked;
    var html = buildPreviewHtml(isEnabled ? css : '', isEnabled ? js : '');
    iframe.srcdoc = html;
  }

  function buildPreviewHtml(css, js) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<style>body{font-family:Inter,sans-serif;padding:16px;background:#f8faff;color:#1a1a2e}' +
      'h2{margin-bottom:8px}.sample-btn{padding:8px 18px;background:#0052CC;color:#fff;border:none;' +
      'border-radius:6px;cursor:pointer;font-size:.9rem;margin:4px}.card{background:#fff;' +
      'border-radius:10px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:12px}' +
      'a{color:#0052CC}</style>' +
      '<style id="custom-css">' + (css || '') + '</style>' +
      '</head><body>' +
      '<div class="card"><h2>Preview – GlobexSky</h2>' +
      '<p>This panel shows how your custom CSS/JS looks on the site.</p>' +
      '<button class="sample-btn btn-primary">Primary Button</button>' +
      '<button class="sample-btn" style="background:#e2e8f0;color:#374151">Secondary Button</button>' +
      '</div>' +
      '<div class="card site-header"><strong>site-header</strong> – scroll-hide test area</div>' +
      '<div class="card"><a href="#">Sample link</a> · <a href="#">Another link</a></div>' +
      '<script>' +
        'try{' + (js || '') + '}catch(e){' +
        'document.body.insertAdjacentHTML("beforeend","<div style=\'padding:8px;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:.78rem;margin-top:8px\'><strong>JS Error:</strong> "+e.message+"</div>")' +
        '}' +
      '<\/script>' +
      '</body></html>';
  }

  /* ── Code Validation ────────────────────────────────────────── */
  function validateCode() {
    var cssVal = getEditorValue(cssEditor, 'css-editor-textarea');
    var jsVal  = getEditorValue(jsEditor,  'js-editor-textarea');
    var warnings = [];
    var errors   = [];

    // Basic CSS checks
    var openBraces  = (cssVal.match(/\{/g) || []).length;
    var closeBraces = (cssVal.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('CSS: Mismatched braces (' + openBraces + ' open, ' + closeBraces + ' close).');
    }
    if (/!important/.test(cssVal)) {
      warnings.push('CSS: Avoid excessive use of <code>!important</code>.');
    }
    if (/document\.write\s*\(/i.test(jsVal)) {
      warnings.push('JS: Avoid <code>document.write()</code> – it can break page rendering.');
    }
    if (/eval\s*\(/i.test(jsVal)) {
      warnings.push('JS: Avoid <code>eval()</code> – it is a security risk.');
    }
    if (jsVal && !/^\s*\/\*/.test(jsVal) && !/^\s*\/\//.test(jsVal) && !/^\s*\(function/.test(jsVal) && jsVal.length > 20) {
      warnings.push('JS: Wrap code in an IIFE <code>(function(){...})()</code> to avoid polluting the global scope.');
    }

    // Basic JS syntax check via Function constructor
    if (jsVal.trim()) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(jsVal);
      } catch (e) {
        errors.push('JS syntax error: ' + escHtml(e.message));
      }
    }

    var banner = document.getElementById('validation-banner');
    if (!banner) return;

    if (!errors.length && !warnings.length) {
      banner.className = 'validation-banner success';
      banner.innerHTML = '<i class="fas fa-check-circle"></i> <span>No issues detected.</span>';
    } else if (errors.length) {
      banner.className = 'validation-banner error';
      banner.innerHTML = '<i class="fas fa-times-circle"></i><div><strong>Errors found:</strong>' +
        '<ul class="validation-list">' + errors.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' +
        (warnings.length ? '<strong>Warnings:</strong><ul class="validation-list">' + warnings.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
    } else {
      banner.className = 'validation-banner warning';
      banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i><div><strong>Warnings:</strong>' +
        '<ul class="validation-list">' + warnings.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul></div>';
    }
  }

  /* ── Snippet Library ────────────────────────────────────────── */
  function renderSnippetLibrary() {
    var list = document.getElementById('snippet-list');
    if (!list) return;
    list.innerHTML = DEFAULT_SNIPPETS.map(function (s) {
      return '<div class="snippet-item" data-id="' + s.id + '" onclick="CustomCodeAdmin.applySnippet(\'' + s.id + '\')">' +
        '<div class="snippet-item-name">' + escHtml(s.name) + '</div>' +
        '<div class="snippet-item-desc">' + escHtml(s.desc) + '</div>' +
        '<span class="snippet-item-type snippet-type-' + s.type + '">' + s.type.toUpperCase() + '</span>' +
        '</div>';
    }).join('');
  }

  function applySnippet(id) {
    var snippet = DEFAULT_SNIPPETS.find(function (s) { return s.id === id; });
    if (!snippet) return;

    // Highlight selected
    document.querySelectorAll('.snippet-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.id === id);
    });
    currentSnippetId = id;

    // Append snippet code (don't overwrite existing)
    var existingCss = getEditorValue(cssEditor, 'css-editor-textarea');
    var existingJs  = getEditorValue(jsEditor,  'js-editor-textarea');
    var newCss = (existingCss.trim() ? existingCss + '\n\n' : '') + (snippet.css || '');
    var newJs  = (existingJs.trim()  ? existingJs  + '\n\n' : '') + (snippet.js  || '');
    setEditorValue(cssEditor, 'css-editor-textarea', newCss);
    setEditorValue(jsEditor,  'js-editor-textarea',  newJs);
    schedulePreviewUpdate();
    showToast('Snippet "' + snippet.name + '" applied!', 'success');
  }

  /* ── Enable / Disable toggle ────────────────────────────────── */
  async function onToggleEnabled(checked) {
    localStorage.setItem(LS_ENABLED_KEY, checked ? 'true' : 'false');
    
    // Update API as well
    var css = getEditorValue(cssEditor, 'css-editor-textarea');
    var js  = getEditorValue(jsEditor,  'js-editor-textarea');
    await saveToAPI(css, js, checked);
    
    schedulePreviewUpdate();
    updateStatusBar();
    showToast(checked ? 'Custom code enabled.' : 'Custom code disabled.', checked ? 'success' : 'warning');
  }

  /* ── Status Bar ─────────────────────────────────────────────── */
  function updateStatusBar() {
    var sb = document.getElementById('status-bar');
    if (!sb) return;
    var enabled = document.getElementById('code-enabled-toggle');
    var isEnabled = !enabled || enabled.checked;
    var css = getEditorValue(cssEditor, 'css-editor-textarea');
    var js  = getEditorValue(jsEditor,  'js-editor-textarea');
    var history = getHistory();
    sb.innerHTML =
      '<span><span class="status-dot ' + (isEnabled ? 'on' : 'off') + '"></span> ' +
        (isEnabled ? 'Enabled' : 'Disabled') + '</span>' +
      '<span>CSS: ' + css.split('\n').length + ' lines</span>' +
      '<span>JS: '  + js.split('\n').length  + ' lines</span>' +
      '<span>Versions saved: ' + history.length + '</span>';
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showToast(msg, type) {
    var toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast-notification toast-' + (type || 'info') + ' show';
    setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  /* ── Bind UI events ─────────────────────────────────────────── */
  function bindEvents() {
    var saveBtn = document.getElementById('save-code-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var label = prompt('Version label (optional):', 'Manual save');
      saveCode(label || 'Manual save');
    });

    var exportBtn = document.getElementById('export-code-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportCode);

    var importInput = document.getElementById('import-code-input');
    if (importInput) importInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) importCode(file);
      importInput.value = '';
    });

    var importBtn = document.getElementById('import-code-btn');
    if (importBtn) importBtn.addEventListener('click', function () {
      var importInput2 = document.getElementById('import-code-input');
      if (importInput2) importInput2.click();
    });

    var clearCssBtn = document.getElementById('clear-css-btn');
    if (clearCssBtn) clearCssBtn.addEventListener('click', function () {
      if (confirm('Clear all custom CSS?')) {
        setEditorValue(cssEditor, 'css-editor-textarea', '');
        schedulePreviewUpdate();
      }
    });

    var clearJsBtn = document.getElementById('clear-js-btn');
    if (clearJsBtn) clearJsBtn.addEventListener('click', function () {
      if (confirm('Clear all custom JS?')) {
        setEditorValue(jsEditor, 'js-editor-textarea', '');
        schedulePreviewUpdate();
      }
    });

    var enabledToggle = document.getElementById('code-enabled-toggle');
    if (enabledToggle) enabledToggle.addEventListener('change', function () {
      onToggleEnabled(this.checked);
    });

    var validateBtn = document.getElementById('validate-btn');
    if (validateBtn) validateBtn.addEventListener('click', validateCode);

    var refreshPreviewBtn = document.getElementById('refresh-preview-btn');
    if (refreshPreviewBtn) refreshPreviewBtn.addEventListener('click', schedulePreviewUpdate);
  }

  /* ── Public API ─────────────────────────────────────────────── */
  window.CustomCodeAdmin = {
    init:           init,
    saveCode:       saveCode,
    exportCode:     exportCode,
    applySnippet:   applySnippet,
    restoreVersion: restoreVersion,
    deleteVersion:  deleteVersion,
    validateCode:   validateCode,
    refreshPreview: schedulePreviewUpdate
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
