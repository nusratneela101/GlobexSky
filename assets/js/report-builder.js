/**
 * Custom Report Builder JS
 * Drag-and-drop report builder with metric/dimension selection,
 * chart type picker, date range presets, export, and saving.
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
  const el = document.getElementById('rb-toast');
  if (!el) return;
  const icon = isError ? 'fa-exclamation-circle' : 'fa-check-circle';
  const color = isError ? '#ef4444' : '#00C9A7';
  el.innerHTML = `<i class="fas ${icon}" style="color:${color};margin-right:6px"></i>${escHtml(msg)}`;
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.transform = 'translateY(80px)'; el.style.opacity = '0'; }, 3500);
}

/* ────────────────────────────────────────────────────────────
   AVAILABLE METRICS & DIMENSIONS
   ──────────────────────────────────────────────────────────── */
const AVAILABLE_METRICS = [
  { id: 'total_revenue', label: 'Total Revenue', icon: 'fa-dollar-sign', category: 'Financial' },
  { id: 'net_profit', label: 'Net Profit', icon: 'fa-chart-line', category: 'Financial' },
  { id: 'gross_margin', label: 'Gross Margin %', icon: 'fa-percentage', category: 'Financial' },
  { id: 'orders_count', label: 'Orders Count', icon: 'fa-shopping-cart', category: 'Sales' },
  { id: 'avg_order_value', label: 'Avg Order Value', icon: 'fa-coins', category: 'Sales' },
  { id: 'conversion_rate', label: 'Conversion Rate', icon: 'fa-funnel-dollar', category: 'Sales' },
  { id: 'new_users', label: 'New Users', icon: 'fa-user-plus', category: 'Users' },
  { id: 'active_users', label: 'Active Users', icon: 'fa-users', category: 'Users' },
  { id: 'page_views', label: 'Page Views', icon: 'fa-eye', category: 'Traffic' },
  { id: 'bounce_rate', label: 'Bounce Rate', icon: 'fa-arrow-left', category: 'Traffic' },
  { id: 'refund_rate', label: 'Refund Rate', icon: 'fa-undo', category: 'Financial' },
  { id: 'inventory_value', label: 'Inventory Value', icon: 'fa-boxes', category: 'Inventory' },
];

const AVAILABLE_DIMENSIONS = [
  { id: 'date', label: 'Date', icon: 'fa-calendar' },
  { id: 'week', label: 'Week', icon: 'fa-calendar-week' },
  { id: 'month', label: 'Month', icon: 'fa-calendar-alt' },
  { id: 'category', label: 'Product Category', icon: 'fa-tag' },
  { id: 'product', label: 'Product', icon: 'fa-box' },
  { id: 'country', label: 'Country', icon: 'fa-globe' },
  { id: 'supplier', label: 'Supplier', icon: 'fa-store' },
  { id: 'user_segment', label: 'User Segment', icon: 'fa-users-cog' },
  { id: 'payment_method', label: 'Payment Method', icon: 'fa-credit-card' },
  { id: 'channel', label: 'Sales Channel', icon: 'fa-broadcast-tower' },
];

const CHART_TYPES = [
  { id: 'line', label: 'Line', icon: 'fa-chart-line' },
  { id: 'bar', label: 'Bar', icon: 'fa-chart-bar' },
  { id: 'pie', label: 'Pie', icon: 'fa-chart-pie' },
  { id: 'area', label: 'Area', icon: 'fa-area-chart' },
  { id: 'table', label: 'Table', icon: 'fa-table' },
];

const DATE_PRESETS = {
  today: { label: 'Today', days: 0 },
  yesterday: { label: 'Yesterday', days: 1 },
  last7days: { label: 'Last 7 Days', days: 7 },
  last30days: { label: 'Last 30 Days', days: 30 },
  last90days: { label: 'Last 90 Days', days: 90 },
  thismonth: { label: 'This Month', thisMonth: true },
  lastmonth: { label: 'Last Month', lastMonth: true },
  thisyear: { label: 'This Year', thisYear: true },
};

/* ────────────────────────────────────────────────────────────
   STATE
   ──────────────────────────────────────────────────────────── */
const builderState = {
  selectedMetrics: [],
  selectedDimensions: [],
  chartType: 'bar',
  datePreset: 'last30days',
  dateFrom: null,
  dateTo: null,
  reportName: 'My Report',
  currentChart: null,
};

/* ────────────────────────────────────────────────────────────
   INIT METRIC / DIMENSION PANELS
   ──────────────────────────────────────────────────────────── */
function initBuilderPanels() {
  renderAvailableItems('metricsPanel', AVAILABLE_METRICS, 'metric');
  renderAvailableItems('dimensionsPanel', AVAILABLE_DIMENSIONS, 'dimension');
  renderChartTypePicker();
  renderDatePresets();
  initDragDrop();
}

function renderAvailableItems(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const categories = [...new Set(items.map(i => i.category || 'General'))];
  container.innerHTML = categories.map(cat => {
    const catItems = items.filter(i => (i.category || 'General') === cat);
    return `
      <div class="rb-category">
        <div class="rb-category-label">${escHtml(cat)}</div>
        ${catItems.map(item => `
          <div class="rb-item" draggable="true" data-id="${escHtml(item.id)}" data-type="${type}" data-label="${escHtml(item.label)}"
               onclick="toggleItem('${escHtml(item.id)}','${type}','${escHtml(item.label)}')">
            <i class="fas ${item.icon || 'fa-circle'}" style="margin-right:6px;color:#0052CC;font-size:.8rem"></i>
            ${escHtml(item.label)}
          </div>`).join('')}
      </div>`;
  }).join('');
}

function renderChartTypePicker() {
  const container = document.getElementById('chartTypePicker');
  if (!container) return;
  container.innerHTML = CHART_TYPES.map(ct => `
    <button class="chart-type-btn ${ct.id === builderState.chartType ? 'active' : ''}"
            onclick="selectChartType('${ct.id}')" title="${escHtml(ct.label)}">
      <i class="fas ${ct.icon}"></i>
      <span>${escHtml(ct.label)}</span>
    </button>`).join('');
}

function renderDatePresets() {
  const container = document.getElementById('datePresets');
  if (!container) return;
  container.innerHTML = Object.entries(DATE_PRESETS).map(([key, p]) => `
    <button class="date-preset-btn ${key === builderState.datePreset ? 'active' : ''}"
            onclick="selectDatePreset('${key}')">${escHtml(p.label)}</button>`).join('');
}

/* ────────────────────────────────────────────────────────────
   ITEM SELECTION
   ──────────────────────────────────────────────────────────── */
function toggleItem(id, type, label) {
  const list = type === 'metric' ? builderState.selectedMetrics : builderState.selectedDimensions;
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) {
    list.push({ id, label });
  } else {
    list.splice(idx, 1);
  }
  updateSelectedItemsDisplay();
  document.querySelectorAll(`.rb-item[data-id="${id}"][data-type="${type}"]`).forEach(el => {
    el.classList.toggle('selected', idx === -1);
  });
}

function updateSelectedItemsDisplay() {
  const metricsEl = document.getElementById('selectedMetrics');
  const dimsEl = document.getElementById('selectedDimensions');
  if (metricsEl) {
    metricsEl.innerHTML = builderState.selectedMetrics.length
      ? builderState.selectedMetrics.map(m => `
          <span class="selected-tag">
            ${escHtml(m.label)}
            <button onclick="toggleItem('${escHtml(m.id)}','metric','${escHtml(m.label)}')" class="tag-remove">×</button>
          </span>`).join('')
      : '<span style="color:#94a3b8;font-size:.82rem">Drag or click metrics to add</span>';
  }
  if (dimsEl) {
    dimsEl.innerHTML = builderState.selectedDimensions.length
      ? builderState.selectedDimensions.map(d => `
          <span class="selected-tag selected-tag-dim">
            ${escHtml(d.label)}
            <button onclick="toggleItem('${escHtml(d.id)}','dimension','${escHtml(d.label)}')" class="tag-remove">×</button>
          </span>`).join('')
      : '<span style="color:#94a3b8;font-size:.82rem">Drag or click dimensions to add</span>';
  }
}

/* ────────────────────────────────────────────────────────────
   CHART TYPE SELECTION
   ──────────────────────────────────────────────────────────── */
function selectChartType(type) {
  builderState.chartType = type;
  document.querySelectorAll('.chart-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.querySelector('span')?.textContent?.toLowerCase() === type ||
      btn.getAttribute('onclick')?.includes(`'${type}'`));
  });
  renderChartTypePicker();
}

/* ────────────────────────────────────────────────────────────
   DATE RANGE
   ──────────────────────────────────────────────────────────── */
function selectDatePreset(key) {
  builderState.datePreset = key;
  const now = new Date();
  const p = DATE_PRESETS[key];
  let from, to = new Date(now);

  if (p.thisMonth) {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (p.lastMonth) {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (p.thisYear) {
    from = new Date(now.getFullYear(), 0, 1);
  } else {
    from = new Date(now);
    from.setDate(from.getDate() - (p.days || 0));
    if (p.days === 1) to = new Date(from);
  }

  builderState.dateFrom = from.toISOString().split('T')[0];
  builderState.dateTo = to.toISOString().split('T')[0];

  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  if (fromEl) fromEl.value = builderState.dateFrom;
  if (toEl) toEl.value = builderState.dateTo;

  renderDatePresets();
}

/* ────────────────────────────────────────────────────────────
   DRAG & DROP
   ──────────────────────────────────────────────────────────── */
function initDragDrop() {
  document.addEventListener('dragstart', e => {
    const item = e.target.closest('[draggable="true"][data-id]');
    if (!item) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.dataset.id, type: item.dataset.type, label: item.dataset.label }));
    e.dataTransfer.effectAllowed = 'copy';
  });

  const dropZones = document.querySelectorAll('.rb-drop-zone');
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      try {
        const { id, type, label } = JSON.parse(e.dataTransfer.getData('text/plain'));
        const expectedType = zone.dataset.accepts;
        if (expectedType && type !== expectedType) return;
        toggleItem(id, type, label);
      } catch (_) { /* invalid drag data */ }
    });
  });
}

/* ────────────────────────────────────────────────────────────
   BUILD REPORT
   ──────────────────────────────────────────────────────────── */
async function buildReport() {
  if (!builderState.selectedMetrics.length) {
    showToast('Please select at least one metric', true);
    return;
  }
  const btn = document.getElementById('buildReportBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building…'; }

  const dateFrom = document.getElementById('dateFrom')?.value || builderState.dateFrom;
  const dateTo = document.getElementById('dateTo')?.value || builderState.dateTo;

  const params = new URLSearchParams({
    metrics: builderState.selectedMetrics.map(m => m.id).join(','),
    dimensions: builderState.selectedDimensions.map(d => d.id).join(','),
    date_from: dateFrom || '',
    date_to: dateTo || '',
  });

  try {
    const res = await fetch(`${API_BASE}/admin/reports/custom?${params}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Report generation failed');
    const data = json.data || {};
    renderReport(data);
    showToast('Report generated successfully');
  } catch (err) {
    showToast(err.message, true);
    renderSampleReport();
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Run Report'; }
  }
}

function renderReport(data) {
  const preview = document.getElementById('reportPreview');
  if (!preview) return;

  if (builderState.chartType === 'table') {
    renderTableReport(data);
    return;
  }

  preview.innerHTML = '<canvas id="reportChart" style="max-height:400px"></canvas>';
  const ctx = document.getElementById('reportChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (builderState.currentChart) builderState.currentChart.destroy();

  const labels = data.labels || data.dates || [];
  const datasets = (data.datasets || builderState.selectedMetrics.map((m, i) => ({
    label: m.label,
    data: data[m.id] || [],
    borderColor: ['#0052CC', '#059669', '#7c3aed', '#f97316', '#ef4444'][i % 5],
    backgroundColor: ['rgba(0,82,204,.15)', 'rgba(5,150,105,.15)', 'rgba(124,58,237,.15)', 'rgba(249,115,22,.15)', 'rgba(239,68,68,.15)'][i % 5],
  })));

  const type = builderState.chartType === 'area' ? 'line' : builderState.chartType;
  const fill = builderState.chartType === 'area';

  builderState.currentChart = new Chart(ctx, {
    type,
    data: { labels, datasets: datasets.map(ds => ({ ...ds, fill, tension: 0.4 })) },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
      scales: type === 'pie' ? {} : { y: { beginAtZero: true } },
    },
  });
}

function renderSampleReport() {
  const preview = document.getElementById('reportPreview');
  if (!preview) return;
  preview.innerHTML = '<canvas id="reportChart" style="max-height:400px"></canvas>';
  const ctx = document.getElementById('reportChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (builderState.currentChart) builderState.currentChart.destroy();
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const datasets = builderState.selectedMetrics.slice(0, 3).map((m, i) => ({
    label: m.label,
    data: labels.map(() => Math.floor(Math.random() * 10000) + 1000),
    borderColor: ['#0052CC', '#059669', '#7c3aed'][i],
    backgroundColor: ['rgba(0,82,204,.15)', 'rgba(5,150,105,.15)', 'rgba(124,58,237,.15)'][i],
    fill: builderState.chartType === 'area',
    tension: 0.4,
  }));
  const type = builderState.chartType === 'area' ? 'line' : builderState.chartType;
  builderState.currentChart = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: { responsive: true, plugins: { legend: { position: 'top' } } },
  });
}

function renderTableReport(data) {
  const preview = document.getElementById('reportPreview');
  if (!preview) return;
  const rows = data.rows || [];
  const headers = [...builderState.selectedDimensions, ...builderState.selectedMetrics];
  preview.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr>${headers.map(h => `<th>${escHtml(h.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.length
            ? rows.map(row => `<tr>${headers.map(h => `<td>${escHtml(row[h.id] ?? '—')}</td>`).join('')}</tr>`).join('')
            : '<tr><td colspan="' + headers.length + '" style="text-align:center;padding:20px;color:#94a3b8">No data available for selected criteria.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

/* ────────────────────────────────────────────────────────────
   EXPORT
   ──────────────────────────────────────────────────────────── */
async function exportReport(format) {
  if (!builderState.selectedMetrics.length) {
    showToast('Please build a report first', true);
    return;
  }
  const params = new URLSearchParams({
    metrics: builderState.selectedMetrics.map(m => m.id).join(','),
    dimensions: builderState.selectedDimensions.map(d => d.id).join(','),
    date_from: builderState.dateFrom || '',
    date_to: builderState.dateTo || '',
    format,
  });
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const res = await fetch(`${API_BASE}/admin/reports/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Report exported as ${format.toUpperCase()}`);
  } catch (err) {
    showToast(err.message, true);
  }
}

function exportCSVFromTable() {
  const table = document.querySelector('#reportPreview table');
  if (!table) { showToast('No table to export', true); return; }
  const rows = [];
  table.querySelectorAll('tr').forEach(row => {
    rows.push(Array.from(row.querySelectorAll('th,td')).map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

/* ────────────────────────────────────────────────────────────
   SAVE REPORT
   ──────────────────────────────────────────────────────────── */
async function saveReport() {
  const name = document.getElementById('reportNameInput')?.value?.trim() || builderState.reportName;
  if (!name) { showToast('Please enter a report name', true); return; }
  if (!builderState.selectedMetrics.length) { showToast('Please select metrics', true); return; }
  try {
    const res = await fetch(`${API_BASE}/admin/reports/saved`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        name,
        metrics: builderState.selectedMetrics.map(m => m.id),
        dimensions: builderState.selectedDimensions.map(d => d.id),
        chart_type: builderState.chartType,
        date_preset: builderState.datePreset,
        date_from: builderState.dateFrom,
        date_to: builderState.dateTo,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Save failed');
    showToast('Report saved successfully');
    loadSavedReports();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   SAVED REPORTS
   ──────────────────────────────────────────────────────────── */
async function loadSavedReports() {
  const container = document.getElementById('savedReportsList');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/admin/reports/saved`, { headers: await authHeaders() });
    const json = await res.json();
    const reports = json.data || [];
    container.innerHTML = reports.length
      ? reports.map(r => `
          <div class="saved-report-card" onclick="loadSavedReport('${escHtml(r.id)}')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <strong>${escHtml(r.name)}</strong>
              <button class="btn-sm btn-danger" onclick="event.stopPropagation();deleteSavedReport('${escHtml(r.id)}')"><i class="fas fa-trash"></i></button>
            </div>
            <div style="font-size:.78rem;color:#64748b;margin-top:4px">
              ${escHtml(r.chart_type)} · ${(r.metrics || []).length} metrics · ${r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}
            </div>
          </div>`).join('')
      : '<p style="color:#94a3b8;font-size:.85rem;padding:10px 0">No saved reports.</p>';
  } catch (_) { /* unavailable */ }
}

async function loadSavedReport(reportId) {
  try {
    const res = await fetch(`${API_BASE}/admin/reports/saved/${reportId}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load report');
    const r = json.data;
    builderState.selectedMetrics = (r.metrics || []).map(id => AVAILABLE_METRICS.find(m => m.id === id) || { id, label: id });
    builderState.selectedDimensions = (r.dimensions || []).map(id => AVAILABLE_DIMENSIONS.find(d => d.id === id) || { id, label: id });
    builderState.chartType = r.chart_type || 'bar';
    builderState.dateFrom = r.date_from;
    builderState.dateTo = r.date_to;
    if (document.getElementById('reportNameInput')) document.getElementById('reportNameInput').value = r.name;
    if (document.getElementById('dateFrom')) document.getElementById('dateFrom').value = r.date_from || '';
    if (document.getElementById('dateTo')) document.getElementById('dateTo').value = r.date_to || '';
    renderChartTypePicker();
    updateSelectedItemsDisplay();
    buildReport();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteSavedReport(reportId) {
  if (!confirm('Delete this saved report?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/reports/saved/${reportId}`, { method: 'DELETE', headers: await authHeaders() });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Report deleted');
    loadSavedReports();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   SCHEDULE REPORT
   ──────────────────────────────────────────────────────────── */
async function scheduleReport(e) {
  if (e) e.preventDefault();
  const form = e?.target || document.getElementById('scheduleReportForm');
  if (!form) return;
  const payload = {
    report_name: document.getElementById('reportNameInput')?.value?.trim() || 'Scheduled Report',
    metrics: builderState.selectedMetrics.map(m => m.id),
    dimensions: builderState.selectedDimensions.map(d => d.id),
    frequency: form.schedFrequency?.value,
    email: form.schedEmail?.value,
    format: form.schedFormat?.value,
  };
  try {
    const res = await fetch(`${API_BASE}/admin/reports/schedule`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Schedule failed');
    showToast('Report scheduled successfully');
    document.getElementById('scheduleModal')?.classList.remove('open');
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initBuilderPanels();
  selectDatePreset('last30days');
  loadSavedReports();

  document.getElementById('buildReportBtn')?.addEventListener('click', buildReport);
  document.getElementById('saveReportBtn')?.addEventListener('click', saveReport);
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportReport('csv'));
  document.getElementById('exportPdfBtn')?.addEventListener('click', () => exportReport('pdf'));
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportReport('excel'));
  document.getElementById('exportCsvTableBtn')?.addEventListener('click', exportCSVFromTable);
  document.getElementById('scheduleReportForm')?.addEventListener('submit', scheduleReport);

  document.getElementById('dateFrom')?.addEventListener('change', e => { builderState.dateFrom = e.target.value; });
  document.getElementById('dateTo')?.addEventListener('change', e => { builderState.dateTo = e.target.value; });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
});
