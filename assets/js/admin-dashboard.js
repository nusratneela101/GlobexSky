/**
 * Admin Dashboard JS
 * Loads live stats from the API and renders Chart.js charts.
 */

const API_BASE = window.API_BASE || '/api/v1';

async function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: await authHeaders() });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data;
  } catch (_) { return null; }
}

async function fetchRecentOrders() {
  try {
    const res = await fetch(`${API_BASE}/admin/orders?limit=5&page=1`, { headers: await authHeaders() });
    if (!res.ok) return [];
    const { data } = await res.json();
    return data || [];
  } catch (_) { return []; }
}

function updateMetricCard(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatCurrency(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function initDashboard() {
  const stats = await fetchDashboardStats();
  if (stats) {
    updateMetricCard('#stat-users', formatNumber(stats.total_users ?? 0));
    updateMetricCard('#stat-products', formatNumber(stats.total_products ?? 0));
    updateMetricCard('#stat-orders', formatNumber(stats.total_orders ?? 0));
    updateMetricCard('#stat-revenue', formatCurrency(stats.total_revenue ?? 0));
  }

  initRevenueChart();
  initOrderChart();
}

function initRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || !window.Chart) return;

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [42000, 55000, 48000, 63000, 71000, 85000, 67000];

  new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue ($)',
        data,
        borderColor: '#0052CC',
        backgroundColor: 'rgba(0,82,204,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#0052CC',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => `$${(v / 1000).toFixed(0)}K` },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function initOrderChart() {
  const canvas = document.getElementById('orderChart');
  if (!canvas || !window.Chart) return;

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [210, 275, 240, 315, 355, 425, 335];

  new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Orders',
        data,
        backgroundColor: 'rgba(0,82,204,0.7)',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } },
      },
    },
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
