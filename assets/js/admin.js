/**
 * admin.js – AdminPanel module for GlobexSky admin/dashboard pages.
 * Provides sidebar management, data table features, modal system,
 * form validation, feature toggles, inline pricing editor, and toast notifications.
 */

const AdminPanel = (() => {
  // ─── Sidebar ─────────────────────────────────────────────────────────────

  /**
   * Initialise sidebar: active link detection, collapse/expand toggle, mobile overlay.
   */
  const initSidebar = () => {
    const sidebar = document.querySelector('.admin-sidebar');
    if (!sidebar) return;

    // Highlight the link whose href best matches the current page
    const currentPath = window.location.pathname.split('/').pop();
    sidebar.querySelectorAll('.sidebar-nav a').forEach((link) => {
      const href = link.getAttribute('href')?.split('/').pop();
      if (href && href === currentPath) link.classList.add('active');
    });

    // Toggle button (optional; add <button id="sidebar-toggle"> to topbar for mobile)
    const toggleBtn = document.querySelector('#sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.style.width = isCollapsed ? '0' : '250px';
        sidebar.style.overflow = isCollapsed ? 'hidden' : '';
      });
    }

    // Mobile overlay: close sidebar when clicking outside on small screens
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 640 &&
          !sidebar.contains(e.target) &&
          !toggleBtn?.contains(e.target)) {
        sidebar.style.width = '0';
        sidebar.style.overflow = 'hidden';
      }
    });
  };

  // ─── Data Tables ─────────────────────────────────────────────────────────

  /**
   * Enhance all tables with class .admin-data-table (or .data-table with data-enhance)
   * with sorting, search filtering, and pagination.
   */
  const initDataTables = () => {
    document.querySelectorAll('table[data-enhance], table.admin-data-table').forEach((table) => {
      _enhanceTable(table);
    });
  };

  const _enhanceTable = (table) => {
    const PAGE_SIZE = 10;
    const tbody = table.querySelector('tbody');
    const headers = table.querySelectorAll('thead th');
    if (!tbody || !headers.length) return;

    let rows = Array.from(tbody.querySelectorAll('tr'));
    let sortCol = -1;
    let sortAsc = true;
    let currentPage = 1;

    // Inject search + pagination wrapper above/below table
    const wrapper = document.createElement('div');
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);

    // Search input
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'margin-bottom:12px;display:flex;justify-content:flex-end';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search table…';
    searchInput.style.cssText = 'padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.85rem;width:220px';
    searchWrap.appendChild(searchInput);
    wrapper.insertBefore(searchWrap, table);

    // Pagination footer
    const paginationWrap = document.createElement('div');
    paginationWrap.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.82rem;color:#64748b';
    const infoEl = document.createElement('span');
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px';
    paginationWrap.appendChild(infoEl);
    paginationWrap.appendChild(btnWrap);
    wrapper.appendChild(paginationWrap);

    // Sortable headers
    headers.forEach((th, colIdx) => {
      th.style.cursor = 'pointer';
      th.title = 'Click to sort';
      th.addEventListener('click', () => {
        if (sortCol === colIdx) {
          sortAsc = !sortAsc;
        } else {
          sortCol = colIdx;
          sortAsc = true;
        }
        headers.forEach((h) => { h.dataset.sort = ''; });
        th.dataset.sort = sortAsc ? 'asc' : 'desc';
        renderTable();
      });
    });

    // Filter + render
    let filterText = '';
    searchInput.addEventListener('input', () => {
      filterText = searchInput.value.toLowerCase();
      currentPage = 1;
      renderTable();
    });

    const renderTable = () => {
      // Filter
      let visible = rows.filter((row) =>
        !filterText || row.textContent.toLowerCase().includes(filterText)
      );

      // Sort
      if (sortCol >= 0) {
        visible.sort((a, b) => {
          const aText = a.cells[sortCol]?.textContent.trim() ?? '';
          const bText = b.cells[sortCol]?.textContent.trim() ?? '';
          const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
          const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
          const cmp = !isNaN(aNum) && !isNaN(bNum)
            ? aNum - bNum
            : aText.localeCompare(bText);
          return sortAsc ? cmp : -cmp;
        });
      }

      // Pagination
      const total = visible.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages);
      const start = (currentPage - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, total);

      // Show/hide rows
      rows.forEach((row) => { row.style.display = 'none'; });
      visible.forEach((row, i) => {
        row.style.display = i >= start && i < end ? '' : 'none';
      });

      // Update info
      infoEl.textContent = total === 0
        ? 'No results'
        : `Showing ${start + 1}–${end} of ${total} results`;

      // Pagination buttons
      btnWrap.innerHTML = '';
      if (currentPage > 1) {
        const prev = _mkBtn('← Prev', () => { currentPage--; renderTable(); });
        btnWrap.appendChild(prev);
      }
      if (currentPage < totalPages) {
        const next = _mkBtn('Next →', () => { currentPage++; renderTable(); });
        btnWrap.appendChild(next);
      }
    };

    renderTable();
  };

  const _mkBtn = (label, onClick) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:5px 12px;border:1.5px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;font-size:.82rem';
    btn.addEventListener('click', onClick);
    return btn;
  };

  // ─── Modals ───────────────────────────────────────────────────────────────

  /**
   * Set up modal triggers and close behaviour.
   * Modals must have id="modal-{id}". Triggers use data-modal="{id}".
   */
  const initModals = () => {
    // Open via data-modal attribute
    document.querySelectorAll('[data-modal]').forEach((trigger) => {
      trigger.addEventListener('click', () => openModal(trigger.dataset.modal));
    });

    // Close via data-modal-close or clicking the backdrop
    document.addEventListener('click', (e) => {
      if (e.target.dataset.modalClose) closeModal(e.target.dataset.modalClose);
      if (e.target.classList.contains('modal-backdrop')) {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal.id.replace('modal-', ''));
      }
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach((m) => {
          closeModal(m.id.replace('modal-', ''));
        });
      }
    });
  };

  const openModal = (id) => {
    const modal = document.querySelector(`#modal-${id}`);
    if (!modal) return;
    modal.classList.add('open');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (id) => {
    const modal = document.querySelector(`#modal-${id}`);
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  // ─── Forms ────────────────────────────────────────────────────────────────

  /**
   * Attach validation to all forms with class .admin-form.
   */
  const initForms = () => {
    document.querySelectorAll('form.admin-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        const valid = _validateAdminForm(form);
        if (!valid) e.preventDefault();
      });
    });
  };

  const _validateAdminForm = (form) => {
    let valid = true;

    form.querySelectorAll('[required], [data-validate]').forEach((field) => {
      _clearFormError(field);
      const value = field.value.trim();
      const rule = field.dataset.validate || '';

      // Required check
      if (field.required && !value) {
        _showFormError(field, 'This field is required.');
        valid = false;
        return;
      }

      if (!value) return; // Optional field with no value — skip format checks

      // Email
      if (rule === 'email' || field.type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          _showFormError(field, 'Enter a valid email address.');
          valid = false;
        }
      }

      // Min value
      if (field.min !== '' && !isNaN(parseFloat(value))) {
        if (parseFloat(value) < parseFloat(field.min)) {
          _showFormError(field, `Minimum value is ${field.min}.`);
          valid = false;
        }
      }

      // Max value
      if (field.max !== '' && !isNaN(parseFloat(value))) {
        if (parseFloat(value) > parseFloat(field.max)) {
          _showFormError(field, `Maximum value is ${field.max}.`);
          valid = false;
        }
      }
    });

    return valid;
  };

  const _showFormError = (field, message) => {
    _clearFormError(field);
    field.style.borderColor = '#ef4444';
    const err = document.createElement('span');
    err.className = 'admin-form-error';
    err.style.cssText = 'color:#ef4444;font-size:.78rem;display:block;margin-top:4px';
    err.textContent = message;
    field.parentNode.appendChild(err);
  };

  const _clearFormError = (field) => {
    field.style.borderColor = '';
    field.parentNode.querySelector('.admin-form-error')?.remove();
  };

  // ─── Toggles ──────────────────────────────────────────────────────────────

  /**
   * Persist toggle switch states in localStorage and show toast on change.
   * Toggles must have data-toggle-key="unique_key".
   */
  const initToggles = () => {
    document.querySelectorAll('.toggle-switch input[data-toggle-key]').forEach((toggle) => {
      const key = `gs_toggle_${toggle.dataset.toggleKey}`;

      // Restore saved state
      const saved = localStorage.getItem(key);
      if (saved !== null) toggle.checked = saved === 'true';

      toggle.addEventListener('change', () => {
        localStorage.setItem(key, String(toggle.checked));
        const label = toggle.dataset.toggleLabel || 'Feature';
        showToast(
          `${label} ${toggle.checked ? 'enabled' : 'disabled'}.`,
          toggle.checked ? 'success' : 'info'
        );
      });
    });
  };

  // ─── Inline Pricing Editor ────────────────────────────────────────────────

  /**
   * Enable double-click inline editing on cells in tables with class .editable-table.
   * Enter/click-away = save, Escape = cancel.
   */
  const initPricingEditor = () => {
    document.querySelectorAll('.editable-table td[data-editable]').forEach((cell) => {
      cell.title = 'Double-click to edit';
      cell.addEventListener('dblclick', () => _startCellEdit(cell));
    });
  };

  const _startCellEdit = (cell) => {
    if (cell.querySelector('input')) return; // already editing
    const original = cell.textContent.trim();
    cell.dataset.original = original;

    const input = document.createElement('input');
    input.value = original;
    input.style.cssText = 'width:100%;padding:4px 8px;border:1.5px solid #0052CC;border-radius:6px;font-size:.875rem;font-family:inherit';
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    const save = () => {
      const newVal = input.value.trim() || original;
      cell.textContent = newVal;
      if (newVal !== original) showToast('Value updated.', 'success');
    };

    const cancel = () => { cell.textContent = original; };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', save);
  };

  // ─── Toast Notifications ─────────────────────────────────────────────────

  /**
   * Display a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   */
  const showToast = (message, type = 'info') => {
    let container = document.querySelector('#toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px';
      document.body.appendChild(container);
    }

    const colors = {
      success: { bg: '#d1fae5', border: '#059669', text: '#065f46', icon: 'fas fa-check-circle' },
      error:   { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d', icon: 'fas fa-circle-xmark' },
      warning: { bg: '#ffedd5', border: '#f97316', text: '#7c2d12', icon: 'fas fa-triangle-exclamation' },
      info:    { bg: '#dbeafe', border: '#0052CC', text: '#1e3a5f', icon: 'fas fa-circle-info' },
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
      background:${c.bg};border:1.5px solid ${c.border};color:${c.text};
      padding:12px 16px;border-radius:10px;font-size:.875rem;display:flex;
      align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);
      max-width:320px;animation:gsToastIn .3s ease;
    `;
    toast.innerHTML = `<i class="${c.icon}" style="flex-shrink:0"></i><span>${message}</span>`;
    container.appendChild(toast);

    // Ensure keyframe is injected once
    if (!document.querySelector('#gs-toast-style')) {
      const style = document.createElement('style');
      style.id = 'gs-toast-style';
      style.textContent = `@keyframes gsToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 350);
    }, 3000);
  };

  // ─── Number Formatting ────────────────────────────────────────────────────

  /**
   * Format a large number with comma separators.
   * @param {number} n
   * @returns {string}
   */
  const formatNumber = (n) => Number(n).toLocaleString('en-US');

  // ─── Initialisation ───────────────────────────────────────────────────────

  /**
   * Bootstrap all AdminPanel sub-modules. Called on DOMContentLoaded.
   */
  const init = () => {
    initSidebar();
    initDataTables();
    initModals();
    initForms();
    initToggles();
    initPricingEditor();
  };

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    initSidebar,
    initDataTables,
    initModals,
    openModal,
    closeModal,
    initForms,
    initToggles,
    initPricingEditor,
    showToast,
    formatNumber,
    init,
  };
})();

// Auto-initialise on DOM ready
document.addEventListener('DOMContentLoaded', AdminPanel.init);

// Expose globally
window.AdminPanel = AdminPanel;
