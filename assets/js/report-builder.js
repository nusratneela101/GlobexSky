/**
 * Globex Sky - report-builder.js
 * Admin report builder: date range selection, metric configuration,
 * chart rendering with Chart.js, data table display, CSV/PDF export.
 */

const ReportBuilderAPI = {
  BASE: '/api/v1/reports',
  headers() {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
  },
  async post(path, body) {
    const res = await fetch(this.BASE + path, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async get(path) {
    const h = { ...this.headers() };
    delete h['Content-Type'];
    const res = await fetch(this.BASE + path, { headers: h });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

function initReportBuilder() {
  const form = document.querySelector('#reportBuilderForm, [data-report-builder]');
  if (!form) return;

  const fromInput = form.querySelector('[name="date_from"], #reportDateFrom');
  const toInput   = form.querySelector('[name="date_to"],   #reportDateTo');
  if (fromInput && !fromInput.value) {
    fromInput.value = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  }
  if (toInput && !toInput.value) {
    toInput.value = new Date().toISOString().slice(0, 10);
  }

  form.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.range, 10);
      if (fromInput) fromInput.value = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      if (toInput)   toInput.value   = new Date().toISOString().slice(0, 10);
      form.querySelectorAll('[data-range]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runReport(form);
  });
}

async function runReport(form) {
  const btn    = form.querySelector('[type="submit"]');
  const orig   = btn?.textContent;
  const result = document.querySelector('#reportResult, [data-report-result]');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  if (result) result.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

  const fd   = new FormData(form);
  const body = {};
  for (const [k, v] of fd.entries()) { body[k] = v; }

  try {
    const data = await ReportBuilderAPI.post('/generate', body);
    renderReportResult(data.data || data, result, body);
    if (typeof showToast === 'function') showToast('Report generated!', 'success');
  } catch (err) {
    if (result) result.innerHTML = `<div class="alert alert-danger">${err.message || 'Failed to generate report.'}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

function renderReportResult(data, container, params) {
  if (!container) return;
  const rows      = data.rows    || data    || [];
  const summary   = data.summary || {};
  const chartData = data.chart   || null;

  const summaryHtml = Object.keys(summary).length
    ? `<div class="row g-3 mb-4">` + Object.entries(summary).map(([k, v]) => `
        <div class="col-sm-6 col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <div class="fs-4 fw-bold text-primary">${typeof v === 'number' ? v.toLocaleString() : v}</div>
              <div class="text-muted small">${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            </div>
          </div>
        </div>`).join('') + `</div>` : '';

  const chartHtml = chartData ? `<div class="mb-4"><canvas id="reportChart" height="80"></canvas></div>` : '';
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const tableHtml = rows.length
    ? `<div class="table-responsive"><table class="table table-hover table-sm" id="reportTable">
        <thead><tr>${keys.map((k) => `<th>${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${keys.map((k) => `<td>${row[k] ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody>
       </table></div>`
    : '<p class="text-muted text-center py-4">No data for the selected period.</p>';

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h5 class="mb-0">Report Results <small class="text-muted">(${rows.length} rows)</small></h5>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-success btn-sm" id="exportCsvBtn"><i class="fas fa-file-csv me-1"></i>Export CSV</button>
        <button class="btn btn-outline-danger btn-sm" id="exportPdfBtn"><i class="fas fa-file-pdf me-1"></i>Export PDF</button>
      </div>
    </div>
    ${summaryHtml}${chartHtml}${tableHtml}`;

  if (chartData && typeof Chart !== 'undefined') {
    const canvas = document.getElementById('reportChart');
    if (canvas) {
      new Chart(canvas, {
        type: chartData.type || 'bar',
        data: {
          labels: chartData.labels || [],
          datasets: [{ label: 'Value', data: chartData.values || [], backgroundColor: 'rgba(13,110,253,.5)', borderColor: '#0d6efd', borderWidth: 1 }],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } },
      });
    }
  }

  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    if (!rows.length) return;
    const csv = [keys.join(','), ...rows.map((row) => keys.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Report</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dee2e6;padding:4px 8px;font-size:12px}th{background:#f8f9fa}</style></head><body>');
    w.document.write(document.querySelector('#reportTable')?.outerHTML || '<p>No data</p>');
    w.document.write('</body></html>');
    w.document.close(); w.print();
  });
}

async function initSavedReports() {
  const container = document.querySelector('.saved-reports, [data-saved-reports]');
  if (!container) return;
  try {
    const data    = await ReportBuilderAPI.get('/saved');
    const reports = data.data || data || [];
    container.innerHTML = reports.length
      ? reports.map((r) => `
          <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
              <strong>${r.name}</strong>
              <span class="badge bg-light text-dark ms-2">${r.type || ''}</span>
              <small class="text-muted ms-2">${new Date(r.created_at).toLocaleDateString()}</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" data-run-saved="${r.id}">Run</button>
          </div>`).join('')
      : '<p class="text-muted small">No saved reports.</p>';
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  initReportBuilder();
  initSavedReports();
});
