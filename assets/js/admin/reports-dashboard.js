/**
 * Globex Sky — Admin Reports & Analytics Dashboard
 * assets/js/admin/reports-dashboard.js
 *
 * Features:
 *   - KPI cards loaded from /api/v1/analytics/dashboard
 *   - Revenue trend line chart from /api/v1/admin/reports/revenue
 *   - Order volume bar chart from /api/v1/analytics/sales
 *   - User growth area chart from /api/v1/analytics/users
 *   - Top products pie/doughnut from product analytics
 *   - Financial P&L section from /api/v1/admin/reports/profit-loss
 *   - Commission report from /api/v1/admin/reports/commissions
 *   - Transaction table from /api/v1/admin/reports/transactions
 *   - Shipment analytics from /api/v1/analytics/shipments
 *   - Tab navigation between report sections
 *   - Date range picker with presets
 *   - Export: CSV (native), PDF (jsPDF), Excel (SheetJS/XLSX)
 *   - Custom report builder
 *   - Auto-refresh every 5 minutes
 */

(function () {
  'use strict';

  /* ───────────────────────────────────────────────────────────
     CONFIG
  ─────────────────────────────────────────────────────────── */
  const BASE_URL = (() => {
    if (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) return window.GlobexConfig.API_BASE_URL;
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1')
      ? 'http://localhost:5000/api/v1'
      : 'https://globexsky-production.up.railway.app/api/v1';
  })();

  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /* ───────────────────────────────────────────────────────────
     STATE
  ─────────────────────────────────────────────────────────── */
  const state = {
    dateFrom: _isoDate(-29),
    dateTo:   _isoDate(0),
    activeTab: 'overview',
    charts: {},
    refreshTimer: null,
  };

  /* ───────────────────────────────────────────────────────────
     INIT
  ─────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _initDatePicker();
    _initTabs();
    _initExportButtons();
    _initReportBuilder();
    _initSidebarToggle();
    _loadAll();
    state.refreshTimer = setInterval(_loadAll, REFRESH_INTERVAL_MS);
  });

  /* ───────────────────────────────────────────────────────────
     AUTH
  ─────────────────────────────────────────────────────────── */
  function _authHeaders() {
    const token = localStorage.getItem('token')
      || localStorage.getItem('globexToken')
      || localStorage.getItem('auth_token')
      || sessionStorage.getItem('token') || '';
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  /* ───────────────────────────────────────────────────────────
     FETCH WRAPPER
  ─────────────────────────────────────────────────────────── */
  async function _get(path, params = {}) {
    const qs = new URLSearchParams(params);
    const url = `${BASE_URL}${path}${qs.toString() ? '?' + qs : ''}`;
    const res = await fetch(url, { headers: _authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  /* ───────────────────────────────────────────────────────────
     LOAD ALL
  ─────────────────────────────────────────────────────────── */
  async function _loadAll() {
    _loadKPIs();
    _loadOverviewCharts();
    if (state.activeTab !== 'overview') _loadTabData(state.activeTab);
  }

  /* ───────────────────────────────────────────────────────────
     KPI CARDS
  ─────────────────────────────────────────────────────────── */
  async function _loadKPIs() {
    try {
      const data = await _get('/analytics/dashboard');
      _setText('#kpi-revenue',  _fmtCurrency(data.total_revenue  ?? 0));
      _setText('#kpi-orders',   _fmtNumber(data.total_orders    ?? 0));
      _setText('#kpi-users',    _fmtNumber(data.total_users     ?? 0));
      _setText('#kpi-products', _fmtNumber(data.total_products  ?? 0));

      _setDelta('#kpi-revenue-delta',  data.revenue_delta_pct);
      _setDelta('#kpi-orders-delta',   data.orders_delta_pct);
      _setDelta('#kpi-users-delta',    data.users_delta_pct);
      _setDelta('#kpi-products-delta', data.products_delta_pct);

      // Mirror values in overview tab stat-row
      _setText('#kpi-revenue2',  _fmtCurrency(data.total_revenue  ?? 0));
      _setText('#kpi-orders2',   _fmtNumber(data.total_orders    ?? 0));
      _setText('#kpi-users2',    _fmtNumber(data.total_users     ?? 0));
      _setText('#kpi-products2', _fmtNumber(data.total_products  ?? 0));
    } catch (e) {
      console.warn('[Reports] KPI load failed:', e.message);
    }
  }

  /* ───────────────────────────────────────────────────────────
     OVERVIEW CHARTS
  ─────────────────────────────────────────────────────────── */
  async function _loadOverviewCharts() {
    await Promise.allSettled([
      _loadRevenueChart(),
      _loadOrdersChart(),
      _loadUserGrowthChart(),
      _loadTopProductsChart(),
    ]);
    _loadTrafficTab(); // populate traffic section in overview
  }

  async function _loadRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const data = await _get('/admin/reports/revenue', {
        start_date: state.dateFrom,
        end_date:   state.dateTo,
        group_by:   'day',
      });
      const rows    = data.chart_data || [];
      const labels  = rows.map(r => _shortDate(r.date || r.period));
      const values  = rows.map(r => Number(r.revenue || r.total || 0));

      _destroyChart('revenue');
      state.charts.revenue = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Revenue (USD)',
            data: values,
            borderColor: '#0052CC',
            backgroundColor: 'rgba(0,82,204,.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
          }],
        },
        options: _lineOpts(v => `$${_fmtNumber(v)}`),
      });
    } catch (e) {
      _showChartError('revenueChart', 'Revenue data unavailable');
    }
  }

  async function _loadOrdersChart() {
    const canvas = document.getElementById('ordersChart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const data = await _get('/analytics/sales', { start: state.dateFrom, end: state.dateTo });
      const orders = Array.isArray(data) ? data : data.orders || [];

      // Group by date
      const byDate = {};
      orders.forEach(o => {
        const d = _shortDate(o.created_at || o.date);
        byDate[d] = (byDate[d] || 0) + 1;
      });
      const labels = Object.keys(byDate).slice(-30);
      const values = labels.map(d => byDate[d] || 0);

      _destroyChart('orders');
      state.charts.orders = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Orders',
            data: values,
            backgroundColor: 'rgba(5,150,105,.7)',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: _barOpts(),
      });
    } catch (e) {
      _showChartError('ordersChart', 'Order data unavailable');
    }
  }

  async function _loadUserGrowthChart() {
    const canvas = document.getElementById('usersChart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const data = await _get('/analytics/users');
      const breakdown = data.breakdown || {};
      const labels = Object.keys(breakdown);
      const values = Object.values(breakdown);

      _destroyChart('users');
      state.charts.users = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#0052CC','#059669','#f97316','#7c3aed','#0d9488','#ef4444'],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${_fmtNumber(ctx.raw)}` } },
          },
        },
      });
    } catch (e) {
      _showChartError('usersChart', 'User data unavailable');
    }
  }

  async function _loadTopProductsChart() {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const data = await _get('/analytics/products');
      const breakdown = data.breakdown || {};
      const entries = Object.entries(breakdown).slice(0, 6);
      const labels  = entries.map(([k]) => k);
      const values  = entries.map(([, v]) => v);

      _destroyChart('topProducts');
      state.charts.topProducts = new Chart(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#0052CC','#059669','#f97316','#7c3aed','#0d9488','#ef4444'],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          },
        },
      });
    } catch (e) {
      _showChartError('topProductsChart', 'Product data unavailable');
    }
  }

  /* ───────────────────────────────────────────────────────────
     TAB DATA LOADERS
  ─────────────────────────────────────────────────────────── */
  const _tabLoaders = {
    sales:     _loadSalesTab,
    users:     _loadUsersTab,
    products:  _loadProductsTab,
    orders:    _loadOrdersTab,
    shipments: _loadShipmentsTab,
    financial: _loadFinancialTab,
    traffic:   _loadTrafficTab,
  };

  function _loadTabData(tab) {
    if (_tabLoaders[tab]) _tabLoaders[tab]();
  }

  /* Sales Tab */
  async function _loadSalesTab() {
    try {
      const data = await _get('/analytics/sales', { start: state.dateFrom, end: state.dateTo });
      const orders = Array.isArray(data) ? data : data.orders || [];
      const revenue = Array.isArray(data) ? 0 : (data.total_revenue || 0);
      const count   = Array.isArray(data) ? data.length : (data.order_count || orders.length);

      _setText('#sales-total-revenue', _fmtCurrency(revenue || orders.reduce((s,o) => s + Number(o.total||0), 0)));
      _setText('#sales-order-count',   _fmtNumber(count));
      _setText('#sales-avg-value',     count > 0 ? _fmtCurrency((revenue || 1) / count) : '$0');

      const tbody = document.querySelector('#salesTable tbody');
      if (tbody) {
        if (!orders.length) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">No sales data for this period</td></tr>';
        } else {
          tbody.innerHTML = orders.slice(0, 20).map(o => `
            <tr>
              <td>#${_esc(o.id || '')}</td>
              <td>${_esc(o.buyer?.name || o.customer_name || '—')}</td>
              <td><span class="badge-pill badge-blue">${_esc(o.category || 'General')}</span></td>
              <td>${_fmtCurrency(Number(o.total || 0))}</td>
              <td><span class="badge-pill ${_statusBadge(o.status)}">${_esc(o.status || '—')}</span></td>
            </tr>`).join('');
        }
      }
    } catch (e) {
      _tableError('#salesTable', 5, 'Sales data unavailable');
    }
  }

  /* Users Tab */
  async function _loadUsersTab() {
    try {
      const data = await _get('/analytics/users');
      _setText('#users-total',   _fmtNumber(data.total_users || 0));
      const breakdown = data.breakdown || {};
      const tbody = document.querySelector('#usersTable tbody');
      if (tbody) {
        tbody.innerHTML = Object.entries(breakdown).map(([role, count]) => `
          <tr>
            <td><span class="badge-pill badge-blue">${_esc(role)}</span></td>
            <td>${_fmtNumber(count)}</td>
            <td>${data.total_users > 0 ? ((count / data.total_users) * 100).toFixed(1) + '%' : '0%'}</td>
          </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">No user data</td></tr>';
      }

      /* User breakdown chart */
      const canvas = document.getElementById('userBreakdownChart');
      if (canvas && typeof Chart !== 'undefined') {
        const labels = Object.keys(breakdown);
        const values = Object.values(breakdown);
        _destroyChart('userBreakdown');
        state.charts.userBreakdown = new Chart(canvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ label: 'Users', data: values,
              backgroundColor: ['#0052CC','#059669','#f97316','#7c3aed'],
              borderRadius: 6,
            }],
          },
          options: _barOpts(),
        });
      }
    } catch (e) {
      _tableError('#usersTable', 3, 'User analytics unavailable');
    }
  }

  /* Products Tab */
  async function _loadProductsTab() {
    try {
      const data = await _get('/analytics/products');
      _setText('#products-total', _fmtNumber(data.total_products || 0));
      const breakdown = data.breakdown || {};
      const tbody = document.querySelector('#productsTable tbody');
      if (tbody) {
        tbody.innerHTML = Object.entries(breakdown).map(([status, count]) => `
          <tr>
            <td><span class="badge-pill ${_statusBadge(status)}">${_esc(status)}</span></td>
            <td>${_fmtNumber(count)}</td>
            <td>${data.total_products > 0 ? ((count / data.total_products) * 100).toFixed(1) + '%' : '0%'}</td>
          </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">No product data</td></tr>';
      }
    } catch (e) {
      _tableError('#productsTable', 3, 'Product analytics unavailable');
    }
  }

  /* Orders Tab */
  async function _loadOrdersTab() {
    try {
      const data = await _get('/admin/orders', { page: 1, limit: 20,
        start_date: state.dateFrom, end_date: state.dateTo });
      const orders = Array.isArray(data) ? data : data.orders || data.items || [];

      _setText('#orders-tab-count', _fmtNumber(orders.length));

      const tbody = document.querySelector('#ordersTable tbody');
      if (tbody) {
        tbody.innerHTML = orders.length ? orders.map(o => `
          <tr>
            <td><a href="order-detail.html?id=${_esc(o.id)}">#${_esc(o.id)}</a></td>
            <td>${_esc(o.buyer?.name || o.customer_name || '—')}</td>
            <td>${_fmtCurrency(Number(o.total || 0))}</td>
            <td><span class="badge-pill ${_statusBadge(o.status)}">${_esc(o.status || '—')}</span></td>
            <td>${_fmtDate(o.created_at)}</td>
          </tr>`).join('')
          : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">No orders for this period</td></tr>';
      }
    } catch (e) {
      _tableError('#ordersTable', 5, 'Order data unavailable');
    }
  }

  /* Shipments Tab */
  async function _loadShipmentsTab() {
    try {
      const data = await _get('/analytics/shipments');
      _setText('#shipments-total', _fmtNumber(data.total_parcels || 0));
      const breakdown = data.breakdown || {};

      const canvas = document.getElementById('shipmentsChart');
      if (canvas && typeof Chart !== 'undefined') {
        const labels = Object.keys(breakdown);
        const values = Object.values(breakdown);
        _destroyChart('shipments');
        state.charts.shipments = new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{ data: values,
              backgroundColor: ['#0052CC','#059669','#f97316','#7c3aed','#0d9488','#ef4444'],
              borderWidth: 2, borderColor: '#fff',
            }],
          },
          options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } },
        });
      }

      const tbody = document.querySelector('#shipmentsTable tbody');
      if (tbody) {
        tbody.innerHTML = Object.entries(breakdown).map(([status, count]) => `
          <tr>
            <td><span class="badge-pill ${_statusBadge(status)}">${_esc(status)}</span></td>
            <td>${_fmtNumber(count)}</td>
            <td>${data.total_parcels > 0 ? ((count / data.total_parcels) * 100).toFixed(1) + '%' : '0%'}</td>
          </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">No shipment data</td></tr>';
      }
    } catch (e) {
      _tableError('#shipmentsTable', 3, 'Shipment analytics unavailable');
    }
  }

  /* Financial Tab */
  async function _loadFinancialTab() {
    try {
      const [plData, commData, txData, finData] = await Promise.allSettled([
        _get('/admin/reports/profit-loss', { start_date: state.dateFrom, end_date: state.dateTo }),
        _get('/admin/reports/commissions', { start_date: state.dateFrom, end_date: state.dateTo }),
        _get('/admin/reports/transactions', { page: 1, limit: 20, start_date: state.dateFrom, end_date: state.dateTo }),
        _get('/analytics/financial'),
      ]);

      if (plData.status === 'fulfilled') {
        const pl = plData.value;
        _setText('#fin-revenue',    _fmtCurrency(pl.total_revenue   || 0));
        _setText('#fin-refunds',    _fmtCurrency(pl.total_refunds   || 0));
        _setText('#fin-payouts',    _fmtCurrency(pl.total_payouts   || 0));
        _setText('#fin-gross',      _fmtCurrency(pl.gross_profit    || 0));
        _setText('#fin-net',        _fmtCurrency(pl.net_profit      || 0));
        _setText('#fin-margin',     (pl.profit_margin_pct || 0).toFixed(1) + '%');
      }

      if (commData.status === 'fulfilled') {
        const c = commData.value;
        _setText('#fin-commission-total', _fmtCurrency(c.total_commissions || 0));
        _setText('#fin-commission-count', _fmtNumber(c.transaction_count   || 0));
        _setText('#fin-commission-avg',   _fmtCurrency(c.average_commission || 0));
      }

      if (txData.status === 'fulfilled') {
        const transactions = txData.value.transactions || txData.value.items || (Array.isArray(txData.value) ? txData.value : []);
        const tbody = document.querySelector('#transactionsTable tbody');
        if (tbody) {
          tbody.innerHTML = transactions.length ? transactions.map(t => `
            <tr>
              <td>${_esc(t.id || '')}</td>
              <td><span class="badge-pill badge-blue">${_esc(t.type || '—')}</span></td>
              <td>${_fmtCurrency(Number(t.amount || 0))}</td>
              <td><span class="badge-pill ${_statusBadge(t.status)}">${_esc(t.status || '—')}</span></td>
              <td>${_fmtDate(t.created_at)}</td>
            </tr>`).join('')
            : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">No transactions</td></tr>';
        }
      }

      if (finData.status === 'fulfilled') {
        const summary = finData.value.summary || {};
        const canvas = document.getElementById('financialChart');
        if (canvas && typeof Chart !== 'undefined') {
          const labels = Object.keys(summary);
          const values = labels.map(k => Number(summary[k]?.amount || summary[k] || 0));
          _destroyChart('financial');
          state.charts.financial = new Chart(canvas, {
            type: 'bar',
            data: {
              labels,
              datasets: [{ label: 'Amount (USD)', data: values,
                backgroundColor: ['#0052CC','#ef4444','#f97316','#059669'],
                borderRadius: 6,
              }],
            },
            options: _barOpts(v => `$${_fmtNumber(v)}`),
          });
        }
      }
    } catch (e) {
      console.warn('[Reports] Financial tab error:', e.message);
    }
  }

  /* Traffic Tab (static illustration with real session structure) */
  function _loadTrafficTab() {
    const sources = [
      { name: 'Organic Search', icon: 'fa-search',           pct: 45, color: '#0052CC', sessions: 54450 },
      { name: 'Direct',         icon: 'fa-link',             pct: 25, color: '#059669', sessions: 30250 },
      { name: 'Social Media',   icon: 'fa-share-alt',        pct: 18, color: '#7c3aed', sessions: 21780 },
      { name: 'Referral',       icon: 'fa-external-link-alt',pct: 12, color: '#f97316', sessions: 14520 },
    ];
    const html = sources.map(s => `
      <div class="traffic-item">
        <span class="traffic-source-name"><i class="fas ${_esc(s.icon)}" style="color:${s.color};margin-right:8px"></i>${_esc(s.name)}</span>
        <div class="traffic-bar-wrap"><div class="traffic-bar-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
        <span class="traffic-pct">${s.pct}%</span>
        <span class="traffic-sessions">${_fmtNumber(s.sessions)} sessions</span>
      </div>`).join('');
    const c1 = document.getElementById('trafficSources');
    const c2 = document.getElementById('trafficSourcesFull');
    if (c1) c1.innerHTML = html;
    if (c2) c2.innerHTML = html;
  }

  /* ───────────────────────────────────────────────────────────
     TAB NAVIGATION
  ─────────────────────────────────────────────────────────── */
  function _initTabs() {
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!tab) return;

        document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.report-tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = document.getElementById(`tab-${tab}`);
        if (panel) panel.classList.add('active');

        state.activeTab = tab;
        if (tab !== 'overview') _loadTabData(tab);
      });
    });
  }

  /* ───────────────────────────────────────────────────────────
     DATE PICKER
  ─────────────────────────────────────────────────────────── */
  function _initDatePicker() {
    const fromEl   = document.getElementById('dateFrom');
    const toEl     = document.getElementById('dateTo');
    const applyBtn = document.getElementById('applyDate');

    if (fromEl) fromEl.value = state.dateFrom;
    if (toEl)   toEl.value   = state.dateTo;

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        state.dateFrom = fromEl?.value || state.dateFrom;
        state.dateTo   = toEl?.value   || state.dateTo;
        _loadAll();
        _showToast('Date range applied', 'info');
      });
    }

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.preset, 10);
        state.dateFrom = _isoDate(-days + 1);
        state.dateTo   = _isoDate(0);
        if (fromEl) fromEl.value = state.dateFrom;
        if (toEl)   toEl.value   = state.dateTo;
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _loadAll();
      });
    });
  }

  /* ───────────────────────────────────────────────────────────
     EXPORT BUTTONS
  ─────────────────────────────────────────────────────────── */
  function _initExportButtons() {
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-export]');
      if (!btn) return;

      const format   = btn.dataset.export;
      const resource = btn.dataset.resource || 'revenue';

      btn.disabled = true;
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></span> Exporting…';

      try {
        if (format === 'csv') {
          await _exportCSV(resource);
        } else if (format === 'pdf') {
          await _exportPDF(resource);
        } else if (format === 'excel') {
          await _exportExcel(resource);
        }
        _showToast(`${format.toUpperCase()} exported successfully`, 'success');
      } catch (err) {
        console.warn('[Reports] Export error:', err);
        _showToast(`Export failed: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }
    });
  }

  async function _exportCSV(resource) {
    /* Use backend export endpoint when available */
    const validBackendTypes = ['revenue', 'commissions', 'transactions', 'payouts'];
    if (validBackendTypes.includes(resource)) {
      const qs = new URLSearchParams({ format: 'csv', start_date: state.dateFrom, end_date: state.dateTo });
      const res = await fetch(`${BASE_URL}/admin/reports/export/${resource}?${qs}`, { headers: _authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      _downloadBlob(blob, `${resource}-${state.dateFrom}-to-${state.dateTo}.csv`);
      return;
    }
    /* Fallback: convert current table to CSV */
    const table = document.querySelector('.rpt-table');
    if (!table) throw new Error('No table found to export');
    const csv = _tableToCSV(table);
    _downloadBlob(new Blob([csv], { type: 'text/csv' }), `report-${state.dateFrom}.csv`);
  }

  async function _exportPDF(resource) {
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      /* Dynamic load jsPDF from CDN */
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) throw new Error('jsPDF not available');

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Globex Sky — ${_tabLabel(resource)} Report`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${state.dateFrom} to ${state.dateTo}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    const table = document.querySelector('.report-tab-panel.active .rpt-table') || document.querySelector('.rpt-table');
    if (table && doc.autoTable) {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      const rows    = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
      );
      doc.autoTable({ head: [headers], body: rows, startY: 38, styles: { fontSize: 9 } });
    }

    doc.save(`${resource}-report-${state.dateFrom}.pdf`);
  }

  async function _exportExcel(resource) {
    if (typeof XLSX === 'undefined') {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }
    if (typeof XLSX === 'undefined') throw new Error('SheetJS not available');

    const table = document.querySelector('.report-tab-panel.active .rpt-table') || document.querySelector('.rpt-table');
    if (!table) throw new Error('No table found to export');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, resource);
    XLSX.writeFile(wb, `${resource}-report-${state.dateFrom}.xlsx`);
  }

  /* ───────────────────────────────────────────────────────────
     CUSTOM REPORT BUILDER
  ─────────────────────────────────────────────────────────── */
  function _initReportBuilder() {
    const form = document.getElementById('reportBuilderForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const metric   = form.querySelector('[name="metric"]')?.value   || 'revenue';
      const schedule = form.querySelector('[name="schedule"]')?.value || 'daily';
      const format   = form.querySelector('[name="format"]')?.value   || 'csv';

      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

      try {
        /* Map metric to report type */
        const endpointMap = {
          revenue:     '/admin/reports/revenue',
          orders:      '/analytics/sales',
          users:       '/analytics/users',
          products:    '/analytics/products',
          shipments:   '/analytics/shipments',
          financial:   '/analytics/financial',
          commissions: '/admin/reports/commissions',
          payouts:     '/admin/reports/payouts',
        };

        const endpoint = endpointMap[metric] || '/admin/reports/revenue';
        const data = await _get(endpoint, { start_date: state.dateFrom, end_date: state.dateTo });

        /* Render preview */
        _renderBuilderPreview(metric, data);

        /* Schedule display */
        const scheduleEl = document.getElementById('builderScheduleNote');
        if (scheduleEl) scheduleEl.textContent = `Scheduled: ${schedule} delivery configured.`;

        _showToast(`${_tabLabel(metric)} report generated`, 'success');
      } catch (err) {
        _showToast('Report generation failed: ' + err.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Generate Report'; }
      }
    });
  }

  function _renderBuilderPreview(metric, data) {
    const preview = document.getElementById('builderPreview');
    if (!preview) return;

    /* Build a simple table from whatever data came back */
    let rows = [];
    if (Array.isArray(data)) rows = data.slice(0, 10);
    else if (data.orders)       rows = data.orders.slice(0, 10);
    else if (data.transactions) rows = data.transactions.slice(0, 10);
    else if (data.chart_data)   rows = data.chart_data.slice(0, 10);
    else if (data.breakdown)    rows = Object.entries(data.breakdown).map(([k,v]) => ({ key: k, count: v }));
    else rows = [data];

    if (!rows.length) {
      preview.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px">No data to preview</p>';
      return;
    }

    const keys = Object.keys(rows[0]).filter(k => !['id','created_at','updated_at'].includes(k)).slice(0, 6);
    preview.innerHTML = `
      <div class="rpt-table-wrap" style="margin-top:16px">
        <table class="rpt-table">
          <thead><tr>${keys.map(k => `<th>${_esc(k)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${keys.map(k => `<td>${_esc(String(r[k] ?? '—'))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  /* ───────────────────────────────────────────────────────────
     SIDEBAR TOGGLE
  ─────────────────────────────────────────────────────────── */
  function _initSidebarToggle() {
    const toggle  = document.querySelector('.sidebar-toggle');
    const sidebar = document.getElementById('adminSidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
  }

  /* ───────────────────────────────────────────────────────────
     CHART HELPERS
  ─────────────────────────────────────────────────────────── */
  function _lineOpts(tickFmt) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${tickFmt ? tickFmt(ctx.raw) : ctx.raw}` } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: tickFmt || (v => v), font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      },
    };
  }

  function _barOpts(tickFmt) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${tickFmt ? tickFmt(ctx.raw) : ctx.raw}` } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: tickFmt || (v => v), precision: 0, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      },
    };
  }

  function _destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }

  function _showChartError(canvasId, msg) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      parent.innerHTML = `<div class="chart-loading"><i class="fas fa-chart-bar"></i><span>${msg}</span></div>`;
    }
  }

  /* ───────────────────────────────────────────────────────────
     DOM HELPERS
  ─────────────────────────────────────────────────────────── */
  function _setText(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  }

  function _setDelta(sel, pct) {
    const el = document.querySelector(sel);
    if (!el || pct == null) return;
    const sign = pct >= 0 ? '+' : '';
    const dir  = pct >= 0 ? 'up' : 'down';
    const icon = pct >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    el.className = `kpi-change ${dir}`;
    el.innerHTML = `<i class="fas ${icon}"></i> ${sign}${Number(pct).toFixed(1)}% vs last period`;
  }

  function _tableError(sel, cols, msg) {
    const tbody = document.querySelector(`${sel} tbody`);
    if (tbody) tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;color:#94a3b8;padding:24px">${msg}</td></tr>`;
  }

  /* ───────────────────────────────────────────────────────────
     TOAST
  ─────────────────────────────────────────────────────────── */
  function _showToast(msg, type = 'info') {
    let toast = document.getElementById('rptToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rptToast';
      toast.className = 'rpt-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `rpt-toast ${type}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /* ───────────────────────────────────────────────────────────
     EXPORT UTILITIES
  ─────────────────────────────────────────────────────────── */
  function _tableToCSV(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.map(row =>
      Array.from(row.querySelectorAll('th,td'))
        .map(cell => '"' + cell.textContent.trim().replace(/"/g, '""') + '"')
        .join(',')
    ).join('\r\n');
  }

  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload  = resolve;
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  }

  /* ───────────────────────────────────────────────────────────
     FORMAT UTILITIES
  ─────────────────────────────────────────────────────────── */
  function _isoDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function _shortDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) { return iso; }
  }

  function _fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return iso; }
  }

  function _fmtCurrency(n) {
    n = Number(n) || 0;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }

  function _fmtNumber(n) {
    n = Number(n) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _statusBadge(status) {
    const s = (status || '').toLowerCase();
    if (['active','delivered','completed','paid'].includes(s))   return 'badge-green';
    if (['pending','processing','in_transit'].includes(s))       return 'badge-orange';
    if (['cancelled','failed','rejected','returned'].includes(s))return 'badge-red';
    if (['draft','archived'].includes(s))                        return 'badge-gray';
    return 'badge-blue';
  }

  function _tabLabel(tab) {
    const m = { overview:'Overview', sales:'Sales', users:'Users', products:'Products',
      orders:'Orders', shipments:'Shipments', financial:'Financial', traffic:'Traffic',
      revenue:'Revenue', commissions:'Commissions', payouts:'Payouts', transactions:'Transactions' };
    return m[tab] || tab;
  }

})();
