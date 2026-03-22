/**
 * Globex Sky — admin/dashboard.js
 * Admin dashboard: fetch metrics, render Chart.js charts,
 * recent activity feed, date range selector, CSV export.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let _dateRange = {
    from: _isoDate(-29), // last 30 days including today (days -29 through 0)
    to:   _isoDate(0),
  };
  let _revenueChart = null;
  let _ordersChart  = null;
  let _usersChart   = null;

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _initDateRangeSelector();
    _loadAll();
  });

  async function _loadAll() {
    await Promise.all([
      _loadStats(),
      _loadSalesChart(),
      _loadRecentOrders(),
      _loadRecentUsers(),
    ]);
  }

  /* ─────────────────────────────────────────────
     AUTH HELPERS
  ───────────────────────────────────────────── */
  function _authHeaders() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  function _api() { return window.ApiClient || window.API || null; }

  async function _fetch(path, params = {}) {
    const api = _api();
    if (api) {
      const qs = new URLSearchParams({ ...params, from: _dateRange.from, to: _dateRange.to });
      const res = await api.get(`${path}?${qs}`);
      return res.data || res;
    }
    const base = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
    const qs = new URLSearchParams({ ...params, from: _dateRange.from, to: _dateRange.to });
    const res = await fetch(`${base}${path}?${qs}`, { headers: _authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || json;
  }

  /* ─────────────────────────────────────────────
     METRIC CARDS
  ───────────────────────────────────────────── */
  async function _loadStats() {
    try {
      const data = await _fetch('/admin/stats');
      _setMetric('#stat-revenue',  _fmtCurrency(data.total_revenue ?? 0));
      _setMetric('#stat-orders',   _fmtNumber(data.total_orders   ?? 0));
      _setMetric('#stat-users',    _fmtNumber(data.total_users    ?? 0));
      _setMetric('#stat-products', _fmtNumber(data.total_products ?? 0));

      // Delta badges
      _setDelta('#delta-revenue',  data.revenue_delta_pct);
      _setDelta('#delta-orders',   data.orders_delta_pct);
      _setDelta('#delta-users',    data.users_delta_pct);
      _setDelta('#delta-products', data.products_delta_pct);
    } catch (err) {
      console.warn('[Dashboard] Stats load failed:', err);
    }
  }

  function _setMetric(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function _setDelta(selector, pct) {
    const el = document.querySelector(selector);
    if (!el || pct == null) return;
    const sign = pct >= 0 ? '+' : '';
    el.textContent = `${sign}${pct.toFixed(1)}%`;
    el.className = `stat-delta ${pct >= 0 ? 'positive' : 'negative'}`;
  }

  /* ─────────────────────────────────────────────
     CHARTS
  ───────────────────────────────────────────── */
  async function _loadSalesChart() {
    if (typeof Chart === 'undefined') {
      console.warn('[Dashboard] Chart.js not loaded.');
      return;
    }

    try {
      const data = await _fetch('/analytics/sales', { granularity: 'daily' });
      const labels  = (data.labels  || data.dates  || []);
      const revenue = (data.revenue || data.values || []);
      const orders  = (data.orders  || []);
      const users   = (data.new_users || []);

      _renderRevenueChart(labels, revenue);
      _renderOrdersChart(labels, orders);
      if (users.length) _renderUsersChart(labels, users);
    } catch (err) {
      console.warn('[Dashboard] Sales chart load failed:', err);
    }
  }

  function _renderRevenueChart(labels, data) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    if (_revenueChart) _revenueChart.destroy();
    _revenueChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (USD)',
          data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` $${Number(ctx.raw).toLocaleString()}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `$${_fmtNumber(v)}`,
            },
          },
        },
      },
    });
  }

  function _renderOrdersChart(labels, data) {
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;

    if (_ordersChart) _ordersChart.destroy();
    _ordersChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Orders',
          data,
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function _renderUsersChart(labels, data) {
    const canvas = document.getElementById('usersChart');
    if (!canvas) return;

    if (_usersChart) _usersChart.destroy();
    _usersChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'New Users',
          data,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  /* ─────────────────────────────────────────────
     RECENT ORDERS TABLE
  ───────────────────────────────────────────── */
  async function _loadRecentOrders() {
    const tbody = document.querySelector('[data-recent-orders]');
    if (!tbody) return;

    try {
      const data = await _fetch('/admin/orders', { limit: 5, page: 1 });
      const orders = Array.isArray(data) ? data : data.orders || data.items || [];

      if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="5">No recent orders</td></tr>';
        return;
      }

      tbody.innerHTML = orders.map((o) => `
        <tr>
          <td><a href="/pages/admin/order-detail.html?id=${o.id}">#${o.id}</a></td>
          <td>${_escapeHTML(o.user?.name || o.customer_name || '—')}</td>
          <td>${_fmtCurrency(o.total || 0)}</td>
          <td><span class="badge badge-${_statusClass(o.status)}">${_escapeHTML(o.status || '')}</span></td>
          <td>${_formatDate(o.created_at)}</td>
        </tr>`).join('');
    } catch (err) {
      console.warn('[Dashboard] Recent orders load failed:', err);
    }
  }

  /* ─────────────────────────────────────────────
     RECENT USERS
  ───────────────────────────────────────────── */
  async function _loadRecentUsers() {
    const container = document.querySelector('[data-recent-users]');
    if (!container) return;

    try {
      const data = await _fetch('/admin/users', { limit: 5, sort: 'created_at', order: 'desc' });
      const users = Array.isArray(data) ? data : data.users || data.items || [];

      if (!users.length) {
        container.innerHTML = '<p>No recent users</p>';
        return;
      }

      container.innerHTML = users.map((u) => `
        <div class="activity-item">
          <div class="activity-avatar">${(u.name || 'U').charAt(0).toUpperCase()}</div>
          <div class="activity-body">
            <strong>${_escapeHTML(u.name || 'Unknown')}</strong>
            <small>${_escapeHTML(u.email || '')}</small>
          </div>
          <time class="activity-time">${_formatDate(u.created_at)}</time>
        </div>`).join('');
    } catch (err) {
      console.warn('[Dashboard] Recent users load failed:', err);
    }
  }

  /* ─────────────────────────────────────────────
     DATE RANGE SELECTOR
  ───────────────────────────────────────────── */
  function _initDateRangeSelector() {
    const fromInput = document.querySelector('[data-range-from]');
    const toInput   = document.querySelector('[data-range-to]');
    const applyBtn  = document.querySelector('[data-range-apply]');

    if (fromInput) fromInput.value = _dateRange.from;
    if (toInput)   toInput.value   = _dateRange.to;

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (fromInput) _dateRange.from = fromInput.value || _dateRange.from;
        if (toInput)   _dateRange.to   = toInput.value   || _dateRange.to;
        _loadAll();
      });
    }

    // Quick range presets
    document.querySelectorAll('[data-range-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.rangePreset, 10);
        _dateRange = { from: _isoDate(-days + 1), to: _isoDate(0) };
        if (fromInput) fromInput.value = _dateRange.from;
        if (toInput)   toInput.value   = _dateRange.to;
        document.querySelectorAll('[data-range-preset]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        _loadAll();
      });
    });
  }

  /* ─────────────────────────────────────────────
     CSV EXPORT
  ───────────────────────────────────────────── */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-export-csv]');
    if (!btn) return;

    const resource = btn.dataset.exportCsv || 'orders';
    btn.disabled = true;
    btn.textContent = 'Exporting…';

    try {
      const base = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';
      const qs   = new URLSearchParams({ format: 'csv', from: _dateRange.from, to: _dateRange.to });
      const res  = await fetch(`${base}/admin/export/${resource}?${qs}`, { headers: _authHeaders() });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${resource}-${_dateRange.from}-to-${_dateRange.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (window.GlobexSky?.showToast) window.GlobexSky.showToast('Export failed', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export CSV';
    }
  });

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function _isoDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function _fmtCurrency(n) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${Number(n).toFixed(2)}`;
  }

  function _fmtNumber(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function _formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _statusClass(status) {
    const map = {
      pending: 'warning', confirmed: 'info', processing: 'primary',
      shipped: 'info', delivered: 'success', cancelled: 'danger', returned: 'secondary',
    };
    return map[(status || '').toLowerCase()] || 'secondary';
  }

  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
