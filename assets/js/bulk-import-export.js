/**
 * bulk-import-export.js
 * Bulk Import / Export CSV — GlobexSky Admin
 *
 * Depends on: PapaParse (loaded via CDN in the HTML page)
 * Storage   : localStorage (demo / offline-first)
 */

'use strict';

/* ── Namespace ───────────────────────────────────────────────────────────── */
window.GlobexSky = window.GlobexSky || {};

GlobexSky.BulkImportExport = (() => {

  /* ── Constants ─────────────────────────────────────────────────────────── */
  const HISTORY_KEY = 'globexBIEHistoryV1';
  const MAX_PREVIEW_ROWS = 50;

  /* ── Entity definitions ────────────────────────────────────────────────── */
  const ENTITIES = {
    products: {
      label: 'Products',
      icon: 'fa-box',
      fields: [
        { key: 'sku',          label: 'SKU',           required: true  },
        { key: 'name',         label: 'Product Name',  required: true  },
        { key: 'category',     label: 'Category',      required: false },
        { key: 'price',        label: 'Price (USD)',    required: true,  type: 'number' },
        { key: 'stock',        label: 'Stock Qty',     required: false, type: 'number' },
        { key: 'supplier_id',  label: 'Supplier ID',   required: false },
        { key: 'description',  label: 'Description',   required: false },
        { key: 'weight',       label: 'Weight (kg)',   required: false, type: 'number' },
        { key: 'status',       label: 'Status',        required: false },
      ],
    },
    suppliers: {
      label: 'Suppliers',
      icon: 'fa-building',
      fields: [
        { key: 'company_name', label: 'Company Name',  required: true  },
        { key: 'email',        label: 'Email',         required: true,  type: 'email' },
        { key: 'phone',        label: 'Phone',         required: false },
        { key: 'country',      label: 'Country',       required: false },
        { key: 'city',         label: 'City',          required: false },
        { key: 'category',     label: 'Category',      required: false },
        { key: 'contact_name', label: 'Contact Name',  required: false },
        { key: 'website',      label: 'Website',       required: false },
      ],
    },
    orders: {
      label: 'Orders',
      icon: 'fa-shopping-bag',
      fields: [
        { key: 'order_id',     label: 'Order ID',      required: true  },
        { key: 'customer_id',  label: 'Customer ID',   required: true  },
        { key: 'order_date',   label: 'Order Date',    required: true,  type: 'date' },
        { key: 'total',        label: 'Total (USD)',   required: true,  type: 'number' },
        { key: 'status',       label: 'Status',        required: false },
        { key: 'payment_method', label: 'Payment Method', required: false },
        { key: 'shipping_address', label: 'Shipping Address', required: false },
      ],
    },
    customers: {
      label: 'Customers',
      icon: 'fa-users',
      fields: [
        { key: 'first_name',   label: 'First Name',    required: true  },
        { key: 'last_name',    label: 'Last Name',     required: true  },
        { key: 'email',        label: 'Email',         required: true,  type: 'email' },
        { key: 'phone',        label: 'Phone',         required: false },
        { key: 'country',      label: 'Country',       required: false },
        { key: 'city',         label: 'City',          required: false },
        { key: 'company',      label: 'Company',       required: false },
        { key: 'created_at',   label: 'Registration Date', required: false, type: 'date' },
      ],
    },
  };

  /* ── Sample export data ────────────────────────────────────────────────── */
  const SAMPLE_DATA = {
    products: [
      { sku: 'SKU-001', name: 'Wireless Headphones Pro', category: 'Electronics', price: 89.99, stock: 250, supplier_id: 'SUP-101', description: 'Premium audio', weight: 0.35, status: 'active' },
      { sku: 'SKU-002', name: 'Ergonomic Office Chair',  category: 'Furniture',   price: 349.00, stock: 40,  supplier_id: 'SUP-202', description: 'Lumbar support', weight: 15.2, status: 'active' },
      { sku: 'SKU-003', name: 'Stainless Steel Bottle',  category: 'Kitchen',     price: 24.99, stock: 500, supplier_id: 'SUP-101', description: '750ml BPA-free', weight: 0.28, status: 'active' },
      { sku: 'SKU-004', name: 'Bluetooth Speaker Cube',  category: 'Electronics', price: 59.99, stock: 120, supplier_id: 'SUP-303', description: '360° sound', weight: 0.42, status: 'active' },
      { sku: 'SKU-005', name: 'Yoga Mat Premium',        category: 'Sports',      price: 39.99, stock: 80,  supplier_id: 'SUP-404', description: 'Anti-slip 6mm', weight: 1.1,  status: 'active' },
    ],
    suppliers: [
      { company_name: 'TechSupply Co.',    email: 'info@techsupply.com',    phone: '+1-555-0101', country: 'USA',   city: 'San Francisco', category: 'Electronics', contact_name: 'Alice Wong',  website: 'techsupply.com' },
      { company_name: 'FurniPro Ltd.',     email: 'sales@furnipro.co.uk',   phone: '+44-20-0001', country: 'UK',    city: 'London',        category: 'Furniture',   contact_name: 'James Hill',  website: 'furnipro.co.uk' },
      { company_name: 'KitchenWorld GmbH', email: 'kontakt@kworld.de',      phone: '+49-30-0002', country: 'Germany', city: 'Berlin',      category: 'Kitchen',     contact_name: 'Hans Müller', website: 'kworld.de' },
      { company_name: 'SportGoods LLC',    email: 'hello@sportgoods.com',   phone: '+1-555-0303', country: 'USA',   city: 'Chicago',       category: 'Sports',      contact_name: 'Maria Cruz', website: 'sportgoods.com' },
    ],
    orders: [
      { order_id: 'ORD-1001', customer_id: 'CUST-01', order_date: '2025-01-15', total: 179.98, status: 'completed',  payment_method: 'Credit Card',  shipping_address: '123 Main St, NY' },
      { order_id: 'ORD-1002', customer_id: 'CUST-02', order_date: '2025-01-16', total: 349.00, status: 'processing', payment_method: 'Bank Transfer', shipping_address: '456 Oak Ave, LA' },
      { order_id: 'ORD-1003', customer_id: 'CUST-03', order_date: '2025-01-17', total: 84.98,  status: 'shipped',    payment_method: 'PayPal',        shipping_address: '789 Pine Rd, TX' },
      { order_id: 'ORD-1004', customer_id: 'CUST-04', order_date: '2025-01-18', total: 59.99,  status: 'pending',    payment_method: 'Credit Card',   shipping_address: '321 Elm St, FL' },
    ],
    customers: [
      { first_name: 'Alice',  last_name: 'Johnson', email: 'alice.j@email.com',  phone: '+1-555-1001', country: 'USA',     city: 'New York',  company: 'AliceCorp',    created_at: '2024-03-01' },
      { first_name: 'Bob',    last_name: 'Smith',   email: 'bob.s@email.com',    phone: '+1-555-1002', country: 'USA',     city: 'Los Angeles', company: 'BobTech',    created_at: '2024-04-15' },
      { first_name: 'Chiara', last_name: 'Rossi',   email: 'chiara.r@email.com', phone: '+39-06-0001', country: 'Italy',   city: 'Rome',      company: 'Rossi SRL',    created_at: '2024-05-20' },
      { first_name: 'David',  last_name: 'Lee',     email: 'david.l@email.com',  phone: '+65-0001',   country: 'Singapore', city: 'Singapore', company: 'LeeGlobal',  created_at: '2024-06-10' },
      { first_name: 'Emma',   last_name: 'Brown',   email: 'emma.b@email.com',   phone: '+44-20-0001', country: 'UK',      city: 'London',    company: 'Brown & Co',   created_at: '2024-07-05' },
    ],
  };

  /* ── State ─────────────────────────────────────────────────────────────── */
  let state = {
    importEntity:  'products',
    exportEntity:  'products',
    parsedData:    [],
    csvHeaders:    [],
    columnMapping: {},
    validationResult: { ready: 0, warnings: 0, errors: 0, total: 0, issues: [] },
    exportColumns: {},
    isImporting:   false,
    history:       [],
  };

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat(navigator.language || 'en', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso));
    } catch (_) { return iso; }
  }

  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (_) { return []; }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
    catch (_) { /* quota */ }
  }

  function showToast(msg, type = 'info') {
    const el = document.getElementById('bieToast');
    if (!el) return;
    el.className = `bie-toast ${type}`;
    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    el.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${escHtml(msg)}`;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  /* ── Tab switching ─────────────────────────────────────────────────────── */
  function switchTab(tabName) {
    document.querySelectorAll('.bie-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.bie-tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
    if (tabName === 'history') renderHistory();
  }

  /* ── Entity selection ──────────────────────────────────────────────────── */
  function selectImportEntity(entityKey) {
    state.importEntity = entityKey;
    document.querySelectorAll('#importEntityBtns .entity-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.entity === entityKey);
    });
    // reset file state if entity changes
    resetImportState();
  }

  function selectExportEntity(entityKey) {
    state.exportEntity = entityKey;
    document.querySelectorAll('#exportEntityBtns .entity-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.entity === entityKey);
    });
    buildExportColumnList();
  }

  function resetImportState() {
    state.parsedData = [];
    state.csvHeaders = [];
    state.columnMapping = {};
    state.validationResult = { ready: 0, warnings: 0, errors: 0, total: 0, issues: [] };

    const el = id => document.getElementById(id);
    hide('mappingSection');
    hide('previewSection');
    hide('validationSection');
    hide('importProgressSection');
    setInner('dropZoneFileName', '');
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.classList.remove('drag-over');
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) fileInput.value = '';
  }

  /* ── Drop zone ─────────────────────────────────────────────────────────── */
  function initDropZone() {
    const zone = document.getElementById('dropZone');
    const input = document.getElementById('csvFileInput');
    if (!zone || !input) return;

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(input.files[0]);
    });
  }

  /* ── CSV parsing ───────────────────────────────────────────────────────── */
  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      showToast('Please select a valid CSV file.', 'error');
      return;
    }
    setInner('dropZoneFileName', `<i class="fas fa-file-csv" style="color:#059669"></i> ${escHtml(file.name)}`);

    if (typeof Papa === 'undefined') {
      showToast('CSV parser not loaded. Check your connection.', 'error');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (!results.data || results.data.length === 0) {
          showToast('The CSV file appears to be empty.', 'warning');
          return;
        }
        state.parsedData = results.data;
        state.csvHeaders = results.meta.fields || [];
        autoMapColumns();
        renderMappingInterface();
        renderPreview();
        validateData();
        show('mappingSection');
        show('previewSection');
        show('validationSection');
        showToast(`Loaded ${results.data.length} rows from CSV.`, 'success');
      },
      error(err) {
        showToast(`Error parsing CSV: ${err.message}`, 'error');
      },
    });
  }

  /* ── Auto-mapping ──────────────────────────────────────────────────────── */
  function autoMapColumns() {
    const entityFields = ENTITIES[state.importEntity].fields;
    const mapping = {};

    state.csvHeaders.forEach(csvCol => {
      const normalized = csvCol.toLowerCase().replace(/[\s_-]+/g, '');
      const match = entityFields.find(f => {
        const fNorm = f.key.toLowerCase().replace(/[\s_-]+/g, '');
        const lNorm = f.label.toLowerCase().replace(/[\s_-]+/g, '');
        return normalized === fNorm || normalized === lNorm ||
               normalized.includes(fNorm) || fNorm.includes(normalized);
      });
      mapping[csvCol] = match ? match.key : '';
    });

    state.columnMapping = mapping;
  }

  /* ── Mapping interface ─────────────────────────────────────────────────── */
  function renderMappingInterface() {
    const container = document.getElementById('mappingContainer');
    if (!container) return;

    const entityFields = ENTITIES[state.importEntity].fields;
    const fieldOptions = entityFields.map(f =>
      `<option value="${escHtml(f.key)}">${escHtml(f.label)}${f.required ? ' *' : ''}</option>`
    ).join('');

    let html = `
      <div class="mapping-grid mapping-grid-head">
        <div>CSV Column</div><div class="mapping-arrow"></div><div>System Field</div>
      </div>`;

    state.csvHeaders.forEach(col => {
      const mapped = state.columnMapping[col] || '';
      const cls = mapped ? 'mapped' : 'unmapped';
      html += `
        <div class="mapping-grid">
          <div class="mapping-csv-col">${escHtml(col)}</div>
          <div class="mapping-arrow"><i class="fas fa-arrow-right"></i></div>
          <select class="mapping-select ${cls}" data-csv-col="${escHtml(col)}" onchange="GlobexSky.BulkImportExport.onMappingChange(this)">
            <option value="">— Skip this column —</option>
            ${fieldOptions}
          </select>
        </div>`;
    });

    container.innerHTML = html;

    // apply pre-selected values
    container.querySelectorAll('.mapping-select').forEach(sel => {
      const col = sel.dataset.csvCol;
      sel.value = state.columnMapping[col] || '';
    });
  }

  function onMappingChange(selectEl) {
    const col = selectEl.dataset.csvCol;
    state.columnMapping[col] = selectEl.value;
    selectEl.className = `mapping-select ${selectEl.value ? 'mapped' : 'unmapped'}`;
    validateData();
    renderPreview();
  }

  /* ── Preview table ─────────────────────────────────────────────────────── */
  function renderPreview() {
    const container = document.getElementById('previewContainer');
    if (!container || !state.parsedData.length) return;

    const mapped = Object.entries(state.columnMapping).filter(([, v]) => v);
    if (!mapped.length) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:.85rem;padding:8px">Map at least one column to see the preview.</p>';
      return;
    }

    const preview = state.parsedData.slice(0, MAX_PREVIEW_ROWS);
    const issues = state.validationResult.issues || [];

    const headers = mapped.map(([, sysField]) => {
      const f = ENTITIES[state.importEntity].fields.find(x => x.key === sysField);
      return `<th>${escHtml(f ? f.label : sysField)}</th>`;
    }).join('');

    const rows = preview.map((row, idx) => {
      const rowIssues = issues.filter(i => i.row === idx);
      const rowClass = rowIssues.some(i => i.level === 'error') ? 'row-error'
        : rowIssues.some(i => i.level === 'warning') ? 'row-warning' : '';

      const cells = mapped.map(([csvCol, sysField]) => {
        const val = row[csvCol] != null ? row[csvCol] : '';
        const cellIssue = rowIssues.find(i => i.field === sysField);
        const cls = cellIssue ? (cellIssue.level === 'error' ? 'cell-error' : 'cell-warning') : '';
        return `<td class="${cls}">${escHtml(val)}</td>`;
      }).join('');

      return `<tr class="${rowClass}"><td style="color:#94a3b8;font-size:.75rem;width:40px">${idx + 1}</td>${cells}</tr>`;
    }).join('');

    container.innerHTML = `
      <div class="preview-wrap">
        <table class="preview-table">
          <thead><tr><th>#</th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${state.parsedData.length > MAX_PREVIEW_ROWS
        ? `<p style="font-size:.8rem;color:#94a3b8;margin-top:8px;text-align:right">Showing first ${MAX_PREVIEW_ROWS} of ${state.parsedData.length} rows</p>`
        : ''}`;
  }

  /* ── Validation ────────────────────────────────────────────────────────── */
  function validateData() {
    const entityFields = ENTITIES[state.importEntity].fields;
    const issues = [];
    let errors = 0, warnings = 0;

    // check required fields mapped
    entityFields.filter(f => f.required).forEach(f => {
      const isMapped = Object.values(state.columnMapping).includes(f.key);
      if (!isMapped) {
        issues.push({ level: 'error', message: `Required field "${f.label}" is not mapped.`, row: -1, field: f.key });
        errors++;
      }
    });

    // per-row validation
    const reverseMap = {};
    Object.entries(state.columnMapping).forEach(([csvCol, sysField]) => {
      if (sysField) reverseMap[sysField] = csvCol;
    });

    state.parsedData.forEach((row, idx) => {
      entityFields.forEach(f => {
        if (!reverseMap[f.key]) return;
        const val = row[reverseMap[f.key]];
        if (f.required && (val == null || String(val).trim() === '')) {
          issues.push({ level: 'error', message: `Row ${idx + 1}: "${f.label}" is required but empty.`, row: idx, field: f.key });
          errors++;
        } else if (val != null && String(val).trim() !== '') {
          if (f.type === 'number' && isNaN(Number(String(val).replace(/[,$]/g, '')))) {
            issues.push({ level: 'error', message: `Row ${idx + 1}: "${f.label}" must be a number (got "${val}").`, row: idx, field: f.key });
            errors++;
          } else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
            issues.push({ level: 'warning', message: `Row ${idx + 1}: "${f.label}" may not be a valid email (got "${val}").`, row: idx, field: f.key });
            warnings++;
          } else if (f.type === 'date' && isNaN(Date.parse(String(val)))) {
            issues.push({ level: 'warning', message: `Row ${idx + 1}: "${f.label}" may not be a valid date (got "${val}").`, row: idx, field: f.key });
            warnings++;
          }
        }
      });
    });

    const total = state.parsedData.length;
    const ready = Math.max(0, total - errors);

    state.validationResult = { ready, warnings, errors, total, issues };
    renderValidationSummary();
  }

  function renderValidationSummary() {
    const r = state.validationResult;
    setInner('vsReady',    r.ready);
    setInner('vsWarnings', r.warnings);
    setInner('vsErrors',   r.errors);
    setInner('vsTotal',    r.total);

    const btn = document.getElementById('startImportBtn');
    if (btn) btn.disabled = r.errors > 0 || r.total === 0;

    const errList = document.getElementById('validationIssueList');
    if (!errList) return;
    if (!r.issues.length) {
      errList.innerHTML = '<li style="color:#059669"><i class="fas fa-check-circle"></i> No issues found — ready to import!</li>';
    } else {
      const shownIssues = r.issues.slice(0, 20);
      errList.innerHTML = shownIssues.map(i => `
        <li class="${i.level}">
          <i class="fas fa-${i.level === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i>
          ${escHtml(i.message)}
        </li>`).join('');
      if (r.issues.length > 20) {
        errList.innerHTML += `<li style="color:#94a3b8"><i class="fas fa-ellipsis-h"></i> …and ${r.issues.length - 20} more issue(s)</li>`;
      }
    }
  }

  /* ── Import simulation ─────────────────────────────────────────────────── */
  function startImport() {
    if (state.isImporting) return;
    const r = state.validationResult;
    if (r.errors > 0 || r.total === 0) {
      showToast('Fix all errors before importing.', 'error');
      return;
    }

    state.isImporting = true;
    show('importProgressSection');
    setProgress(0, 'Preparing import…');
    document.getElementById('startImportBtn').disabled = true;

    let progress = 0;
    const total = r.total;
    const stepMs = Math.max(40, Math.round(3000 / total));

    const interval = setInterval(() => {
      progress++;
      const pct = Math.round((progress / total) * 100);
      setProgress(pct, `Importing row ${progress} of ${total}…`);
      if (progress >= total) {
        clearInterval(interval);
        finishImport(total);
      }
    }, stepMs);
  }

  function setProgress(pct, label) {
    const bar = document.getElementById('importProgressBar');
    const lbl = document.getElementById('importProgressLabel');
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${label} (${pct}%)`;
  }

  function finishImport(count) {
    state.isImporting = false;
    setProgress(100, 'Import complete!');
    showToast(`Successfully imported ${count} ${ENTITIES[state.importEntity].label.toLowerCase()}.`, 'success');

    const entry = {
      id: uid(),
      type: 'import',
      entity: state.importEntity,
      entityLabel: ENTITIES[state.importEntity].label,
      count,
      status: 'completed',
      timestamp: new Date().toISOString(),
      filename: document.getElementById('dropZoneFileName') ? document.getElementById('dropZoneFileName').textContent.trim().replace(/^\S+\s+/, '') : 'file.csv',
    };
    addHistoryEntry(entry);

    setTimeout(() => {
      document.getElementById('startImportBtn').disabled = false;
      resetImportState();
    }, 2500);
  }

  /* ── Export ────────────────────────────────────────────────────────────── */
  function buildExportColumnList() {
    const container = document.getElementById('exportColumnList');
    if (!container) return;

    const entityFields = ENTITIES[state.exportEntity].fields;
    // initialize all as checked
    if (!state.exportColumns[state.exportEntity]) {
      state.exportColumns[state.exportEntity] = entityFields.reduce((acc, f) => { acc[f.key] = true; return acc; }, {});
    }
    const selected = state.exportColumns[state.exportEntity];

    container.innerHTML = entityFields.map(f => `
      <label class="col-check-item">
        <input type="checkbox" data-field="${escHtml(f.key)}" ${selected[f.key] ? 'checked' : ''}
               onchange="GlobexSky.BulkImportExport.onExportColChange(this)"/>
        ${escHtml(f.label)}
      </label>`).join('');
  }

  function onExportColChange(cbEl) {
    if (!state.exportColumns[state.exportEntity]) state.exportColumns[state.exportEntity] = {};
    state.exportColumns[state.exportEntity][cbEl.dataset.field] = cbEl.checked;
  }

  function toggleAllExportCols(checked) {
    if (!state.exportColumns[state.exportEntity]) state.exportColumns[state.exportEntity] = {};
    document.querySelectorAll('#exportColumnList input[type="checkbox"]').forEach(cb => {
      cb.checked = checked;
      state.exportColumns[state.exportEntity][cb.dataset.field] = checked;
    });
  }

  function runExport() {
    const entity = state.exportEntity;
    const entityDef = ENTITIES[entity];
    const colMap = state.exportColumns[entity] || {};

    const selectedFields = entityDef.fields.filter(f => colMap[f.key] !== false);
    if (!selectedFields.length) {
      showToast('Select at least one column to export.', 'warning');
      return;
    }

    const dateFrom = document.getElementById('exportDateFrom') ? document.getElementById('exportDateFrom').value : '';
    const dateTo   = document.getElementById('exportDateTo')   ? document.getElementById('exportDateTo').value   : '';

    // Filter sample data by date range if applicable
    let data = [...SAMPLE_DATA[entity]];
    if (dateFrom || dateTo) {
      const dateField = entity === 'orders' ? 'order_date' : entity === 'customers' ? 'created_at' : null;
      if (dateField) {
        data = data.filter(row => {
          const d = row[dateField];
          if (!d) return true;
          if (dateFrom && d < dateFrom) return false;
          if (dateTo   && d > dateTo)   return false;
          return true;
        });
      }
    }

    const excelCompat = document.getElementById('excelCompatCheck') && document.getElementById('excelCompatCheck').checked;

    // Build CSV using PapaParse if available, otherwise manual
    let csvContent;
    if (typeof Papa !== 'undefined') {
      const rows = data.map(row => selectedFields.reduce((acc, f) => { acc[f.label] = row[f.key] != null ? row[f.key] : ''; return acc; }, {}));
      csvContent = Papa.unparse(rows, { header: true });
    } else {
      const headers = selectedFields.map(f => f.label).join(',');
      const bodyRows = data.map(row => selectedFields.map(f => {
        const v = row[f.key] != null ? String(row[f.key]) : '';
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','));
      csvContent = [headers, ...bodyRows].join('\r\n');
    }

    if (excelCompat) csvContent = '\uFEFF' + csvContent; // BOM for Excel UTF-8

    const filename = `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');

    const entry = {
      id: uid(),
      type: 'export',
      entity,
      entityLabel: entityDef.label,
      count: data.length,
      status: 'completed',
      timestamp: new Date().toISOString(),
      filename,
      csvContent,
    };
    addHistoryEntry(entry);
    showToast(`Exported ${data.length} ${entityDef.label.toLowerCase()} to ${filename}`, 'success');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  /* ── History ───────────────────────────────────────────────────────────── */
  function addHistoryEntry(entry) {
    state.history = readHistory();
    state.history.unshift(entry);
    if (state.history.length > 100) state.history = state.history.slice(0, 100);
    writeHistory(state.history);
  }

  function renderHistory() {
    state.history = readHistory();
    const container = document.getElementById('historyTableBody');
    if (!container) return;

    if (!state.history.length) {
      container.innerHTML = `
        <tr><td colspan="7">
          <div class="empty-state">
            <i class="fas fa-history"></i>
            <p>No import / export operations yet.</p>
          </div>
        </td></tr>`;
      return;
    }

    container.innerHTML = state.history.map(entry => {
      const typeIcon = entry.type === 'import' ? 'fa-file-import' : 'fa-file-export';
      const typeColor = entry.type === 'import' ? '#0052CC' : '#059669';
      const statusBadge = entry.status === 'completed'
        ? '<span class="badge-pill badge-green"><i class="fas fa-check"></i> Completed</span>'
        : entry.status === 'partial'
          ? '<span class="badge-pill badge-orange"><i class="fas fa-exclamation"></i> Partial</span>'
          : '<span class="badge-pill badge-red"><i class="fas fa-times"></i> Failed</span>';

      const dlBtn = (entry.type === 'export' && entry.csvContent)
        ? `<button class="btn btn-secondary btn-sm" onclick="GlobexSky.BulkImportExport.reDownload('${escHtml(entry.id)}')"><i class="fas fa-download"></i></button>`
        : '—';

      return `
        <tr>
          <td><i class="fas ${typeIcon}" style="color:${typeColor};margin-right:6px"></i>${escHtml(entry.type.charAt(0).toUpperCase() + entry.type.slice(1))}</td>
          <td>${escHtml(entry.entityLabel)}</td>
          <td>${escHtml(entry.filename || '—')}</td>
          <td>${escHtml(String(entry.count))}</td>
          <td>${statusBadge}</td>
          <td style="white-space:nowrap;font-size:.8rem;color:#64748b">${fmtDate(entry.timestamp)}</td>
          <td>${dlBtn}</td>
        </tr>`;
    }).join('');
  }

  function reDownload(id) {
    const entry = state.history.find(e => e.id === id);
    if (!entry || !entry.csvContent) { showToast('File no longer available.', 'warning'); return; }
    downloadFile(entry.csvContent, entry.filename || 'export.csv', 'text/csv;charset=utf-8;');
    showToast(`Downloading ${entry.filename}`, 'info');
  }

  function clearHistory() {
    if (!confirm('Clear all import/export history? This cannot be undone.')) return;
    state.history = [];
    writeHistory([]);
    renderHistory();
    showToast('History cleared.', 'info');
  }

  /* ── DOM helpers ───────────────────────────────────────────────────────── */
  function id(str)        { return document.getElementById(str); }
  function show(elId)     { const el = id(elId); if (el) el.style.display = ''; }
  function hide(elId)     { const el = id(elId); if (el) el.style.display = 'none'; }
  function setInner(elId, val) { const el = id(elId); if (el) el.textContent = val; }

  /* ── Initialise ────────────────────────────────────────────────────────── */
  function init() {
    initDropZone();
    buildExportColumnList();
    state.history = readHistory();

    // Set default active entity buttons
    document.querySelectorAll('#importEntityBtns .entity-btn[data-entity="products"]').forEach(b => b.classList.add('active'));
    document.querySelectorAll('#exportEntityBtns .entity-btn[data-entity="products"]').forEach(b => b.classList.add('active'));

    // Hide sections until file loaded
    hide('mappingSection');
    hide('previewSection');
    hide('validationSection');
    hide('importProgressSection');
  }

  /* ── Public API ────────────────────────────────────────────────────────── */
  return {
    init,
    switchTab,
    selectImportEntity,
    selectExportEntity,
    onMappingChange,
    onExportColChange,
    toggleAllExportCols,
    startImport,
    runExport,
    reDownload,
    clearHistory,
  };

})();

/* ── Auto-init on DOMContentLoaded ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof GlobexSky !== 'undefined' && GlobexSky.BulkImportExport) {
    GlobexSky.BulkImportExport.init();
  }
});
