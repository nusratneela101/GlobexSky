/**
 * Campaign Manager JS
 * Flash sale creation, Deal of the Day, coupon/promo codes,
 * bundle deals, campaign analytics, and auto-scheduling.
 */

const API_BASE = window.API_BASE || '/api/v1';

async function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function showToast(msg, isError = false) {
  const el = document.getElementById('cm-toast');
  if (!el) return;
  const icon = isError ? 'fa-exclamation-circle' : 'fa-check-circle';
  const color = isError ? '#ef4444' : '#00C9A7';
  el.innerHTML = `<i class="fas ${icon}" style="color:${color};margin-right:6px"></i>${escHtml(msg)}`;
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.transform = 'translateY(80px)'; el.style.opacity = '0'; }, 3500);
}

function setLoading(tableId, cols) {
  const el = document.getElementById(tableId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:#94a3b8">Loading…</td></tr>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

/* ────────────────────────────────────────────────────────────
   CAMPAIGNS
   ──────────────────────────────────────────────────────────── */
async function loadCampaigns() {
  setLoading('campaignBody', 8);
  try {
    const res = await fetch(`${API_BASE}/campaigns`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load campaigns');
    const campaigns = json.data || [];
    renderCampaignsTable(campaigns);
    updateCampaignMetrics(campaigns);
    renderCampaignAnalyticsChart(campaigns);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderCampaignsTable(campaigns) {
  const tbody = document.getElementById('campaignBody');
  if (!tbody) return;
  tbody.innerHTML = campaigns.length
    ? campaigns.map(c => {
        const statusMap = {
          active: 'badge-green', scheduled: 'badge-blue',
          ended: 'badge-gray', cancelled: 'badge-red', draft: 'badge-orange',
        };
        const typeMap = {
          flash_sale: 'badge-red', coupon: 'badge-blue', bundle: 'badge-purple',
          deal_of_day: 'badge-orange', bogo: 'badge-teal',
        };
        const now = new Date();
        const end = c.ends_at ? new Date(c.ends_at) : null;
        const isLive = c.status === 'active' && end && end > now;
        return `
          <tr>
            <td><strong>${escHtml(c.name)}</strong>${isLive ? ' <span class="badge-pill badge-red" style="font-size:.7rem">LIVE</span>' : ''}</td>
            <td><span class="badge-pill ${typeMap[c.type] || 'badge-gray'}">${escHtml(c.type?.replace(/_/g, ' ') || '—')}</span></td>
            <td>${escHtml(c.discount_value ? (c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`) : '—')}</td>
            <td>${formatDate(c.starts_at)}</td>
            <td>${formatDate(c.ends_at)}</td>
            <td><span class="badge-pill ${statusMap[c.status] || 'badge-gray'}">${escHtml(c.status || '—')}</span></td>
            <td>${(c.orders_count ?? 0).toLocaleString()}</td>
            <td>
              <button class="btn-sm btn-primary" onclick="viewCampaignAnalytics('${escHtml(c.id)}','${escHtml(c.name)}')"><i class="fas fa-chart-bar"></i></button>
              <button class="btn-sm btn-secondary" onclick="editCampaign('${escHtml(c.id)}')"><i class="fas fa-edit"></i></button>
              <button class="btn-sm btn-danger" onclick="deleteCampaign('${escHtml(c.id)}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8">No campaigns found.</td></tr>';
}

function updateCampaignMetrics(campaigns) {
  const active = campaigns.filter(c => c.status === 'active').length;
  const scheduled = campaigns.filter(c => c.status === 'scheduled').length;
  const totalOrders = campaigns.reduce((s, c) => s + (c.orders_count || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue || 0), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('cm-active-count', active);
  setEl('cm-scheduled-count', scheduled);
  setEl('cm-total-orders', totalOrders.toLocaleString());
  setEl('cm-total-revenue', `$${totalRevenue.toLocaleString()}`);
}

function renderCampaignAnalyticsChart(campaigns) {
  const ctx = document.getElementById('campaignChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const topCampaigns = campaigns.slice(0, 8);
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCampaigns.map(c => c.name?.slice(0, 15) || 'Campaign'),
      datasets: [
        { label: 'Orders', data: topCampaigns.map(c => c.orders_count || 0), backgroundColor: '#0052CC', yAxisID: 'y' },
        { label: 'Revenue ($)', data: topCampaigns.map(c => c.revenue || 0), backgroundColor: '#059669', yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { type: 'linear', position: 'left', beginAtZero: true },
        y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   CREATE / EDIT CAMPAIGN
   ──────────────────────────────────────────────────────────── */
function openCreateCampaignModal(type = '') {
  const modal = document.getElementById('campaignModal');
  if (!modal) return;
  const form = document.getElementById('campaignForm');
  if (form) { form.reset(); delete form.dataset.editId; }
  const title = document.getElementById('campaignModalTitle');
  if (title) title.textContent = 'Create Campaign';
  if (type && form) { const typeEl = form.querySelector('[name="type"]'); if (typeEl) typeEl.value = type; }
  toggleDiscountFields();
  modal.classList.add('open');
}

async function editCampaign(campaignId) {
  try {
    const res = await fetch(`${API_BASE}/campaigns/${campaignId}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load campaign');
    const c = json.data;
    const form = document.getElementById('campaignForm');
    if (form) {
      form.dataset.editId = campaignId;
      ['name', 'type', 'discount_type', 'discount_value', 'max_uses', 'min_order_amount', 'status'].forEach(k => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) el.value = c[k] ?? '';
      });
      if (c.starts_at) { const el = form.querySelector('[name="starts_at"]'); if (el) el.value = c.starts_at.slice(0, 16); }
      if (c.ends_at) { const el = form.querySelector('[name="ends_at"]'); if (el) el.value = c.ends_at.slice(0, 16); }
      toggleDiscountFields();
    }
    const title = document.getElementById('campaignModalTitle');
    if (title) title.textContent = 'Edit Campaign';
    document.getElementById('campaignModal')?.classList.add('open');
  } catch (err) {
    showToast(err.message, true);
  }
}

function toggleDiscountFields() {
  const form = document.getElementById('campaignForm');
  if (!form) return;
  const type = form.querySelector('[name="type"]')?.value;
  const discountRow = document.getElementById('discountRow');
  const freeShippingRow = document.getElementById('freeShippingRow');
  if (discountRow) discountRow.style.display = type === 'free_shipping' ? 'none' : '';
  if (freeShippingRow) freeShippingRow.style.display = type === 'free_shipping' ? '' : 'none';
}

async function saveCampaign(e) {
  e.preventDefault();
  const form = e.target;
  const editId = form.dataset.editId;
  const payload = {
    name: form.querySelector('[name="name"]')?.value?.trim(),
    type: form.querySelector('[name="type"]')?.value,
    discount_type: form.querySelector('[name="discount_type"]')?.value,
    discount_value: parseFloat(form.querySelector('[name="discount_value"]')?.value || '0'),
    starts_at: form.querySelector('[name="starts_at"]')?.value,
    ends_at: form.querySelector('[name="ends_at"]')?.value,
    max_uses: parseInt(form.querySelector('[name="max_uses"]')?.value || '0', 10) || null,
    min_order_amount: parseFloat(form.querySelector('[name="min_order_amount"]')?.value || '0') || null,
    status: form.querySelector('[name="status"]')?.value || 'draft',
  };
  try {
    const url = editId ? `${API_BASE}/campaigns/${editId}` : `${API_BASE}/campaigns`;
    const res = await fetch(url, {
      method: editId ? 'PUT' : 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Save failed');
    showToast(editId ? 'Campaign updated' : 'Campaign created');
    document.getElementById('campaignModal')?.classList.remove('open');
    loadCampaigns();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  try {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE', headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Delete failed');
    showToast('Campaign deleted');
    loadCampaigns();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   FLASH SALES
   ──────────────────────────────────────────────────────────── */
async function loadFlashSales() {
  setLoading('flashSaleBody', 7);
  try {
    const res = await fetch(`${API_BASE}/flash-sales/upcoming`, { headers: await authHeaders() });
    const json = await res.json();
    const sales = json.data || [];
    const tbody = document.getElementById('flashSaleBody');
    if (!tbody) return;
    tbody.innerHTML = sales.length
      ? sales.map(s => {
          const statusMap = { active: 'badge-red', scheduled: 'badge-blue', ended: 'badge-gray', draft: 'badge-orange' };
          return `
            <tr>
              <td><strong>${escHtml(s.name)}</strong></td>
              <td>${escHtml(s.discount_pct ? `${s.discount_pct}% off` : '—')}</td>
              <td>${formatDate(s.starts_at)}</td>
              <td>${formatDate(s.ends_at)}</td>
              <td><div id="fs-countdown-${escHtml(s.id)}" class="countdown-badge">—</div></td>
              <td><span class="badge-pill ${statusMap[s.status] || 'badge-gray'}">${escHtml(s.status || 'draft')}</span></td>
              <td>
                <button class="btn-sm btn-primary" onclick="editFlashSale('${escHtml(s.id)}')"><i class="fas fa-edit"></i></button>
                <button class="btn-sm btn-danger" onclick="cancelFlashSale('${escHtml(s.id)}')"><i class="fas fa-times"></i></button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">No flash sales.</td></tr>';
    startCountdowns(sales);
  } catch (err) {
    showToast(err.message, true);
  }
}

function startCountdowns(sales) {
  const updateAll = () => {
    const now = new Date();
    sales.forEach(s => {
      const el = document.getElementById(`fs-countdown-${s.id}`);
      if (!el) return;
      const target = s.status === 'scheduled' ? new Date(s.starts_at) : new Date(s.ends_at);
      const diff = target - now;
      if (diff <= 0) { el.textContent = s.status === 'scheduled' ? 'Started' : 'Ended'; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      el.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`;
      el.style.color = diff < 3600000 ? '#ef4444' : diff < 86400000 ? '#f97316' : '#059669';
    });
  };
  updateAll();
  const interval = setInterval(() => {
    if (!document.getElementById(`fs-countdown-${sales[0]?.id}`)) { clearInterval(interval); return; }
    updateAll();
  }, 1000);
}

function openCreateFlashSaleModal() {
  openCreateCampaignModal('flash_sale');
}

async function editFlashSale(id) {
  await editCampaign(id);
}

async function cancelFlashSale(id) {
  if (!confirm('Cancel this flash sale?')) return;
  await deleteCampaign(id);
  loadFlashSales();
}

/* ────────────────────────────────────────────────────────────
   COUPONS
   ──────────────────────────────────────────────────────────── */
async function loadCoupons() {
  setLoading('couponBody', 7);
  try {
    const res = await fetch(`${API_BASE}/admin/coupons`, { headers: await authHeaders() });
    const json = await res.json();
    const coupons = json.data || [];
    const tbody = document.getElementById('couponBody');
    if (!tbody) return;
    tbody.innerHTML = coupons.length
      ? coupons.map(c => {
          const discountLabel = c.discount_type === 'percentage' ? `${c.discount_value}% off`
            : c.discount_type === 'fixed' ? `$${c.discount_value} off`
            : c.discount_type === 'free_shipping' ? 'Free Shipping'
            : c.discount_type === 'bogo' ? 'Buy 1 Get 1'
            : escHtml(c.discount_type || '—');
          const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
          return `
            <tr>
              <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.85rem">${escHtml(c.code)}</code></td>
              <td>${discountLabel}</td>
              <td>${c.used_count ?? 0} / ${c.max_uses ?? '∞'}</td>
              <td>${c.min_order_amount ? `$${c.min_order_amount}` : '—'}</td>
              <td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
              <td><span class="badge-pill ${isExpired ? 'badge-red' : c.is_active ? 'badge-green' : 'badge-gray'}">${isExpired ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>
                <button class="btn-sm btn-secondary" onclick="copyCouponCode('${escHtml(c.code)}')"><i class="fas fa-copy"></i></button>
                <button class="btn-sm btn-danger" onclick="deactivateCoupon('${escHtml(c.id)}')"><i class="fas fa-ban"></i></button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">No coupons found.</td></tr>';
  } catch (err) {
    showToast(err.message, true);
  }
}

function copyCouponCode(code) {
  navigator.clipboard.writeText(code).then(() => showToast('Coupon code copied!'), () => showToast('Copy failed', true));
}

async function deactivateCoupon(id) {
  if (!confirm('Deactivate this coupon?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ is_active: false }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to deactivate coupon');
    showToast('Coupon deactivated');
    loadCoupons();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function generateCoupon(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    code: form.querySelector('[name="code"]')?.value?.trim().toUpperCase(),
    discount_type: form.querySelector('[name="discount_type"]')?.value,
    discount_value: parseFloat(form.querySelector('[name="discount_value"]')?.value || '0'),
    min_order_amount: parseFloat(form.querySelector('[name="min_order_amount"]')?.value || '0') || null,
    max_uses: parseInt(form.querySelector('[name="max_uses"]')?.value || '0', 10) || null,
    expires_at: form.querySelector('[name="expires_at"]')?.value || null,
    applies_to: form.querySelector('[name="applies_to"]')?.value,
  };
  try {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Coupon creation failed');
    showToast('Coupon created successfully');
    document.getElementById('couponModal')?.classList.remove('open');
    loadCoupons();
  } catch (err) {
    showToast(err.message, true);
  }
}

function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const el = document.querySelector('[name="code"]');
  if (el) el.value = code;
}

/* ────────────────────────────────────────────────────────────
   BUNDLE DEALS
   ──────────────────────────────────────────────────────────── */
async function loadBundles() {
  setLoading('bundleBody', 6);
  try {
    const res = await fetch(`${API_BASE}/admin/bundles`, { headers: await authHeaders() });
    const json = await res.json();
    const bundles = json.data || [];
    const tbody = document.getElementById('bundleBody');
    if (!tbody) return;
    tbody.innerHTML = bundles.length
      ? bundles.map(b => `
          <tr>
            <td><strong>${escHtml(b.name)}</strong></td>
            <td>${(b.products || []).length} products</td>
            <td>$${escHtml(String(b.bundle_price ?? '—'))}</td>
            <td>$${escHtml(String(b.original_price ?? '—'))}</td>
            <td><span class="badge-pill ${b.is_active ? 'badge-green' : 'badge-gray'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <button class="btn-sm btn-secondary" onclick="editBundle('${escHtml(b.id)}')"><i class="fas fa-edit"></i></button>
              <button class="btn-sm btn-danger" onclick="deleteBundle('${escHtml(b.id)}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8">No bundle deals.</td></tr>';
  } catch (_) { /* bundles endpoint may not exist yet */ }
}

async function deleteBundle(id) {
  if (!confirm('Delete this bundle?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/bundles/${id}`, { method: 'DELETE', headers: await authHeaders() });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Bundle deleted');
    loadBundles();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function editBundle(id) {
  showToast('Edit bundle coming soon');
}

/* ────────────────────────────────────────────────────────────
   CAMPAIGN ANALYTICS
   ──────────────────────────────────────────────────────────── */
async function viewCampaignAnalytics(campaignId, campaignName) {
  const modal = document.getElementById('analyticsModal');
  const title = document.getElementById('analyticsModalTitle');
  if (title) title.textContent = `Analytics — ${campaignName}`;
  if (modal) modal.classList.add('open');
  try {
    const res = await fetch(`${API_BASE}/flash-sales/${campaignId}/analytics`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load analytics');
    const data = json.data || {};
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('ca-impressions', (data.impressions ?? 0).toLocaleString());
    setEl('ca-clicks', (data.clicks ?? 0).toLocaleString());
    setEl('ca-orders', (data.orders_count ?? 0).toLocaleString());
    setEl('ca-revenue', `$${(data.revenue ?? 0).toLocaleString()}`);
    setEl('ca-conversion', data.conversion_rate ? `${data.conversion_rate}%` : '—');
    renderCampaignTimelineChart(data.timeline || []);
  } catch (_) { /* show placeholder */ }
}

function renderCampaignTimelineChart(timeline) {
  const ctx = document.getElementById('campaignTimelineChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  ctx._chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeline.map(d => d.date || ''),
      datasets: [
        { label: 'Orders', data: timeline.map(d => d.orders || 0), borderColor: '#0052CC', backgroundColor: 'rgba(0,82,204,.1)', fill: true, tension: 0.4 },
        { label: 'Revenue ($)', data: timeline.map(d => d.revenue || 0), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.1)', fill: true, tension: 0.4, yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { type: 'linear', position: 'left', beginAtZero: true },
        y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   TAB SWITCHING
   ──────────────────────────────────────────────────────────── */
function switchTab(tabId) {
  document.querySelectorAll('.cm-tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.cm-tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.style.display = '';
  document.querySelector(`.cm-tab-btn[data-tab="${tabId}"]`)?.classList.add('active');

  if (tabId === 'tab-flash-sales') loadFlashSales();
  else if (tabId === 'tab-coupons') loadCoupons();
  else if (tabId === 'tab-bundles') loadBundles();
  else if (tabId === 'tab-campaigns') loadCampaigns();
}

/* ────────────────────────────────────────────────────────────
   MODAL HELPERS
   ──────────────────────────────────────────────────────────── */
function openCouponModal() {
  const modal = document.getElementById('couponModal');
  if (!modal) return;
  document.getElementById('couponForm')?.reset();
  modal.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadCampaigns();

  document.getElementById('campaignForm')?.addEventListener('submit', saveCampaign);
  document.getElementById('couponForm')?.addEventListener('submit', generateCoupon);

  document.querySelectorAll('.cm-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  document.getElementById('campaignForm')?.querySelector('[name="type"]')?.addEventListener('change', toggleDiscountFields);
  document.getElementById('generateCodeBtn')?.addEventListener('click', generateRandomCode);
});
