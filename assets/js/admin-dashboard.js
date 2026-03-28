/**
 * Admin Dashboard JS
 * Loads real stats from Supabase and renders Chart.js charts.
 *
 * Depends on:
 *   - Supabase CDN + supabaseClient (initialized by config.js)
 */

const SUPABASE_URL      = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

function _sb() {
  return window.supabaseClient ||
    (window.supabase && window.supabase.createClient &&
      window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
}

async function checkAdminAccess() {
  const sb = _sb();
  if (!sb) return false;
  const { data: { user } } = await sb.auth.getUser().catch(() => ({ data: {} }));
  if (!user) {
    window.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(window.location.href);
    return false;
  }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single().catch(() => ({ data: null }));
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

async function fetchDashboardStats() {
  const sb = _sb();
  if (!sb) return null;
  try {
    const [usersRes, productsRes, ordersRes] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('products').select('id', { count: 'exact', head: true }),
      sb.from('orders').select('id,total_amount,created_at'),
    ]);
    const totalRevenue = (ordersRes.data || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
    return {
      total_users:    usersRes.count    || 0,
      total_products: productsRes.count || 0,
      total_orders:   (ordersRes.data || []).length,
      total_revenue:  totalRevenue,
    };
  } catch (_) { return null; }
}

async function fetchRecentOrders() {
  const sb = _sb();
  if (!sb) return [];
  try {
    const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
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
  return `$${Number(n).toFixed(0)}`;
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function initDashboard() {
  const isAdmin = await checkAdminAccess();
  if (!isAdmin) return;

  const stats = await fetchDashboardStats();
  if (stats) {
    updateMetricCard('#stat-users',    formatNumber(stats.total_users));
    updateMetricCard('#stat-products', formatNumber(stats.total_products));
    updateMetricCard('#stat-orders',   formatNumber(stats.total_orders));
    updateMetricCard('#stat-revenue',  formatCurrency(stats.total_revenue));
  }

  // Render recent orders table
  const recentOrders = await fetchRecentOrders();
  const tbody = document.querySelector('#recent-orders-table tbody, .recent-orders tbody');
  if (tbody && recentOrders.length > 0) {
    tbody.innerHTML = recentOrders.map(function(o) {
      const shortId = String(o.id || '').substring(0, 8);
      const date    = new Date(o.created_at).toLocaleDateString();
      const total   = '$' + Number(o.total_amount || 0).toFixed(2);
      const status  = o.status || 'pending';
      return `<tr>
        <td>#${shortId}…</td>
        <td>${date}</td>
        <td>${total}</td>
        <td><span style="padding:2px 8px;border-radius:10px;font-size:.78rem;background:#dbeafe;color:#1e40af">${status}</span></td>
        <td><a href="/pages/order/details.html?id=${o.id}" style="color:#0052CC;font-size:.82rem">View</a></td>
      </tr>`;
    }).join('');
  }

  initRevenueChart(recentOrders);
  initOrderChart(recentOrders);
}

function initRevenueChart(orders) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || !window.Chart) return;

  // Build last 7 days data from real orders
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayData = new Array(7).fill(0);
  const today = new Date();
  (orders || []).forEach(function(o) {
    const d = new Date(o.created_at);
    const diff = Math.floor((today - d) / 86400000);
    if (diff < 7) dayData[6 - diff] += Number(o.total_amount || 0);
  });
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  });

  try {
    new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue ($)',
          data: dayData,
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
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => `$${(v/1000).toFixed(1)}K` } },
          x: { grid: { display: false } },
        },
      },
    });
  } catch(e) { console.warn('[Admin] Chart error:', e.message); }
}

function initOrderChart(orders) {
  const canvas = document.getElementById('orderChart');
  if (!canvas || !window.Chart) return;

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayData = new Array(7).fill(0);
  const today = new Date();
  (orders || []).forEach(function(o) {
    const diff = Math.floor((today - new Date(o.created_at)) / 86400000);
    if (diff < 7) dayData[6 - diff]++;
  });
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  });

  try {
    new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Orders',
          data: dayData,
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
  } catch(e) { console.warn('[Admin] Chart error:', e.message); }
}

document.addEventListener('DOMContentLoaded', initDashboard);
