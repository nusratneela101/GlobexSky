/**
 * Globex Sky — components.js
 * Reusable UI components: Modal, Toast (deferred to utils.js),
 * Loader overlay, Pagination, Confirm dialog, and Empty-state renderer.
 *
 * All components are accessible via the global `GlobexComponents` object.
 */

const GlobexComponents = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     MODAL
  ───────────────────────────────────────────── */

  /**
   * Create and open a modal dialog.
   *
   * @param {object} options
   * @param {string}   options.title
   * @param {string}   options.body         - Raw HTML for the modal body
   * @param {string}   [options.size]       - 'sm' | 'md' | 'lg' | 'xl'
   * @param {Array<{label:string, class?:string, onClick:Function}>} [options.buttons]
   * @param {Function} [options.onClose]    - Called when the modal is dismissed
   * @returns {{ close: Function, el: HTMLElement }}
   */
  function openModal(options) {
    options = options || {};

    const sizeMap = { sm: '400px', md: '560px', lg: '720px', xl: '960px' };
    const maxW    = sizeMap[options.size] || sizeMap.md;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'gs-modal-overlay';
    Object.assign(overlay.style, {
      position:       'fixed',
      inset:          '0',
      background:     'rgba(10,14,39,.6)',
      backdropFilter: 'blur(4px)',
      zIndex:         '9998',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '24px 16px',
    });

    // Dialog
    const dialog = document.createElement('div');
    dialog.className = 'gs-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'gs-modal-title');
    Object.assign(dialog.style, {
      background:   '#fff',
      borderRadius: '16px',
      boxShadow:    '0 24px 80px rgba(0,0,0,.25)',
      width:        '100%',
      maxWidth:     maxW,
      maxHeight:    'calc(100vh - 48px)',
      display:      'flex',
      flexDirection:'column',
      overflow:     'hidden',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '20px 24px',
      borderBottom:   '1px solid #e2e8f0',
      flexShrink:     '0',
    });
    header.innerHTML = `
      <h3 id="gs-modal-title" style="margin:0;font-size:1.1rem;font-weight:600;color:#0A0E27;font-family:'Poppins',sans-serif;">
        ${options.title || ''}
      </h3>
      <button class="gs-modal-close" aria-label="Close" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1.25rem;padding:4px;border-radius:6px;transition:color .2s;">
        <i class="fas fa-xmark"></i>
      </button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'gs-modal-body';
    Object.assign(body.style, {
      padding:   '24px',
      overflowY: 'auto',
      flex:      '1',
      fontSize:  '.9rem',
      color:     '#374151',
    });
    body.innerHTML = options.body || '';

    dialog.appendChild(header);
    dialog.appendChild(body);

    // Footer buttons
    if (options.buttons && options.buttons.length > 0) {
      const footer = document.createElement('div');
      Object.assign(footer.style, {
        display:       'flex',
        justifyContent:'flex-end',
        gap:           '10px',
        padding:       '16px 24px',
        borderTop:     '1px solid #e2e8f0',
        flexShrink:    '0',
      });
      options.buttons.forEach(btn => {
        const b = document.createElement('button');
        b.textContent = btn.label || 'OK';
        b.className   = btn.class || 'gs-btn gs-btn-primary';
        Object.assign(b.style, {
          padding:      '10px 20px',
          borderRadius: '8px',
          fontWeight:   '600',
          fontSize:     '.875rem',
          cursor:       'pointer',
          border:       '1.5px solid transparent',
          fontFamily:   'inherit',
        });
        b.addEventListener('click', () => {
          if (btn.onClick) btn.onClick(close);
        });
        footer.appendChild(b);
      });
      dialog.appendChild(footer);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate in
    overlay.style.opacity = '0';
    dialog.style.transform = 'scale(.95)';
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity .2s';
      dialog.style.transition  = 'transform .2s';
      overlay.style.opacity    = '1';
      dialog.style.transform   = 'scale(1)';
    });

    function close() {
      overlay.style.opacity    = '0';
      dialog.style.transform   = 'scale(.95)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.body.style.overflow = '';
        if (options.onClose) options.onClose();
      }, 200);
    }

    // Close triggers
    header.querySelector('.gs-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    return { close, el: dialog, body };
  }

  /* ─────────────────────────────────────────────
     CONFIRM DIALOG
  ───────────────────────────────────────────── */

  /**
   * Show a confirm dialog.  Returns a Promise<boolean>.
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.title]
   * @param {string} [options.confirmLabel]
   * @param {string} [options.cancelLabel]
   * @param {boolean} [options.danger]
   * @returns {Promise<boolean>}
   */
  function confirm(message, options) {
    return new Promise((resolve) => {
      options = options || {};
      const modal = openModal({
        title: options.title || 'Confirm',
        size:  'sm',
        body:  `<p style="margin:0;line-height:1.6;">${message}</p>`,
        buttons: [
          {
            label: options.cancelLabel || 'Cancel',
            class: 'gs-btn-cancel',
            onClick: (close) => { close(); resolve(false); },
          },
          {
            label: options.confirmLabel || 'Confirm',
            class: options.danger ? 'gs-btn-danger' : 'gs-btn-primary',
            onClick: (close) => { close(); resolve(true); },
          },
        ],
        onClose: () => resolve(false),
      });

      // Style the inline buttons
      const btns = modal.el.querySelectorAll('button:not(.gs-modal-close)');
      if (btns[0]) Object.assign(btns[0].style, { background: '#f1f5f9', color: '#374151', borderColor: '#e2e8f0' });
      if (btns[1]) Object.assign(btns[1].style, {
        background:  options.danger ? '#dc2626' : '#0052CC',
        color:       '#fff',
        borderColor: options.danger ? '#dc2626' : '#0052CC',
      });
    });
  }

  /* ─────────────────────────────────────────────
     FULL-PAGE LOADER OVERLAY
  ───────────────────────────────────────────── */

  let _loaderEl = null;

  /**
   * Show a full-page loading overlay.
   * @param {string} [message]
   */
  function showLoader(message) {
    if (_loaderEl) return;
    _loaderEl = document.createElement('div');
    _loaderEl.id = 'gs-loader-overlay';
    Object.assign(_loaderEl.style, {
      position:       'fixed',
      inset:          '0',
      background:     'rgba(255,255,255,.85)',
      backdropFilter: 'blur(4px)',
      zIndex:         '99997',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '16px',
      fontFamily:     'Inter, sans-serif',
    });
    _loaderEl.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid #e2e8f0;border-top-color:#0052CC;border-radius:50%;animation:gs-spin .7s linear infinite;"></div>
      <p style="margin:0;color:#374151;font-size:.9rem;font-weight:500;">${message || 'Loading…'}</p>
    `;
    // Inject animation if not already present
    if (!document.getElementById('gs-loader-style')) {
      const style = document.createElement('style');
      style.id = 'gs-loader-style';
      style.textContent = '@keyframes gs-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(_loaderEl);
    document.body.style.overflow = 'hidden';
  }

  /** Hide the full-page loading overlay. */
  function hideLoader() {
    if (_loaderEl) {
      if (_loaderEl.parentNode) _loaderEl.parentNode.removeChild(_loaderEl);
      _loaderEl = null;
    }
    document.body.style.overflow = '';
  }

  /* ─────────────────────────────────────────────
     PAGINATION
  ───────────────────────────────────────────── */

  /**
   * Render pagination controls into `container`.
   *
   * @param {HTMLElement} container - Where to render
   * @param {object} options
   * @param {number} options.currentPage  - 1-based
   * @param {number} options.totalPages
   * @param {Function} options.onPage     - Called with the new page number
   * @param {number} [options.windowSize] - Pages to show around current (default: 2)
   */
  function renderPagination(container, options) {
    if (!container) return;
    container.innerHTML = '';

    const { currentPage, totalPages, onPage } = options;
    const windowSize = options.windowSize || 2;

    if (totalPages <= 1) return;

    const ul = document.createElement('ul');
    Object.assign(ul.style, {
      listStyle:  'none',
      display:    'flex',
      alignItems: 'center',
      gap:        '4px',
      padding:    '0',
      margin:     '0',
    });

    function makeBtn(label, page, disabled, active) {
      const li  = document.createElement('li');
      const btn = document.createElement('button');
      btn.innerHTML = label;
      btn.disabled  = !!disabled;
      Object.assign(btn.style, {
        minWidth:     '36px',
        height:       '36px',
        padding:      '0 10px',
        borderRadius: '8px',
        border:       active ? 'none' : '1.5px solid #e2e8f0',
        background:   active ? '#0052CC' : (disabled ? '#f8fafc' : '#fff'),
        color:        active ? '#fff' : (disabled ? '#cbd5e1' : '#374151'),
        fontWeight:   active ? '600' : '500',
        fontSize:     '.85rem',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        fontFamily:   'inherit',
        transition:   'all .15s',
      });
      if (!disabled && !active) {
        btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#0052CC'; btn.style.color = '#0052CC'; });
        btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#e2e8f0'; btn.style.color = '#374151'; });
      }
      if (!disabled && page !== null) {
        btn.addEventListener('click', () => onPage(page));
      }
      li.appendChild(btn);
      return li;
    }

    function makeDots() {
      const li = document.createElement('li');
      li.innerHTML = '<span style="padding:0 6px;color:#94a3b8;">…</span>';
      return li;
    }

    // Prev
    ul.appendChild(makeBtn('<i class="fas fa-chevron-left"></i>', currentPage - 1, currentPage === 1, false));

    // Page numbers
    const pages = [];
    pages.push(1);
    for (let p = currentPage - windowSize; p <= currentPage + windowSize; p++) {
      if (p > 1 && p < totalPages) pages.push(p);
    }
    pages.push(totalPages);

    const unique = [...new Set(pages)].sort((a, b) => a - b);
    unique.forEach((p, i) => {
      if (i > 0 && p - unique[i - 1] > 1) ul.appendChild(makeDots());
      ul.appendChild(makeBtn(String(p), p, false, p === currentPage));
    });

    // Next
    ul.appendChild(makeBtn('<i class="fas fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages, false));

    container.appendChild(ul);
  }

  /* ─────────────────────────────────────────────
     EMPTY STATE
  ───────────────────────────────────────────── */

  /**
   * Render an "empty state" placeholder inside `container`.
   *
   * @param {HTMLElement} container
   * @param {object} [options]
   * @param {string} [options.icon]       - FontAwesome class, e.g. 'fa-inbox'
   * @param {string} [options.title]
   * @param {string} [options.message]
   * @param {string} [options.actionLabel]
   * @param {Function} [options.onAction]
   */
  function renderEmptyState(container, options) {
    if (!container) return;
    options = options || {};
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;text-align:center;gap:12px;font-family:Inter,sans-serif;">
        <div style="width:72px;height:72px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:4px;">
          <i class="fas ${options.icon || 'fa-inbox'}" style="font-size:1.75rem;color:#94a3b8;"></i>
        </div>
        <h4 style="margin:0;font-size:1rem;font-weight:600;color:#1e293b;font-family:'Poppins',sans-serif;">${options.title || 'No data yet'}</h4>
        ${options.message ? `<p style="margin:0;font-size:.875rem;color:#64748b;max-width:320px;">${options.message}</p>` : ''}
        ${options.actionLabel ? `<button class="gs-empty-action" style="margin-top:8px;padding:10px 20px;background:#0052CC;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:.875rem;cursor:pointer;font-family:inherit;">${options.actionLabel}</button>` : ''}
      </div>
    `;
    if (options.actionLabel && options.onAction) {
      container.querySelector('.gs-empty-action').addEventListener('click', options.onAction);
    }
  }

  /* ─────────────────────────────────────────────
     INLINE SKELETON LOADER
  ───────────────────────────────────────────── */

  /** Inject CSS for skeleton animation (once). */
  function _ensureSkeletonCss() {
    if (document.getElementById('gs-skeleton-style')) return;
    const style = document.createElement('style');
    style.id = 'gs-skeleton-style';
    style.textContent = `
      @keyframes gs-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      .gs-skeleton{
        background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
        background-size:800px 100%;
        animation:gs-shimmer 1.4s infinite;
        border-radius:6px;
        display:inline-block;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create a skeleton placeholder element.
   * @param {object} [options]
   * @param {string} [options.width='100%']
   * @param {string} [options.height='16px']
   * @param {string} [options.borderRadius]
   * @returns {HTMLElement}
   */
  function createSkeleton(options) {
    _ensureSkeletonCss();
    options = options || {};
    const el = document.createElement('span');
    el.className = 'gs-skeleton';
    el.style.width        = options.width        || '100%';
    el.style.height       = options.height       || '16px';
    el.style.borderRadius = options.borderRadius || '6px';
    return el;
  }

  /* ─────────────────────────────────────────────
     TABLE BUILDER
  ───────────────────────────────────────────── */

  /**
   * Build a simple responsive data table.
   *
   * @param {object[]} columns - { key, label, render? }
   * @param {object[]} rows    - data objects
   * @param {object}   [options]
   * @param {boolean}  [options.striped]
   * @returns {HTMLTableElement}
   */
  function buildTable(columns, rows, options) {
    options = options || {};
    const table = document.createElement('table');
    Object.assign(table.style, {
      width:          '100%',
      borderCollapse: 'collapse',
      fontFamily:     'Inter, sans-serif',
      fontSize:       '.875rem',
    });

    // Head
    const thead = document.createElement('thead');
    const hRow  = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label || col.key;
      Object.assign(th.style, {
        textAlign:   'left',
        padding:     '10px 14px',
        background:  '#f8fafc',
        color:       '#64748b',
        fontWeight:  '600',
        fontSize:    '.8rem',
        textTransform: 'uppercase',
        letterSpacing: '.04em',
        borderBottom: '1px solid #e2e8f0',
        whiteSpace:  'nowrap',
      });
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (!rows || rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const td       = document.createElement('td');
      td.colSpan = columns.length;
      td.textContent = 'No records found.';
      Object.assign(td.style, {
        textAlign: 'center',
        padding:   '40px',
        color:     '#94a3b8',
      });
      emptyRow.appendChild(td);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        if (options.striped && i % 2 === 1) tr.style.background = '#f8fafc';
        tr.addEventListener('mouseenter', () => { tr.style.background = '#eff6ff'; });
        tr.addEventListener('mouseleave', () => { tr.style.background = (options.striped && i % 2 === 1) ? '#f8fafc' : ''; });

        columns.forEach(col => {
          const td = document.createElement('td');
          td.style.padding     = '12px 14px';
          td.style.borderBottom = '1px solid #f1f5f9';
          td.style.color       = '#1e293b';
          if (col.render) {
            const content = col.render(row[col.key], row);
            if (content instanceof HTMLElement) {
              td.appendChild(content);
            } else {
              td.innerHTML = content !== null && content !== undefined ? String(content) : '—';
            }
          } else {
            td.textContent = row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '—';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    return table;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    openModal,
    confirm,
    showLoader,
    hideLoader,
    renderPagination,
    renderEmptyState,
    createSkeleton,
    buildTable,
  };
})();

window.GlobexComponents = GlobexComponents;
