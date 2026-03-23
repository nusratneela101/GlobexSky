/**
 * Warehouse Management JS
 * Handles inventory operations, stock transfers, pick/pack/ship workflows,
 * low-stock alerts, and warehouse analytics.
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
  const el = document.getElementById('wh-toast');
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

/* ────────────────────────────────────────────────────────────
   WAREHOUSES
   ──────────────────────────────────────────────────────────── */
async function loadWarehouses() {
  setLoading('warehouseBody', 8);
  try {
    const res = await fetch(`${API_BASE}/warehouses`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load warehouses');
    const warehouses = json.data || [];
    const tbody = document.getElementById('warehouseBody');
    if (!tbody) return;
    tbody.innerHTML = warehouses.length
      ? warehouses.map(w => {
          const pct = w.capacity > 0 ? Math.round((w.used / w.capacity) * 100) : 0;
          const barColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f97316' : '#059669';
          const statusClass = w.status === 'active' ? 'badge-green' : w.status === 'maintenance' ? 'badge-orange' : 'badge-gray';
          return `
            <tr>
              <td><strong>${escHtml(w.name)}</strong></td>
              <td>${escHtml(w.code || '—')}</td>
              <td>${escHtml(w.location || '—')}</td>
              <td>${escHtml(w.country || '—')}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="flex:1;background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px;transition:width .4s"></div>
                  </div>
                  <span style="font-size:.78rem;color:#64748b;white-space:nowrap">${pct}% (${w.used ?? 0}/${w.capacity ?? 0})</span>
                </div>
              </td>
              <td><span class="badge-pill ${statusClass}">${escHtml(w.status || 'active')}</span></td>
              <td>${escHtml(w.manager_name || '—')}</td>
              <td>
                <button class="btn-sm btn-primary" onclick="openInventoryModal('${escHtml(w.id)}','${escHtml(w.name)}')"><i class="fas fa-boxes"></i> Inventory</button>
                <button class="btn-sm btn-secondary" onclick="openEditWarehouseModal('${escHtml(w.id)}')"><i class="fas fa-edit"></i></button>
                <button class="btn-sm btn-danger" onclick="deleteWarehouse('${escHtml(w.id)}')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8">No warehouses found.</td></tr>';
    updateWarehouseMetrics(warehouses);
    renderStorageChart(warehouses);
  } catch (err) {
    showToast(err.message, true);
  }
}

function updateWarehouseMetrics(warehouses) {
  const totalCount = warehouses.length;
  const totalCap = warehouses.reduce((s, w) => s + (w.capacity || 0), 0);
  const totalUsed = warehouses.reduce((s, w) => s + (w.used || 0), 0);
  const lowStockCount = warehouses.filter(w => (w.low_stock_items || 0) > 0).length;
  const utilPct = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('wh-total-count', totalCount);
  setEl('wh-utilization', `${utilPct}%`);
  setEl('wh-total-items', totalUsed.toLocaleString());
  setEl('wh-low-stock', lowStockCount);
}

function renderStorageChart(warehouses) {
  const ctx = document.getElementById('storageChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: warehouses.map(w => w.name || 'Unknown'),
      datasets: [
        { label: 'Used', data: warehouses.map(w => w.used || 0), backgroundColor: '#0052CC' },
        { label: 'Available', data: warehouses.map(w => Math.max(0, (w.capacity || 0) - (w.used || 0))), backgroundColor: '#e2e8f0' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { x: { stacked: true }, y: { stacked: true } },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   INVENTORY
   ──────────────────────────────────────────────────────────── */
async function openInventoryModal(warehouseId, warehouseName) {
  const modal = document.getElementById('inventoryModal');
  const title = document.getElementById('inventoryModalTitle');
  if (title) title.textContent = `Inventory — ${warehouseName}`;
  if (modal) modal.classList.add('open');
  loadInventory(warehouseId);
  if (document.getElementById('stockWarehouseId')) {
    document.getElementById('stockWarehouseId').value = warehouseId;
  }
}

async function loadInventory(warehouseId) {
  setLoading('inventoryBody', 6);
  try {
    const res = await fetch(`${API_BASE}/warehouses/${warehouseId}/inventory`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load inventory');
    const items = json.data || [];
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = items.length
      ? items.map(item => {
          const stockClass = item.quantity <= item.reorder_point ? 'badge-red' : item.quantity <= item.reorder_point * 2 ? 'badge-orange' : 'badge-green';
          return `
            <tr>
              <td>${escHtml(item.sku || '—')}</td>
              <td>${escHtml(item.product_name || '—')}</td>
              <td><span class="badge-pill ${stockClass}">${item.quantity ?? 0}</span></td>
              <td>${escHtml(item.location_code || '—')}</td>
              <td>${item.reorder_point ?? '—'}</td>
              <td>
                <button class="btn-sm btn-primary" onclick="stockOperation('in','${escHtml(item.product_id)}')">+ In</button>
                <button class="btn-sm btn-warning" onclick="stockOperation('out','${escHtml(item.product_id)}')">- Out</button>
                <button class="btn-sm btn-secondary" onclick="openTransferModal('${escHtml(item.product_id)}','${escHtml(item.product_name)}')">Transfer</button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8">No inventory items.</td></tr>';
    renderTurnoverChart(items);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderTurnoverChart(items) {
  const ctx = document.getElementById('turnoverChart');
  if (!ctx || typeof Chart === 'undefined' || !items.length) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const top10 = items.slice(0, 10);
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(i => i.sku || i.product_name || 'Item'),
      datasets: [{ label: 'Turnover Rate', data: top10.map(i => i.turnover_rate || 0), backgroundColor: '#7c3aed' }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

/* ────────────────────────────────────────────────────────────
   STOCK IN / OUT
   ──────────────────────────────────────────────────────────── */
async function stockOperation(type, productId) {
  const qty = parseInt(prompt(`Enter quantity to stock ${type}:`) || '0', 10);
  if (!qty || qty <= 0) return;
  const warehouseId = document.getElementById('stockWarehouseId')?.value;
  if (!warehouseId) { showToast('No warehouse selected', true); return; }
  try {
    const res = await fetch(`${API_BASE}/warehouses/${warehouseId}/inventory`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ product_id: productId, quantity: type === 'in' ? qty : -qty, type }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Operation failed');
    showToast(`Stock ${type} recorded successfully`);
    loadInventory(warehouseId);
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   STOCK TRANSFER
   ──────────────────────────────────────────────────────────── */
function openTransferModal(productId, productName) {
  const modal = document.getElementById('transferModal');
  if (!modal) return;
  if (document.getElementById('transferProductId')) document.getElementById('transferProductId').value = productId;
  if (document.getElementById('transferProductName')) document.getElementById('transferProductName').textContent = productName;
  modal.classList.add('open');
}

async function submitTransfer(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    source_warehouse_id: form.source_warehouse_id?.value,
    destination_warehouse_id: form.destination_warehouse_id?.value,
    product_id: form.product_id?.value,
    quantity: parseInt(form.quantity?.value || '0', 10),
  };
  try {
    const res = await fetch(`${API_BASE}/warehouses/transfer`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Transfer failed');
    showToast('Stock transferred successfully');
    document.getElementById('transferModal')?.classList.remove('open');
    loadWarehouses();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   CREATE / EDIT WAREHOUSE
   ──────────────────────────────────────────────────────────── */
function openCreateWarehouseModal() {
  const modal = document.getElementById('warehouseModal');
  if (!modal) return;
  const form = document.getElementById('warehouseForm');
  if (form) { form.reset(); delete form.dataset.editId; }
  const title = document.getElementById('warehouseModalTitle');
  if (title) title.textContent = 'Add Warehouse';
  modal.classList.add('open');
}

async function openEditWarehouseModal(warehouseId) {
  const modal = document.getElementById('warehouseModal');
  if (!modal) return;
  try {
    const res = await fetch(`${API_BASE}/warehouses/${warehouseId}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load warehouse');
    const w = json.data;
    const form = document.getElementById('warehouseForm');
    if (form) {
      form.dataset.editId = warehouseId;
      ['name', 'code', 'location', 'country', 'capacity', 'manager_name', 'status'].forEach(k => {
        if (form[k]) form[k].value = w[k] ?? '';
      });
    }
    const title = document.getElementById('warehouseModalTitle');
    if (title) title.textContent = 'Edit Warehouse';
    modal.classList.add('open');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function saveWarehouse(e) {
  e.preventDefault();
  const form = e.target;
  const editId = form.dataset.editId;
  const payload = {
    name: form.name?.value?.trim(),
    code: form.code?.value?.trim(),
    location: form.location?.value?.trim(),
    country: form.country?.value?.trim(),
    capacity: parseInt(form.capacity?.value || '0', 10),
    manager_name: form.manager_name?.value?.trim(),
    status: form.status?.value,
  };
  try {
    const url = editId ? `${API_BASE}/warehouses/${editId}` : `${API_BASE}/warehouses`;
    const res = await fetch(url, {
      method: editId ? 'PUT' : 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Save failed');
    showToast(editId ? 'Warehouse updated' : 'Warehouse created');
    document.getElementById('warehouseModal')?.classList.remove('open');
    loadWarehouses();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteWarehouse(id) {
  if (!confirm('Delete this warehouse? This action cannot be undone.')) return;
  try {
    const res = await fetch(`${API_BASE}/warehouses/${id}`, { method: 'DELETE', headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Delete failed');
    showToast('Warehouse deleted');
    loadWarehouses();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   LOW STOCK ALERTS
   ──────────────────────────────────────────────────────────── */
async function loadLowStockAlerts() {
  const container = document.getElementById('lowStockAlerts');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/admin/inventory/low-stock`, { headers: await authHeaders() });
    const json = await res.json();
    const items = json.data || [];
    container.innerHTML = items.length
      ? items.map(item => `
          <div class="alert-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9">
            <div>
              <strong>${escHtml(item.product_name)}</strong>
              <span style="font-size:.78rem;color:#64748b;margin-left:8px">SKU: ${escHtml(item.sku)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge-pill badge-red">Qty: ${item.quantity}</span>
              <button class="btn-sm btn-primary" onclick="triggerReorder('${escHtml(item.product_id)}')">Reorder</button>
            </div>
          </div>`).join('')
      : '<p style="color:#94a3b8;text-align:center;padding:20px">No low stock alerts.</p>';
  } catch (_) {
    if (container) container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">Unable to load alerts.</p>';
  }
}

async function triggerReorder(productId) {
  try {
    const res = await fetch(`${API_BASE}/admin/inventory/reorder`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ product_id: productId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Reorder failed');
    showToast('Reorder triggered successfully');
    loadLowStockAlerts();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   PICK / PACK / SHIP
   ──────────────────────────────────────────────────────────── */
async function loadPickPackShip() {
  setLoading('pickPackBody', 7);
  try {
    const res = await fetch(`${API_BASE}/admin/fulfillment/orders`, { headers: await authHeaders() });
    const json = await res.json();
    const orders = json.data || [];
    const tbody = document.getElementById('pickPackBody');
    if (!tbody) return;
    tbody.innerHTML = orders.length
      ? orders.map(o => {
          const stageMap = { picking: 'badge-blue', packing: 'badge-orange', shipping: 'badge-teal', shipped: 'badge-green' };
          return `
            <tr>
              <td><strong>#${escHtml(o.order_number || o.id?.slice(0, 8))}</strong></td>
              <td>${escHtml(o.customer_name || '—')}</td>
              <td>${escHtml(o.warehouse_name || '—')}</td>
              <td>${o.items_count ?? 0} items</td>
              <td><span class="badge-pill ${stageMap[o.stage] || 'badge-gray'}">${escHtml(o.stage || 'pending')}</span></td>
              <td>${o.due_date ? new Date(o.due_date).toLocaleDateString() : '—'}</td>
              <td>
                <button class="btn-sm btn-primary" onclick="advanceStage('${escHtml(o.id)}','${escHtml(o.stage)}')">Advance</button>
                <button class="btn-sm btn-secondary" onclick="printPickList('${escHtml(o.id)}')"><i class="fas fa-print"></i></button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">No pending fulfillment orders.</td></tr>';
  } catch (err) {
    showToast(err.message, true);
  }
}

async function advanceStage(orderId, currentStage) {
  const nextStage = { picking: 'packing', packing: 'shipping', shipping: 'shipped' };
  const next = nextStage[currentStage];
  if (!next) { showToast('Order already shipped'); return; }
  try {
    const res = await fetch(`${API_BASE}/admin/fulfillment/orders/${orderId}/stage`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ stage: next }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Stage update failed');
    showToast(`Order moved to ${next}`);
    loadPickPackShip();
  } catch (err) {
    showToast(err.message, true);
  }
}

function printPickList(orderId) {
  window.open(`${API_BASE}/admin/fulfillment/orders/${orderId}/picklist?print=1`, '_blank');
}

/* ────────────────────────────────────────────────────────────
   ANALYTICS
   ──────────────────────────────────────────────────────────── */
async function loadWarehouseAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/admin/warehouse/analytics`, { headers: await authHeaders() });
    const json = await res.json();
    const data = json.data || {};
    renderStorageCostChart(data.storage_costs || []);
    renderThroughputChart(data.throughput || []);
  } catch (_) { /* show placeholder charts */ }
}

function renderStorageCostChart(data) {
  const ctx = document.getElementById('storageCostChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  ctx._chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month || ''),
      datasets: [{ label: 'Storage Cost ($)', data: data.map(d => d.cost || 0), borderColor: '#0052CC', backgroundColor: 'rgba(0,82,204,.1)', fill: true, tension: 0.4 }],
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } },
  });
}

function renderThroughputChart(data) {
  const ctx = document.getElementById('throughputChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.warehouse || ''),
      datasets: [
        { label: 'Inbound', data: data.map(d => d.inbound || 0), backgroundColor: '#059669' },
        { label: 'Outbound', data: data.map(d => d.outbound || 0), backgroundColor: '#ef4444' },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: false } } },
  });
}

/* ────────────────────────────────────────────────────────────
   SEARCH / FILTER
   ──────────────────────────────────────────────────────────── */
function filterWarehouses() {
  const search = (document.getElementById('searchWarehouse')?.value || '').toLowerCase();
  const country = (document.getElementById('filterCountry')?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#warehouseBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchCountry = !country || text.includes(country);
    row.style.display = matchSearch && matchCountry ? '' : 'none';
  });
}

/* ────────────────────────────────────────────────────────────
   MODAL HELPERS
   ──────────────────────────────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadWarehouses();
  loadLowStockAlerts();
  loadPickPackShip();
  loadWarehouseAnalytics();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  document.getElementById('warehouseForm')?.addEventListener('submit', saveWarehouse);
  document.getElementById('transferForm')?.addEventListener('submit', submitTransfer);

  document.getElementById('searchWarehouse')?.addEventListener('input', filterWarehouses);
  document.getElementById('filterCountry')?.addEventListener('change', filterWarehouses);
});
