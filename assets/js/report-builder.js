/**
 * Globex Sky — report-builder.js
 * Custom report builder module:
 *   - Drag-and-drop report sections
 *   - Multiple chart types (bar, line, pie, table)
 *   - Date range & filter configuration
 *   - Export as PDF / CSV / JSON
 *   - Report templates & saved reports
 */

'use strict';

const GlobexReportBuilder = (() => {

  const REPORTS_KEY = 'globexSavedReports';

  /* ── Available Metrics ──────────────────────────────────────────────── */
  const METRICS = [
    { id: 'revenue', label: 'Revenue', category: 'Sales', unit: '$' },
    { id: 'orders', label: 'Orders Count', category: 'Sales', unit: '' },
    { id: 'aov', label: 'Average Order Value', category: 'Sales', unit: '$' },
    { id: 'new_users', label: 'New Users', category: 'Users', unit: '' },
    { id: 'active_users', label: 'Active Users', category: 'Users', unit: '' },
    { id: 'page_views', label: 'Page Views', category: 'Traffic', unit: '' },
    { id: 'bounce_rate', label: 'Bounce Rate', category: 'Traffic', unit: '%' },
    { id: 'conversion_rate', label: 'Conversion Rate', category: 'Sales', unit: '%' },
    { id: 'refund_rate', label: 'Refund Rate', category: 'Sales', unit: '%' },
    { id: 'top_products', label: 'Top Products', category: 'Products', unit: '' },
    { id: 'low_stock', label: 'Low Stock Items', category: 'Products', unit: '' },
    { id: 'fraud_flags', label: 'Fraud Flags', category: 'Security', unit: '' },
  ];

  const CHART_TYPES = [
    { id: 'bar', label: 'Bar Chart', icon: 'fas fa-chart-bar' },
    { id: 'line', label: 'Line Chart', icon: 'fas fa-chart-line' },
    { id: 'pie', label: 'Pie Chart', icon: 'fas fa-chart-pie' },
    { id: 'table', label: 'Data Table', icon: 'fas fa-table' },
    { id: 'number', label: 'KPI Card', icon: 'fas fa-hashtag' },
  ];

  /* ── Report State ───────────────────────────────────────────────────── */
  let currentReport = {
    id: null,
    name: 'New Report',
    dateRange: { start: '', end: '' },
    filters: {},
    sections: [],
  };

  /* ── Section Management ─────────────────────────────────────────────── */
  function addSection(metricId, chartType = 'bar') {
    const metric = METRICS.find(m => m.id === metricId);
    if (!metric) return;
    const section = {
      id: 'sec-' + Date.now(),
      metricId,
      metricLabel: metric.label,
      chartType,
      data: generateDemoData(metricId),
      order: currentReport.sections.length,
    };
    currentReport.sections.push(section);
    renderSections();
  }

  function removeSection(sectionId) {
    currentReport.sections = currentReport.sections.filter(s => s.id !== sectionId);
    renderSections();
  }

  function moveSectionUp(sectionId) {
    const idx = currentReport.sections.findIndex(s => s.id === sectionId);
    if (idx <= 0) return;
    [currentReport.sections[idx - 1], currentReport.sections[idx]] =
      [currentReport.sections[idx], currentReport.sections[idx - 1]];
    renderSections();
  }

  function moveSectionDown(sectionId) {
    const idx = currentReport.sections.findIndex(s => s.id === sectionId);
    if (idx < 0 || idx >= currentReport.sections.length - 1) return;
    [currentReport.sections[idx], currentReport.sections[idx + 1]] =
      [currentReport.sections[idx + 1], currentReport.sections[idx]];
    renderSections();
  }

  /* ── Demo Data Generator ────────────────────────────────────────────── */
  function generateDemoData(metricId) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    switch (metricId) {
      case 'revenue':
        return months.map(m => ({ label: m, value: Math.round(Math.random() * 50000 + 10000) }));
      case 'orders':
        return months.map(m => ({ label: m, value: Math.round(Math.random() * 500 + 100) }));
      case 'aov':
        return months.map(m => ({ label: m, value: +(Math.random() * 200 + 50).toFixed(2) }));
      case 'new_users':
        return months.map(m => ({ label: m, value: Math.round(Math.random() * 1000 + 200) }));
      case 'conversion_rate':
        return months.map(m => ({ label: m, value: +(Math.random() * 5 + 1).toFixed(2) }));
      case 'top_products':
        return [
          { label: 'Wireless Earbuds', value: 342 },
          { label: 'Laptop Stand', value: 289 },
          { label: 'Phone Case', value: 256 },
          { label: 'USB-C Cable', value: 201 },
          { label: 'Smart Watch', value: 178 },
        ];
      default:
        return months.map(m => ({ label: m, value: Math.round(Math.random() * 100 + 10) }));
    }
  }

  /* ── Rendering ──────────────────────────────────────────────────────── */
  function renderSections() {
    const canvas = document.getElementById('report-canvas');
    if (!canvas) return;

    if (!currentReport.sections.length) {
      canvas.innerHTML = `
        <div class="report-empty-state">
          <i class="fas fa-chart-bar" style="font-size:3rem;color:#94a3b8;margin-bottom:16px"></i>
          <h3>Start Building Your Report</h3>
          <p>Drag metrics from the left panel or click "Add Section" to begin.</p>
        </div>`;
      return;
    }

    canvas.innerHTML = currentReport.sections.map(section => renderSection(section)).join('');

    // Attach drag events for reordering
    initSectionDragDrop();
  }

  function renderSection(section) {
    return `
      <div class="report-section" id="${section.id}" draggable="true" data-section-id="${section.id}">
        <div class="report-section-header">
          <i class="fas fa-grip-vertical drag-handle" style="color:#94a3b8;cursor:grab;margin-right:8px"></i>
          <span class="report-section-title">${section.metricLabel}</span>
          <div class="report-section-actions">
            <select class="filter-input" onchange="GlobexReportBuilder.changeChartType('${section.id}', this.value)" style="padding:4px 8px;font-size:.8rem">
              ${CHART_TYPES.map(ct => `<option value="${ct.id}" ${ct.id === section.chartType ? 'selected' : ''}>${ct.label}</option>`).join('')}
            </select>
            <button class="btn-sm btn-secondary" onclick="GlobexReportBuilder.moveSectionUp('${section.id}')" title="Move up"><i class="fas fa-arrow-up"></i></button>
            <button class="btn-sm btn-secondary" onclick="GlobexReportBuilder.moveSectionDown('${section.id}')" title="Move down"><i class="fas fa-arrow-down"></i></button>
            <button class="btn-sm btn-danger" onclick="GlobexReportBuilder.removeSection('${section.id}')" title="Remove"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="report-section-body">
          ${renderChartPlaceholder(section)}
        </div>
      </div>`;
  }

  function renderChartPlaceholder(section) {
    const metric = METRICS.find(m => m.id === section.metricId);
    const unit = metric?.unit || '';

    if (section.chartType === 'number') {
      const total = section.data.reduce((s, d) => s + d.value, 0);
      return `<div class="kpi-card-large"><div class="kpi-value">${unit}${total.toLocaleString()}</div><div class="kpi-label">${section.metricLabel} (Total)</div></div>`;
    }

    if (section.chartType === 'table') {
      return `
        <table class="data-table">
          <thead><tr><th>Period</th><th>${section.metricLabel}</th></tr></thead>
          <tbody>
            ${section.data.map(d => `<tr><td>${d.label}</td><td>${unit}${d.value.toLocaleString()}</td></tr>`).join('')}
          </tbody>
        </table>`;
    }

    if (section.chartType === 'pie') {
      return renderInlinePie(section.data, unit);
    }

    // Bar / Line — draw on canvas
    return `<div class="chart-canvas-wrap"><canvas id="chart-${section.id}" height="200"></canvas></div>
    <script>
      (function() {
        const canvas = document.getElementById('chart-${section.id}');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const data = ${JSON.stringify(section.data)};
        drawBarChart(ctx, canvas, data, '${section.chartType}', '${unit}');
      })();
    <\/script>`;
  }

  function renderInlinePie(data, unit) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const colors = ['#0052CC', '#00C9A7', '#FF6B35', '#7c3aed', '#059669', '#f97316', '#ef4444', '#0d9488'];
    let cumAngle = -Math.PI / 2;
    const r = 80;
    const cx = 90, cy = 90;
    const slices = data.map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(cumAngle);
      const y1 = cy + r * Math.sin(cumAngle);
      cumAngle += angle;
      const x2 = cx + r * Math.cos(cumAngle);
      const y2 = cy + r * Math.sin(cumAngle);
      const large = angle > Math.PI ? 1 : 0;
      const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
      return { path, color: colors[i % colors.length], label: d.label, value: d.value };
    });
    const svgSlices = slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('');
    const legend = slices.map(s => `
      <li style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:4px">
        <span style="width:12px;height:12px;border-radius:2px;background:${s.color};flex-shrink:0"></span>
        <span>${s.label}: ${unit}${s.value.toLocaleString()} (${Math.round((s.value / total) * 100)}%)</span>
      </li>`).join('');
    return `<div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">
      <svg width="180" height="180" viewBox="0 0 180 180">${svgSlices}</svg>
      <ul style="list-style:none;padding:0;margin-top:16px">${legend}</ul>
    </div>`;
  }

  /* ── Bar/Line Chart Drawing ─────────────────────────────────────────── */
  function drawBarChart(ctx, canvas, data, type, unit) {
    if (!ctx || !data.length) return;
    const W = canvas.offsetWidth || 600;
    const H = canvas.height || 200;
    canvas.width = W;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const barW = Math.floor(plotW / data.length * 0.6);
    const gap = plotW / data.length;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f8faff';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + plotW, y); ctx.stroke();
      const val = maxVal - (maxVal / 4) * i;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${unit}${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val)}`, padding.left - 5, y + 4);
    }

    if (type === 'line') {
      // Line chart
      ctx.strokeStyle = '#0052CC';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = padding.left + gap * i + gap / 2;
        const y = padding.top + plotH - (d.value / maxVal) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Dots
      data.forEach((d, i) => {
        const x = padding.left + gap * i + gap / 2;
        const y = padding.top + plotH - (d.value / maxVal) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0052CC';
        ctx.fill();
      });
    } else {
      // Bar chart
      data.forEach((d, i) => {
        const x = padding.left + gap * i + (gap - barW) / 2;
        const barH = (d.value / maxVal) * plotH;
        const y = padding.top + plotH - barH;
        ctx.fillStyle = '#0052CC';
        ctx.fillRect(x, y, barW, barH);
      });
    }

    // X labels
    ctx.fillStyle = '#374151';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      const x = padding.left + gap * i + gap / 2;
      ctx.fillText(d.label, x, H - 10);
    });
  }

  /* ── Drag & Drop Reorder ────────────────────────────────────────────── */
  let dragSrcId = null;

  function initSectionDragDrop() {
    document.querySelectorAll('.report-section').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragSrcId = el.dataset.sectionId;
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-target'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag-target'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-target');
        const targetId = el.dataset.sectionId;
        if (dragSrcId && targetId && dragSrcId !== targetId) {
          const srcIdx = currentReport.sections.findIndex(s => s.id === dragSrcId);
          const tgtIdx = currentReport.sections.findIndex(s => s.id === targetId);
          const [moved] = currentReport.sections.splice(srcIdx, 1);
          currentReport.sections.splice(tgtIdx, 0, moved);
          renderSections();
        }
        dragSrcId = null;
      });
    });
  }

  /* ── Chart Type Change ──────────────────────────────────────────────── */
  function changeChartType(sectionId, chartType) {
    const section = currentReport.sections.find(s => s.id === sectionId);
    if (section) {
      section.chartType = chartType;
      renderSections();
    }
  }

  /* ── Export ─────────────────────────────────────────────────────────── */
  function exportCSV() {
    const rows = [['Report', currentReport.name], ['Generated', new Date().toLocaleString()], ['']];
    currentReport.sections.forEach(section => {
      rows.push([section.metricLabel]);
      rows.push(['Period', 'Value']);
      section.data.forEach(d => rows.push([d.label, d.value]));
      rows.push(['']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `${currentReport.name.replace(/\s+/g, '_')}-${Date.now()}.csv`);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${currentReport.name.replace(/\s+/g, '_')}-${Date.now()}.json`);
  }

  function exportPDF() {
    window.print(); // Basic fallback — in production use jsPDF or server-side rendering
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  /* ── Save / Load Reports ────────────────────────────────────────────── */
  function saveReport() {
    const nameEl = document.getElementById('report-name-input');
    if (nameEl) currentReport.name = nameEl.value || 'New Report';
    if (!currentReport.id) currentReport.id = 'rpt-' + Date.now();
    currentReport.savedAt = new Date().toISOString();

    const reports = getSavedReports().filter(r => r.id !== currentReport.id);
    reports.unshift(currentReport);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(0, 20)));
    renderSavedReportsList();
    showToast('Report saved.', 'success');
  }

  function loadReport(id) {
    const reports = getSavedReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;
    currentReport = JSON.parse(JSON.stringify(report)); // deep copy
    const nameEl = document.getElementById('report-name-input');
    if (nameEl) nameEl.value = currentReport.name;
    renderSections();
  }

  function deleteReport(id) {
    const reports = getSavedReports().filter(r => r.id !== id);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    renderSavedReportsList();
  }

  function getSavedReports() {
    try { return JSON.parse(localStorage.getItem(REPORTS_KEY)) || []; }
    catch (_) { return []; }
  }

  function renderSavedReportsList() {
    const container = document.getElementById('saved-reports-list');
    if (!container) return;
    const reports = getSavedReports();
    if (!reports.length) {
      container.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:8px 0">No saved reports.</div>';
      return;
    }
    container.innerHTML = reports.map(r => `
      <div class="saved-report-item">
        <span class="saved-report-name" onclick="GlobexReportBuilder.loadReport('${r.id}')">${r.name}</span>
        <span class="saved-report-date">${new Date(r.savedAt).toLocaleDateString()}</span>
        <button class="btn-sm btn-danger" onclick="GlobexReportBuilder.deleteReport('${r.id}')"><i class="fas fa-trash"></i></button>
      </div>`).join('');
  }

  /* ── Metric Picker ──────────────────────────────────────────────────── */
  function renderMetricPicker() {
    const container = document.getElementById('metric-picker');
    if (!container) return;
    const grouped = {};
    METRICS.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    });
    container.innerHTML = Object.entries(grouped).map(([cat, metrics]) => `
      <div class="metric-group">
        <div class="metric-group-label">${cat}</div>
        ${metrics.map(m => `
          <div class="metric-item" draggable="true" data-metric-id="${m.id}"
               onclick="GlobexReportBuilder.addSection('${m.id}')">
            <i class="fas fa-plus-circle" style="color:#0052CC;margin-right:6px"></i>${m.label}
          </div>`).join('')}
      </div>`).join('');
  }

  /* ── Utility ────────────────────────────────────────────────────────── */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;font-size:.88rem;font-weight:500;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:opacity .3s';
    toast.style.background = type === 'success' ? '#059669' : type === 'error' ? '#ef4444' : '#0052CC';
    toast.style.color = '#fff';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    renderMetricPicker();
    renderSections();
    renderSavedReportsList();

    // Wire buttons
    const saveBtn = document.getElementById('btn-save-report');
    if (saveBtn) saveBtn.addEventListener('click', saveReport);

    const csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) csvBtn.addEventListener('click', exportCSV);

    const jsonBtn = document.getElementById('btn-export-json');
    if (jsonBtn) jsonBtn.addEventListener('click', exportJSON);

    const pdfBtn = document.getElementById('btn-export-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);

    const clearBtn = document.getElementById('btn-clear-report');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      currentReport.sections = [];
      renderSections();
    });

    // Date range
    const startEl = document.getElementById('report-date-start');
    const endEl = document.getElementById('report-date-end');
    if (startEl) startEl.addEventListener('change', e => { currentReport.dateRange.start = e.target.value; });
    if (endEl) endEl.addEventListener('change', e => { currentReport.dateRange.end = e.target.value; });

    // Make drawBarChart globally accessible for inline scripts
    window.drawBarChart = drawBarChart;
  }

  return {
    init,
    addSection,
    removeSection,
    moveSectionUp,
    moveSectionDown,
    changeChartType,
    saveReport,
    loadReport,
    deleteReport,
    exportCSV,
    exportJSON,
    exportPDF,
    METRICS,
    CHART_TYPES,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('report-canvas')) {
    GlobexReportBuilder.init();
  }
});

window.GlobexReportBuilder = GlobexReportBuilder;
