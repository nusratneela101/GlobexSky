/**
 * Globex Sky - insights.js
 * Market insights, trend graphs, reports, buyer/supplier analytics charts.
 */

const InsightsAPI = {
  BASE: '/api/v1/insights',
  headers() {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function getDateRange() {
  const from = document.querySelector('[data-date-from], #dateFrom')?.value || '';
  const to   = document.querySelector('[data-date-to], #dateTo')?.value || '';
  return from && to ? `?from=${from}&to=${to}` : '';
}

function buildLineChart(canvas, data, label, color = '#0d6efd') {
  if (!canvas || typeof Chart === 'undefined') return;
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.labels || [],
      datasets: [{
        label,
        data: data.values || [],
        borderColor: color,
        backgroundColor: color.replace(')', ', .12)').replace('rgb', 'rgba'),
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function buildBarChart(canvas, data, label, color = '#0d6efd') {
  if (!canvas || typeof Chart === 'undefined') return;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels || [],
      datasets: [{
        label,
        data: data.values || [],
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

/* ─────────────────────────────────────────────
   DATE RANGE PICKER
───────────────────────────────────────────── */
function initDateRangePicker(onChangeCallback) {
  const form = document.querySelector('#dateRangeForm, [data-date-range-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onChangeCallback && onChangeCallback();
  });

  // Quick range buttons
  document.querySelectorAll('[data-quick-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.quickRange, 10);
      const to   = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const fromEl = form.querySelector('[data-date-from], #dateFrom');
      const toEl   = form.querySelector('[data-date-to], #dateTo');
      if (fromEl) fromEl.value = from;
      if (toEl)   toEl.value   = to;
      document.querySelectorAll('[data-quick-range]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChangeCallback && onChangeCallback();
    });
  });
}

/* ─────────────────────────────────────────────
   MARKET INSIGHTS
───────────────────────────────────────────── */
async function initMarketInsights() {
  const section = document.querySelector('.market-insights, [data-market-insights]');
  if (!section) return;

  const load = async () => {
    const canvas1 = section.querySelector('#marketTrendChart, [data-market-trend-chart]');
    const canvas2 = section.querySelector('#categoryChart, [data-category-chart]');
    const canvas3 = section.querySelector('#priceIndexChart, [data-price-index-chart]');

    try {
      const range = getDateRange();
      const data  = await InsightsAPI.get(`/market${range}`);
      const d     = data.data || data;

      // Stats summary
      const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
      set('[data-stat="growth"]',     d.growthRate  ? `+${d.growthRate}%`  : '—');
      set('[data-stat="volume"]',     d.tradeVolume ? `$${parseFloat(d.tradeVolume).toLocaleString()}` : '—');
      set('[data-stat="top-category"]', d.topCategory || '—');
      set('[data-stat="avg-order"]',  d.avgOrderValue ? `$${parseFloat(d.avgOrderValue).toFixed(2)}` : '—');

      // Charts
      if (canvas1 && d.trendData) buildLineChart(canvas1, d.trendData, 'Market Trend');
      if (canvas2 && d.categoryData) buildBarChart(canvas2, d.categoryData, 'Category Volume', 'rgba(13,110,253,.6)');
      if (canvas3 && d.priceIndex) buildLineChart(canvas3, d.priceIndex, 'Price Index', 'rgb(25,135,84)');
    } catch (_) {}
  };

  initDateRangePicker(load);
  await load();
}

/* ─────────────────────────────────────────────
   TRENDS
───────────────────────────────────────────── */
async function initTrends() {
  const section = document.querySelector('.trends-section, [data-trends]');
  if (!section) return;

  try {
    const data   = await InsightsAPI.get('/trends');
    const trends = data.data || data || [];

    // Trending products table
    const tableContainer = section.querySelector('.trending-products, [data-trending-products]');
    if (tableContainer && Array.isArray(trends.products)) {
      tableContainer.innerHTML = `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Growth</th><th>Views</th></tr></thead>
            <tbody>
              ${trends.products.slice(0, 20).map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><a href="/pages/sourcing/product-detail.html?id=${p.id}">${p.name}</a></td>
                  <td>${p.category || '—'}</td>
                  <td class="text-success fw-bold">+${p.growth || 0}%</td>
                  <td>${(p.views || 0).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // Trending chart
    const canvas = section.querySelector('#trendsChart, [data-trends-chart]');
    if (canvas && trends.chartData) buildLineChart(canvas, trends.chartData, 'Search Trend', 'rgb(220,53,69)');
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   REPORTS
───────────────────────────────────────────── */
async function initInsightsReports() {
  const section    = document.querySelector('.insights-reports, [data-insights-reports]');
  const exportBtn  = document.querySelector('[data-export-csv], #exportCSV');
  if (!section) return;

  const load = async () => {
    const range = getDateRange();
    const canvas = section.querySelector('#reportsChart, [data-reports-chart]');

    try {
      const data    = await InsightsAPI.get(`/reports${range}`);
      const d       = data.data || data;
      const reports = d.rows || d || [];

      // Table
      const tableEl = section.querySelector('.reports-table, [data-reports-table]');
      if (tableEl) {
        const keys = reports.length ? Object.keys(reports[0]) : [];
        tableEl.innerHTML = `
          <div class="table-responsive">
            <table class="table table-hover table-sm">
              <thead><tr>${keys.map((k) => `<th>${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</th>`).join('')}</tr></thead>
              <tbody>
                ${reports.map((row) => `<tr>${keys.map((k) => `<td>${row[k] ?? '—'}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      }

      if (canvas && d.chartData) buildBarChart(canvas, d.chartData, 'Report Data');
    } catch (_) {}
  };

  // CSV export
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const range = getDateRange();
        const res   = await fetch(`/api/v1/insights/reports/export${range}`, { headers: InsightsAPI.headers() });
        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        a.href = url;
        a.download = `globexsky-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to export report.', 'error');
      }
    });
  }

  initDateRangePicker(load);
  await load();
}

/* ─────────────────────────────────────────────
   BUYER ANALYTICS
───────────────────────────────────────────── */
async function initBuyerAnalytics() {
  const section = document.querySelector('.buyer-analytics, [data-buyer-analytics]');
  if (!section) return;

  try {
    const data = await InsightsAPI.get('/buyer-analytics');
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="total-spend"]', d.totalSpend ? `$${parseFloat(d.totalSpend).toLocaleString()}` : '—');
    set('[data-stat="avg-order"]',   d.avgOrder   ? `$${parseFloat(d.avgOrder).toFixed(2)}` : '—');
    set('[data-stat="orders"]',      d.orderCount ?? '—');
    set('[data-stat="categories"]',  d.categoriesCount ?? '—');

    const c1 = section.querySelector('#spendChart, [data-spend-chart]');
    const c2 = section.querySelector('#categoryChart, [data-buyer-category-chart]');
    if (c1 && d.spendData)    buildLineChart(c1, d.spendData, 'Monthly Spend');
    if (c2 && d.categoryData) buildBarChart(c2, d.categoryData, 'Spend by Category', 'rgba(25,135,84,.6)');
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   SUPPLIER ANALYTICS
───────────────────────────────────────────── */
async function initSupplierAnalytics() {
  const section = document.querySelector('.supplier-analytics, [data-supplier-analytics]');
  if (!section) return;

  try {
    const data = await InsightsAPI.get('/supplier-analytics');
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="revenue"]',  d.totalRevenue ? `$${parseFloat(d.totalRevenue).toLocaleString()}` : '—');
    set('[data-stat="products"]', d.productCount ?? '—');
    set('[data-stat="orders"]',   d.orderCount   ?? '—');
    set('[data-stat="rating"]',   d.avgRating    ? `${parseFloat(d.avgRating).toFixed(1)}/5` : '—');

    const c1 = section.querySelector('#revenueChart, [data-revenue-chart]');
    const c2 = section.querySelector('#productChart, [data-product-perf-chart]');
    if (c1 && d.revenueData)  buildLineChart(c1, d.revenueData, 'Monthly Revenue');
    if (c2 && d.productData)  buildBarChart(c2, d.productData, 'Top Products', 'rgba(13,110,253,.6)');
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMarketInsights();
  initTrends();
  initInsightsReports();
  initBuyerAnalytics();
  initSupplierAnalytics();
});
