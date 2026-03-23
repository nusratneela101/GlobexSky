/**
 * Globex Sky - dropshipping.js
 * Dropshipping section: dashboard stats, product browsing/import,
 * order management, profit analytics, supplier connections, markup settings.
 */

const DropshippingAPI = {
  BASE: '/api/v1/dropshipping',

  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },

  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
async function initDropshippingDashboard() {
  const section = document.querySelector('.dropshipping-dashboard, [data-dropshipping-dashboard]');
  if (!section) return;

  try {
    const data = await DropshippingAPI.get('/dashboard');
    const d = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="imported"]',  d.importedProducts ?? '—');
    set('[data-stat="orders"]',    d.totalOrders      ?? '—');
    set('[data-stat="revenue"]',   d.totalRevenue     ? `$${parseFloat(d.totalRevenue).toFixed(2)}` : '—');
    set('[data-stat="profit"]',    d.totalProfit      ? `$${parseFloat(d.totalProfit).toFixed(2)}` : '—');
    set('[data-stat="suppliers"]', d.connectedSuppliers ?? '—');

    // Recent orders
    const recentTable = section.querySelector('.recent-orders-table tbody');
    if (recentTable && Array.isArray(d.recentOrders)) {
      recentTable.innerHTML = d.recentOrders.slice(0, 5).map((o) => `
        <tr>
          <td>#${o.id}</td>
          <td>${o.product || '—'}</td>
          <td>$${parseFloat(o.revenue || 0).toFixed(2)}</td>
          <td class="text-success">$${parseFloat(o.profit || 0).toFixed(2)}</td>
          <td><span class="badge bg-${orderStatusColor(o.status)}">${o.status}</span></td>
        </tr>`).join('');
    }
  } catch (err) {
    console.warn('Dropshipping dashboard error:', err.message);
  }
}

function orderStatusColor(s) {
  const m = { pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'danger' };
  return m[(s || '').toLowerCase()] || 'secondary';
}

/* ─────────────────────────────────────────────
   PRODUCT BROWSER (import eligible products)
───────────────────────────────────────────── */
async function initDropshippingProducts() {
  const container  = document.querySelector('.dropship-products, [data-dropship-products]');
  const searchInput = document.querySelector('#dropshipSearch, [data-dropship-search]');
  const categoryFilter = document.querySelector('#dropshipCategory, [data-dropship-category]');
  if (!container) return;

  let page = 1;

  const load = async (append = false) => {
    const q        = searchInput?.value.trim() || '';
    const category = categoryFilter?.value || '';
    const params   = new URLSearchParams({ page, q, category });

    if (!append) container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    try {
      const data     = await DropshippingAPI.get(`/products?${params}`);
      const products = data.data || data.products || data || [];
      const html = products.map((p) => `
        <div class="col-sm-6 col-lg-4 col-xl-3">
          <div class="card product-card h-100">
            <img src="${p.image || '/assets/images/placeholder.png'}" class="card-img-top" alt="${p.name}" style="height:160px;object-fit:cover">
            <div class="card-body d-flex flex-column">
              <h6 class="card-title text-truncate">${p.name}</h6>
              <p class="text-muted small mb-1">${p.supplier || ''}</p>
              <p class="fw-bold text-primary mb-2">$${parseFloat(p.price || 0).toFixed(2)}</p>
              <div class="d-flex gap-2 mt-auto">
                <button class="btn btn-sm btn-primary flex-grow-1" data-import-product="${p.id}"
                  data-product-name="${p.name}" data-product-price="${p.price}">
                  Import
                </button>
                <a href="/pages/sourcing/product-detail.html?id=${p.id}" class="btn btn-sm btn-outline-secondary">View</a>
              </div>
            </div>
          </div>
        </div>`).join('');

      if (append) {
        const grid = container.querySelector('.row');
        if (grid) grid.insertAdjacentHTML('beforeend', html);
      } else {
        container.innerHTML = products.length
          ? `<div class="row g-3">${html}</div>`
          : '<p class="text-muted text-center py-5">No products found.</p>';
      }

      // Load more button
      const loadMore = document.querySelector('[data-load-more-dropship]');
      if (loadMore) loadMore.style.display = products.length < (data.per_page || 20) ? 'none' : 'block';
    } catch (_) {
      if (!append) container.innerHTML = '<p class="text-danger">Failed to load products.</p>';
    }
  };

  // Import product handler (event delegation)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-import-product]');
    if (!btn) return;
    const productId   = btn.dataset.importProduct;
    const productName = btn.dataset.productName;
    const origText    = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Importing…';
    try {
      const markup = parseFloat(document.querySelector('[data-markup-value]')?.value || '20');
      await DropshippingAPI.post('/import', { product_id: productId, markup_percentage: markup });
      if (typeof showToast === 'function') showToast(`${productName} imported to your store!`, 'success');
      btn.textContent = 'Imported ✓';
      btn.classList.replace('btn-primary', 'btn-success');
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Import failed.', 'error');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  // Search & filter
  let debounce;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { page = 1; load(); }, 400);
  });
  categoryFilter?.addEventListener('change', () => { page = 1; load(); });

  // Load more
  document.querySelector('[data-load-more-dropship]')?.addEventListener('click', () => { page++; load(true); });

  await load();
}

/* ─────────────────────────────────────────────
   DROPSHIPPING ORDERS
───────────────────────────────────────────── */
async function initDropshippingOrders() {
  const container = document.querySelector('.dropship-orders, [data-dropship-orders]');
  if (!container) return;

  try {
    const data   = await DropshippingAPI.get('/orders');
    const orders = data.data || data || [];

    container.innerHTML = orders.length
      ? `<div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr><th>Order ID</th><th>Product</th><th>Customer</th><th>Revenue</th><th>Profit</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${orders.map((o) => `
                <tr>
                  <td>#${o.id}</td>
                  <td>${o.product || '—'}</td>
                  <td>${o.customer || '—'}</td>
                  <td>$${parseFloat(o.revenue || 0).toFixed(2)}</td>
                  <td class="text-success">$${parseFloat(o.profit || 0).toFixed(2)}</td>
                  <td><span class="badge bg-${orderStatusColor(o.status)}">${o.status}</span></td>
                  <td>
                    <a href="/pages/account/order-detail.html?id=${o.id}" class="btn btn-sm btn-outline-primary">View</a>
                    ${o.status === 'processing' ? `<button class="btn btn-sm btn-outline-success ms-1" data-fulfill-order="${o.id}">Fulfill</button>` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="text-muted text-center py-5">No dropshipping orders yet.</p>';

    container.querySelectorAll('[data-fulfill-order]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await DropshippingAPI.post(`/orders/${btn.dataset.fulfillOrder}/fulfill`);
          if (typeof showToast === 'function') showToast('Order fulfilled!', 'success');
          initDropshippingOrders();
        } catch (_) {
          if (typeof showToast === 'function') showToast('Failed to fulfill order.', 'error');
        }
      });
    });
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load orders.</p>';
  }
}

/* ─────────────────────────────────────────────
   ANALYTICS / PROFIT CHARTS
───────────────────────────────────────────── */
async function initDropshippingAnalytics() {
  const canvas = document.querySelector('#dropshipProfitChart, [data-dropship-chart]');
  if (!canvas || typeof Chart === 'undefined') return;

  try {
    const data = await DropshippingAPI.get('/analytics');
    const d    = data.data || data;

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: d.labels || [],
        datasets: [
          { label: 'Revenue', data: d.revenue || [], backgroundColor: 'rgba(13,110,253,.5)', borderColor: 'rgba(13,110,253,1)', borderWidth: 1 },
          { label: 'Profit',  data: d.profit || [],  backgroundColor: 'rgba(25,135,84,.5)',  borderColor: 'rgba(25,135,84,1)',  borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Revenue vs Profit' } },
        scales: { y: { beginAtZero: true } },
      },
    });
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   SUPPLIERS
───────────────────────────────────────────── */
async function initDropshippingSuppliers() {
  const container = document.querySelector('.dropship-suppliers, [data-dropship-suppliers]');
  if (!container) return;

  try {
    const data      = await DropshippingAPI.get('/suppliers');
    const suppliers = data.data || data || [];

    container.innerHTML = suppliers.length
      ? `<div class="row g-3">` + suppliers.map((s) => `
        <div class="col-sm-6 col-md-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-3 mb-3">
                <img src="${s.logo || '/assets/images/placeholder.png'}" alt="${s.name}" width="48" height="48" style="border-radius:50%;object-fit:cover">
                <div>
                  <h6 class="mb-0">${s.name}</h6>
                  <small class="text-muted">${s.country || ''}</small>
                </div>
              </div>
              <p class="small text-muted">${s.description || ''}</p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-warning small">${'★'.repeat(Math.round(s.rating || 0))} ${s.rating || 0}/5</span>
                ${s.connected
                  ? '<span class="badge bg-success">Connected</span>'
                  : `<button class="btn btn-sm btn-outline-primary" data-connect-supplier="${s.id}">Connect</button>`}
              </div>
            </div>
          </div>
        </div>`).join('') + `</div>`
      : '<p class="text-muted text-center py-5">No suppliers found.</p>';

    container.querySelectorAll('[data-connect-supplier]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Connecting…';
        try {
          await DropshippingAPI.post('/suppliers/connect', { supplier_id: btn.dataset.connectSupplier });
          if (typeof showToast === 'function') showToast('Supplier connected!', 'success');
          btn.textContent = 'Connected ✓';
          btn.classList.replace('btn-outline-primary', 'btn-success');
        } catch (_) {
          if (typeof showToast === 'function') showToast('Failed to connect.', 'error');
          btn.disabled = false; btn.textContent = 'Connect';
        }
      });
    });
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load suppliers.</p>';
  }
}

/* ─────────────────────────────────────────────
   MARKUP SETTINGS
───────────────────────────────────────────── */
function initMarkupSettings() {
  const form = document.querySelector('#markupSettingsForm, [data-markup-form]');
  if (!form) return;

  const markupSlider  = form.querySelector('[name="markup_percentage"], [data-markup-slider]');
  const markupDisplay = form.querySelector('[data-markup-display]');

  if (markupSlider && markupDisplay) {
    markupDisplay.textContent = markupSlider.value + '%';
    markupSlider.addEventListener('input', () => { markupDisplay.textContent = markupSlider.value + '%'; });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      await DropshippingAPI.post('/settings', data);
      if (typeof showToast === 'function') showToast('Settings saved!', 'success');
    } catch (_) {
      if (typeof showToast === 'function') showToast('Failed to save settings.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDropshippingDashboard();
  initDropshippingProducts();
  initDropshippingOrders();
  initDropshippingAnalytics();
  initDropshippingSuppliers();
  initMarkupSettings();
});
