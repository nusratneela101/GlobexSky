/**
 * cod-management.js — Admin COD Management Dashboard
 *
 * Handles:
 *  - Real-time COD order status updates
 *  - Chart rendering for COD analytics (vanilla Canvas via Chart.js CDN)
 *  - Filter, sort, and search COD orders
 *  - Bulk operations handler
 *  - COD Settings panel
 *  - CSV export
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────────────────── */
  const API_BASE = (window.API_BASE || '/api/v1') + '/cod';
  const PAGE_SIZE = 20;

  /* ── State ───────────────────────────────────────────────────────────────── */
  const state = {
    orders: [],
    total: 0,
    page: 1,
    filters: { status: '', search: '', start: '', end: '' },
    selectedIds: new Set(),
    analytics: null,
    settings: null,
    charts: {},
    loading: false,
  };

  /* ── Toast ───────────────────────────────────────────────────────────────── */
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  /* ── API helper ──────────────────────────────────────────────────────────── */
  async function apiFetch(path, opts = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const defaults = {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    };
    const res = await fetch(API_BASE + path, { ...defaults, ...opts, headers: { ...defaults.headers, ...(opts.headers || {}) } });
    if (opts.raw) return res;
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json;
  }

  /* ── Status badge HTML ───────────────────────────────────────────────────── */
  function badgeHtml(status) {
    const icons = {
      pending: 'clock',
      delivered: 'truck',
      collected: 'check-circle',
      returned: 'undo',
      flagged: 'exclamation-triangle',
      undelivered: 'times-circle',
      redelivery_scheduled: 'calendar-alt',
    };
    const icon = icons[status] || 'circle';
    return `<span class="badge badge-${status}"><i class="fas fa-${icon}"></i> ${status.replace(/_/g, ' ')}</span>`;
  }

  /* ── Currency formatter ──────────────────────────────────────────────────── */
  const fmt = (n) => '$' + (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── Date formatter ──────────────────────────────────────────────────────── */
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  /* ── Orders Tab ──────────────────────────────────────────────────────────── */
  async function loadOrders() {
    if (state.loading) return;
    state.loading = true;
    const tbody = document.getElementById('orders-tbody');
    const countEl = document.getElementById('orders-count');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px"><span class="spinner"></span></td></tr>`;

    try {
      const params = new URLSearchParams({ page: state.page, limit: PAGE_SIZE });
      if (state.filters.status) params.set('status', state.filters.status);
      if (state.filters.start) params.set('start', state.filters.start);
      if (state.filters.end) params.set('end', state.filters.end);

      const res = await apiFetch(`?${params}`);
      let orders = res.data || [];

      // Client-side search filter
      if (state.filters.search) {
        const q = state.filters.search.toLowerCase();
        orders = orders.filter(o =>
          (o.id || '').toLowerCase().includes(q) ||
          (o.order_id || '').toLowerCase().includes(q) ||
          (o.address || '').toLowerCase().includes(q)
        );
      }

      state.orders = orders;
      state.total = res.total || orders.length;

      renderOrdersTable(orders);
      renderPagination();
      if (countEl) countEl.textContent = `${state.total} orders`;
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${err.message}</p></div></td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-inbox"></i><p>No COD orders found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr data-id="${o.id}" class="${state.selectedIds.has(o.id) ? 'selected' : ''}">
        <td><input type="checkbox" class="row-check" data-id="${o.id}" ${state.selectedIds.has(o.id) ? 'checked' : ''}></td>
        <td style="font-family:monospace;font-size:.8rem">${(o.id || '').slice(0, 8)}…</td>
        <td style="font-family:monospace;font-size:.8rem">${(o.order_id || '').slice(0, 8)}…</td>
        <td>${fmt(o.amount)}</td>
        <td>${fmt(o.surcharge || 0)}</td>
        <td>${badgeHtml(o.status)}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.address || ''}">${o.address || '—'}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-outline" onclick="CodAdmin.openStatusModal('${o.id}','${o.status}')" title="Update Status"><i class="fas fa-edit"></i></button>
            ${o.status === 'delivered' ? `<button class="btn btn-sm btn-success" onclick="CodAdmin.confirmCollection('${o.id}')" title="Confirm Collection"><i class="fas fa-hand-holding-usd"></i></button>` : ''}
            ${!o.is_flagged ? `<button class="btn btn-sm btn-danger" onclick="CodAdmin.flagOrder('${o.id}')" title="Flag as Fraudulent"><i class="fas fa-flag"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    // Row checkbox events
    tbody.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        updateBulkBar();
        const row = cb.closest('tr');
        if (row) row.classList.toggle('selected', cb.checked);
      });
    });
  }

  function renderPagination() {
    const container = document.getElementById('orders-pagination');
    if (!container) return;
    const totalPages = Math.ceil(state.total / PAGE_SIZE) || 1;

    let html = `<button class="page-btn" onclick="CodAdmin.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    const start = Math.max(1, state.page - 2);
    const end = Math.min(totalPages, state.page + 2);
    if (start > 1) html += `<button class="page-btn" onclick="CodAdmin.goPage(1)">1</button><span style="padding:0 4px">…</span>`;
    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="CodAdmin.goPage(${i})">${i}</button>`;
    }
    if (end < totalPages) html += `<span style="padding:0 4px">…</span><button class="page-btn" onclick="CodAdmin.goPage(${totalPages})">${totalPages}</button>`;
    html += `<button class="page-btn" onclick="CodAdmin.goPage(${state.page + 1})" ${state.page >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
  }

  /* ── Select All ──────────────────────────────────────────────────────────── */
  function bindSelectAll() {
    const allCb = document.getElementById('select-all');
    if (!allCb) return;
    allCb.addEventListener('change', () => {
      state.orders.forEach(o => {
        if (allCb.checked) state.selectedIds.add(o.id);
        else state.selectedIds.delete(o.id);
      });
      document.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = allCb.checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('selected', allCb.checked);
      });
      updateBulkBar();
    });
  }

  function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const cnt = document.getElementById('bulk-count');
    if (!bar) return;
    if (state.selectedIds.size > 0) {
      bar.classList.add('visible');
      if (cnt) cnt.textContent = `${state.selectedIds.size} order${state.selectedIds.size > 1 ? 's' : ''} selected`;
    } else {
      bar.classList.remove('visible');
    }
  }

  /* ── Analytics Tab ───────────────────────────────────────────────────────── */
  async function loadAnalytics() {
    try {
      const res = await apiFetch('/analytics');
      state.analytics = res.data;
      renderAnalytics(res.data);
    } catch (err) {
      showToast('Failed to load analytics: ' + err.message, 'error');
    }
  }

  function renderAnalytics(data) {
    if (!data) return;

    // Update KPI values
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('kpi-total', data.total_orders ?? 0);
    setText('kpi-amount', fmt(data.total_amount));
    setText('kpi-collected', fmt(data.collected_amount));
    setText('kpi-pending-remittance', fmt(data.pending_remittance));
    setText('kpi-success-rate', (data.success_rate ?? 0) + '%');
    setText('kpi-flagged', data.flagged_count ?? 0);

    // Secondary analytics card
    setText('kpi-total-2', data.total_orders ?? 0);
    setText('kpi-amount-2', fmt(data.total_amount));
    setText('kpi-surcharge', fmt(data.total_surcharge));
    setText('kpi-collected-2', fmt(data.collected_amount));
    setText('kpi-remitted', fmt(data.remitted_amount));
    setText('kpi-pending-2', fmt(data.pending_remittance));
    setText('kpi-avg-value', fmt(data.avg_order_value));
    setText('kpi-fraud-score', (data.avg_fraud_score ?? 0) + ' / 100');

    renderStatusChart(data.by_status || {});
    renderSuccessGauge(data.success_rate || 0, data.failed_delivery_rate || 0);
  }

  function renderStatusChart(byStatus) {
    const canvas = document.getElementById('status-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = Object.keys(byStatus);
    const counts = Object.values(byStatus);
    const colors = {
      pending: '#F59E0B', delivered: '#0891B2', collected: '#059669',
      returned: '#DC2626', flagged: '#D97706', undelivered: '#6B7280',
      redelivery_scheduled: '#7C3AED',
    };
    const bgColors = labels.map(l => colors[l] || '#94A3B8');

    if (state.charts.status) state.charts.status.destroy();

    state.charts.status = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels.map(l => l.replace(/_/g, ' ')),
        datasets: [{ data: counts, backgroundColor: bgColors, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} orders` } },
        },
        cutout: '65%',
      },
    });
  }

  function renderSuccessGauge(successRate, failedRate) {
    const canvas = document.getElementById('success-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (state.charts.success) state.charts.success.destroy();

    state.charts.success = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Success Rate', 'Failed Delivery Rate'],
        datasets: [{
          data: [successRate, failedRate],
          backgroundColor: ['#059669', '#DC2626'],
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } } },
      },
    });
  }

  /* ── Reconciliation Tab ──────────────────────────────────────────────────── */
  async function loadReconciliation(start, end) {
    const container = document.getElementById('reconcil-content');
    if (container) container.innerHTML = `<div style="text-align:center;padding:32px"><span class="spinner"></span></div>`;

    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await apiFetch(`/report?${params}`);
      renderReconciliation(res.data);
    } catch (err) {
      if (container) container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${err.message}</p></div>`;
    }
  }

  function renderReconciliation(data) {
    const container = document.getElementById('reconcil-content');
    if (!container || !data) return;

    const s = data.summary || {};
    const orders = data.orders || [];

    container.innerHTML = `
      <div class="reconcil-summary">
        <div class="reconcil-card"><div class="value">${s.total_orders || 0}</div><div class="label">Total Orders</div></div>
        <div class="reconcil-card"><div class="value">${fmt(s.total_amount)}</div><div class="label">Total COD Amount</div></div>
        <div class="reconcil-card"><div class="value">${s.collected || 0}</div><div class="label">Collected</div></div>
        <div class="reconcil-card"><div class="value">${s.pending || 0}</div><div class="label">Pending</div></div>
        <div class="reconcil-card"><div class="value">${s.returned || 0}</div><div class="label">Returned</div></div>
        <div class="reconcil-card"><div class="value">${s.flagged || 0}</div><div class="label">Flagged</div></div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th>Delivered</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length ? orders.map(o => `
              <tr>
                <td style="font-family:monospace;font-size:.8rem">${(o.order_id || o.id || '').slice(0, 12)}…</td>
                <td>${fmt(o.amount)}</td>
                <td>${badgeHtml(o.status)}</td>
                <td>${fmtDate(o.created_at)}</td>
                <td>${fmtDate(o.delivered_at)}</td>
                <td>${fmtDate(o.collected_at)}</td>
              </tr>
            `).join('') : `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>No orders in range</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ── Settings Tab ────────────────────────────────────────────────────────── */
  async function loadSettings() {
    try {
      const res = await apiFetch('/settings');
      state.settings = res.data;
      renderSettings(res.data);
    } catch (err) {
      showToast('Failed to load settings: ' + err.message, 'error');
    }
  }

  function renderSettings(s) {
    if (!s) return;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; } };
    setVal('setting-enabled', s.enabled);
    setVal('setting-surcharge-pct', s.surcharge_pct ?? '');
    setVal('setting-surcharge-fixed', s.surcharge_fixed ?? '');
    setVal('setting-min-amount', s.min_order_amount ?? '');
    setVal('setting-max-amount', s.max_order_amount ?? '');
    setVal('setting-allowed-regions', (s.allowed_regions || []).join('\n'));
    setVal('setting-blocked-regions', (s.blocked_regions || []).join('\n'));
  }

  async function saveSettings() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
    const toArr = (str) => (str || '').split('\n').map(s => s.trim()).filter(Boolean);

    const payload = {
      enabled: getVal('setting-enabled'),
      surcharge_pct: parseFloat(getVal('setting-surcharge-pct')) || 0,
      surcharge_fixed: parseFloat(getVal('setting-surcharge-fixed')) || 0,
      min_order_amount: parseFloat(getVal('setting-min-amount')) || 0,
      max_order_amount: parseFloat(getVal('setting-max-amount')) || 0,
      allowed_regions: toArr(getVal('setting-allowed-regions')),
      blocked_regions: toArr(getVal('setting-blocked-regions')),
    };

    try {
      const res = await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      state.settings = res.data;
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    }
  }

  /* ── Status Update Modal ─────────────────────────────────────────────────── */
  function openStatusModal(id, currentStatus) {
    const modal = document.getElementById('status-modal');
    if (!modal) return;
    modal.querySelector('#modal-order-id').value = id;
    modal.querySelector('#modal-status').value = currentStatus;
    modal.classList.add('open');
  }

  function closeStatusModal() {
    const modal = document.getElementById('status-modal');
    if (modal) modal.classList.remove('open');
  }

  async function submitStatusUpdate() {
    const id = document.getElementById('modal-order-id')?.value;
    const status = document.getElementById('modal-status')?.value;
    const notes = document.getElementById('modal-notes')?.value;

    if (!id || !status) return;

    try {
      await apiFetch(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) });
      closeStatusModal();
      showToast('Order status updated', 'success');
      loadOrders();
      loadAnalytics();
    } catch (err) {
      showToast('Update failed: ' + err.message, 'error');
    }
  }

  /* ── Quick Actions ───────────────────────────────────────────────────────── */
  async function confirmCollection(id) {
    if (!confirm('Confirm cash collection for this order?')) return;
    try {
      await apiFetch(`/${id}/confirm-collection`, { method: 'PATCH' });
      showToast('Collection confirmed', 'success');
      loadOrders();
      loadAnalytics();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  async function flagOrder(id) {
    const reason = prompt('Reason for flagging (optional):') ?? '';
    try {
      await apiFetch(`/${id}/flag`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      showToast('Order flagged', 'info');
      loadOrders();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  /* ── Bulk Actions ────────────────────────────────────────────────────────── */
  async function bulkAction(status) {
    if (!state.selectedIds.size) return;
    const ids = [...state.selectedIds];
    if (!confirm(`Update ${ids.length} order${ids.length > 1 ? 's' : ''} to "${status}"?`)) return;

    try {
      await apiFetch('/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status }) });
      state.selectedIds.clear();
      updateBulkBar();
      showToast(`${ids.length} orders updated to ${status}`, 'success');
      loadOrders();
      loadAnalytics();
    } catch (err) {
      showToast('Bulk update failed: ' + err.message, 'error');
    }
  }

  /* ── Export CSV ──────────────────────────────────────────────────────────── */
  function exportCSV() {
    const params = new URLSearchParams();
    if (state.filters.status) params.set('status', state.filters.status);
    if (state.filters.start) params.set('start', state.filters.start);
    if (state.filters.end) params.set('end', state.filters.end);

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const url = API_BASE + '/export?' + params.toString();

    // Trigger download via hidden anchor
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `cod-report-${Date.now()}.csv`);
    if (token) {
      // Fetch with auth header and create blob URL
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          a.href = URL.createObjectURL(blob);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        })
        .catch(err => showToast('Export failed: ' + err.message, 'error'));
    } else {
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  /* ── Tab Switching ───────────────────────────────────────────────────────── */
  function switchTab(btn, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');

    if (tabId === 'analytics') loadAnalytics();
    if (tabId === 'reconciliation') {
      const start = document.getElementById('reconcil-start')?.value;
      const end = document.getElementById('reconcil-end')?.value;
      loadReconciliation(start, end);
    }
    if (tabId === 'settings') loadSettings();
  }

  /* ── Sidebar Toggle ──────────────────────────────────────────────────────── */
  function bindSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
  }

  /* ── Search & Filter Bindings ────────────────────────────────────────────── */
  function bindFilters() {
    const search = document.getElementById('order-search');
    const statusFilter = document.getElementById('status-filter');
    const startFilter = document.getElementById('date-start');
    const endFilter = document.getElementById('date-end');

    let searchTimer;
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.filters.search = search.value.trim();
          state.page = 1;
          loadOrders();
        }, 300);
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        state.filters.status = statusFilter.value;
        state.page = 1;
        loadOrders();
      });
    }

    if (startFilter) {
      startFilter.addEventListener('change', () => { state.filters.start = startFilter.value; state.page = 1; loadOrders(); });
    }
    if (endFilter) {
      endFilter.addEventListener('change', () => { state.filters.end = endFilter.value; state.page = 1; loadOrders(); });
    }
  }

  /* ── Reconciliation Filter ───────────────────────────────────────────────── */
  function bindReconcilFilter() {
    const btn = document.getElementById('reconcil-apply');
    if (btn) {
      btn.addEventListener('click', () => {
        const start = document.getElementById('reconcil-start')?.value;
        const end = document.getElementById('reconcil-end')?.value;
        loadReconciliation(start, end);
      });
    }
  }

  /* ── Settings form binding ───────────────────────────────────────────────── */
  function bindSettings() {
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */
  function init() {
    bindSidebar();
    bindFilters();
    bindReconcilFilter();
    bindSettings();
    bindSelectAll();
    loadOrders();
    loadAnalytics();
  }

  /* ── Public API (used by inline onclick handlers) ────────────────────────── */
  window.CodAdmin = {
    switchTab,
    goPage: (p) => { state.page = p; loadOrders(); },
    openStatusModal,
    closeStatusModal,
    submitStatusUpdate,
    confirmCollection,
    flagOrder,
    bulkAction,
    exportCSV,
  };

  /* ── Bootstrap ───────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
