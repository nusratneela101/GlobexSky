/**
 * email-sms-templates.js
 * Email/SMS Template Management — CRUD operations and page logic
 * for pages/admin/email-sms-templates.html
 */

const TEMPLATES_API = '/api/v1/templates';
const getToken = () => localStorage.getItem('token') || '';

// ─── Supported template categories ───────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  'Order Confirmation',
  'Shipping',
  'Delivery',
  'Welcome',
  'Password Reset',
  'Account Verification',
  'Promotion',
  'Newsletter',
  'Payment',
  'Refund',
  'Support',
  'Other',
];

// ─── Available template variables ────────────────────────────────────────────
const TEMPLATE_VARIABLES = [
  { name: 'customer_name',      desc: 'Full name of the customer' },
  { name: 'first_name',         desc: 'Customer first name' },
  { name: 'last_name',          desc: 'Customer last name' },
  { name: 'email',              desc: 'Customer email address' },
  { name: 'order_id',           desc: 'Order identifier' },
  { name: 'order_date',         desc: 'Date of order' },
  { name: 'amount',             desc: 'Order amount' },
  { name: 'currency',           desc: 'Currency code' },
  { name: 'product_name',       desc: 'Product name' },
  { name: 'tracking_number',    desc: 'Shipment tracking number' },
  { name: 'shipping_address',   desc: 'Full shipping address' },
  { name: 'estimated_delivery', desc: 'Estimated delivery date' },
  { name: 'reset_url',          desc: 'Password reset link' },
  { name: 'verification_url',   desc: 'Account verification link' },
  { name: 'unsubscribe_url',    desc: 'Unsubscribe link' },
  { name: 'platform_name',      desc: 'Platform / brand name' },
  { name: 'support_url',        desc: 'Support page link' },
  { name: 'year',               desc: 'Current year' },
];

// ─── Page state ───────────────────────────────────────────────────────────────
let _templates   = [];
let _currentPage = 1;
let _totalCount  = 0;
let _editingId   = null;
let _activeTab   = 'email';
let _filter      = { search: '', category: '' };
let _previewTimer = null;

// ─── Low-level API fetch helper ───────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...opts.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

// ─── Toast helper ─────────────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  const el = document.getElementById('est-toast');
  if (!el) return;
  el.className = `tpl-toast ${type}`;
  const icon = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' }[type] || 'info-circle';
  el.innerHTML = `<i class="fa fa-${icon}"></i> ${escHtml(msg)}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ─── Escape HTML (XSS guard) ──────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Friendly date ────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Load & render template list ─────────────────────────────────────────────

async function loadTemplates(page = 1) {
  _currentPage = page;
  const params = new URLSearchParams({ page, limit: 12, type: _activeTab });
  if (_filter.search)   params.set('search', _filter.search);
  if (_filter.category) params.set('category', _filter.category);

  try {
    const data = await apiFetch(`${TEMPLATES_API}?${params}`);
    _templates  = data.data  ?? [];
    _totalCount = data.total ?? 0;
    renderCards();
    renderPagination(data.total, data.page, data.limit);
    updateMetrics();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Render template cards ────────────────────────────────────────────────────

function renderCards() {
  const grid = document.getElementById('est-grid');
  if (!grid) return;

  if (_templates.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="fas fa-${_activeTab === 'email' ? 'envelope' : 'sms'}"></i>
        <h3>No ${_activeTab === 'email' ? 'email' : 'SMS'} templates found</h3>
        <p>Create your first template using the button above.</p>
      </div>`;
    return;
  }

  grid.innerHTML = _templates.map((t) => `
    <div class="template-card" data-id="${t.id}">
      <div class="template-card-header">
        <span class="template-card-title">${escHtml(t.name)}</span>
        <span class="status-dot ${t.is_active ? 'active' : 'inactive'}" title="${t.is_active ? 'Active' : 'Inactive'}"></span>
      </div>
      <div class="template-card-meta">
        <i class="fas fa-tag"></i> ${escHtml(t.category)}
        ${t.subject ? `<span>·</span><i class="fas fa-heading"></i> ${escHtml(t.subject)}` : ''}
      </div>
      <div class="template-card-meta">
        <i class="fas fa-clock"></i> ${fmtDate(t.updated_at || t.created_at)}
        ${Array.isArray(t.variables) && t.variables.length ? `<span>·</span><i class="fas fa-code"></i> ${t.variables.length} var${t.variables.length !== 1 ? 's' : ''}` : ''}
      </div>
      <div class="template-card-body">${escHtml(stripHtml(t.body || ''))}</div>
      <div class="template-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${t.id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="openPreviewModal('${t.id}')"><i class="fas fa-eye"></i> Preview</button>
        <button class="btn btn-secondary btn-sm" onclick="cloneTemplate('${t.id}')"><i class="fas fa-copy"></i></button>
        <button class="btn btn-secondary btn-sm" onclick="toggleTemplate('${t.id}', ${!t.is_active})" title="${t.is_active ? 'Disable' : 'Enable'}">
          <i class="fas fa-${t.is_active ? 'toggle-on' : 'toggle-off'}"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${t.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination(total, page, limit) {
  const wrap = document.getElementById('est-pagination');
  if (!wrap) return;
  const pages = Math.ceil(total / limit) || 1;
  if (pages <= 1) { wrap.innerHTML = ''; return; }

  const btns = [];
  btns.push(`<button class="page-btn" onclick="loadTemplates(${page - 1})" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`);
  for (let i = 1; i <= pages; i++) {
    btns.push(`<button class="page-btn ${i === page ? 'active' : ''}" onclick="loadTemplates(${i})">${i}</button>`);
  }
  btns.push(`<button class="page-btn" onclick="loadTemplates(${page + 1})" ${page === pages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`);
  wrap.innerHTML = btns.join('');
}

// ─── Metrics update ───────────────────────────────────────────────────────────

async function updateMetrics() {
  try {
    const [emailData, smsData] = await Promise.all([
      apiFetch(`${TEMPLATES_API}?type=email&limit=1`),
      apiFetch(`${TEMPLATES_API}?type=sms&limit=1`),
    ]);
    const [activeEmail] = await Promise.all([
      apiFetch(`${TEMPLATES_API}?type=email&is_active=true&limit=1`),
    ]);

    setMetric('metric-email', emailData.total ?? 0);
    setMetric('metric-sms', smsData.total ?? 0);
    setMetric('metric-active', (activeEmail.total ?? 0));
    setMetric('metric-total', (emailData.total ?? 0) + (smsData.total ?? 0));
  } catch (_) { /* metrics are non-critical */ }
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(type) {
  _activeTab = type;
  _currentPage = 1;
  document.querySelectorAll('.tpl-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === type));
  loadTemplates(1);
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function openCreateModal() {
  _editingId = null;
  resetForm();
  setTypeView(_activeTab);
  document.getElementById('est-modal-title').textContent = `New ${_activeTab === 'email' ? 'Email' : 'SMS'} Template`;
  showModal('est-editor-modal');
}

async function openEditModal(id) {
  try {
    const { data } = await apiFetch(`${TEMPLATES_API}/${id}`);
    _editingId = id;
    fillForm(data);
    setTypeView(data.type);
    document.getElementById('est-modal-title').textContent = 'Edit Template';
    showModal('est-editor-modal');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function resetForm() {
  document.getElementById('est-form')?.reset();
  const richEditor = document.getElementById('est-rich-editor');
  if (richEditor) richEditor.innerHTML = '';
  const counter = document.getElementById('est-sms-counter');
  if (counter) { counter.querySelector('.char-count').textContent = '0 chars'; counter.querySelector('.segment-count').textContent = '1 segment'; counter.className = 'sms-counter'; }
  clearPreview();
}

function fillForm(t) {
  setVal('est-name', t.name);
  setVal('est-category', t.category);
  setVal('est-type', t.type);
  setVal('est-subject', t.subject || '');
  setVal('est-active', t.is_active);

  if (t.type === 'sms') {
    setVal('est-sms-body', t.body || '');
    updateSmsCounter();
  } else {
    const editor = document.getElementById('est-rich-editor');
    if (editor) editor.innerHTML = t.body || '';
  }
  schedulePreview();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!val;
  else el.value = val ?? '';
}

function setTypeView(type) {
  const emailSection = document.getElementById('est-email-section');
  const smsSection   = document.getElementById('est-sms-section');
  if (emailSection) emailSection.style.display = type === 'email' ? '' : 'none';
  if (smsSection)   smsSection.style.display   = type === 'sms'   ? '' : 'none';
  setVal('est-type', type);
}

// ─── Save template (create or update) ────────────────────────────────────────

async function saveTemplate() {
  const type     = document.getElementById('est-type')?.value || _activeTab;
  const name     = document.getElementById('est-name')?.value?.trim();
  const category = document.getElementById('est-category')?.value?.trim();
  const subject  = document.getElementById('est-subject')?.value?.trim();
  const isActive = document.getElementById('est-active')?.checked ?? true;

  let body = '';
  if (type === 'sms') {
    body = document.getElementById('est-sms-body')?.value || '';
  } else {
    body = document.getElementById('est-rich-editor')?.innerHTML || '';
  }

  if (!name) { showToast('Template name is required', 'error'); return; }
  if (!category) { showToast('Category is required', 'error'); return; }
  if (!body) { showToast('Template body is required', 'error'); return; }
  if (type === 'email' && !subject) { showToast('Subject is required for email templates', 'error'); return; }

  const payload = { name, type, category, body, is_active: isActive, ...(type === 'email' && { subject }) };

  try {
    if (_editingId) {
      await apiFetch(`${TEMPLATES_API}/${_editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Template updated', 'success');
    } else {
      await apiFetch(TEMPLATES_API, { method: 'POST', body: JSON.stringify(payload) });
      showToast('Template created', 'success');
    }
    closeModal('est-editor-modal');
    loadTemplates(_currentPage);
    updateMetrics();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Delete template ──────────────────────────────────────────────────────────

async function deleteTemplate(id) {
  if (!confirm('Delete this template? This cannot be undone.')) return;
  try {
    await apiFetch(`${TEMPLATES_API}/${id}`, { method: 'DELETE' });
    showToast('Template deleted', 'success');
    loadTemplates(_currentPage);
    updateMetrics();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Toggle active state ──────────────────────────────────────────────────────

async function toggleTemplate(id) {
  try {
    await apiFetch(`${TEMPLATES_API}/${id}/toggle`, { method: 'PATCH' });
    showToast('Status updated', 'success');
    loadTemplates(_currentPage);
    updateMetrics();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Clone template ───────────────────────────────────────────────────────────

async function cloneTemplate(id) {
  try {
    await apiFetch(`${TEMPLATES_API}/${id}/clone`, { method: 'POST' });
    showToast('Template duplicated', 'success');
    loadTemplates(_currentPage);
    updateMetrics();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Preview modal ────────────────────────────────────────────────────────────

async function openPreviewModal(id) {
  try {
    const [{ data: tpl }, { data: rendered }] = await Promise.all([
      apiFetch(`${TEMPLATES_API}/${id}`),
      apiFetch(`${TEMPLATES_API}/${id}/preview`, { method: 'POST', body: '{}' }),
    ]);
    const container = document.getElementById('est-preview-content');
    if (!container) return;

    if (tpl.type === 'email') {
      container.innerHTML = `
        ${rendered.subject ? `<div class="preview-subject"><strong>Subject:</strong> ${escHtml(rendered.subject)}</div>` : ''}
        <div class="preview-body">${rendered.body}</div>`;
    } else {
      container.innerHTML = `<div class="preview-body" style="font-family:monospace;white-space:pre-wrap;padding:12px">${escHtml(rendered.body)}</div>`;
    }

    document.getElementById('est-preview-title').textContent = `Preview: ${tpl.name}`;
    showModal('est-preview-modal');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Test send modal ──────────────────────────────────────────────────────────

function openTestSendModal(id) {
  document.getElementById('est-test-send-id').value = id || _editingId || '';
  document.getElementById('est-test-to').value = '';
  showModal('est-test-modal');
}

async function sendTestMessage() {
  const id = document.getElementById('est-test-send-id')?.value;
  const to = document.getElementById('est-test-to')?.value?.trim();
  if (!id || !to) { showToast('Recipient address/number is required', 'error'); return; }

  try {
    const { message } = await apiFetch(`${TEMPLATES_API}/${id}/test-send`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
    showToast(message || 'Test message sent', 'success');
    closeModal('est-test-modal');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Version history ──────────────────────────────────────────────────────────

async function openVersionsModal(id) {
  try {
    const vId = id || _editingId;
    if (!vId) return;
    const { data: versions } = await apiFetch(`${TEMPLATES_API}/${vId}/versions`);
    const list = document.getElementById('est-versions-list');
    if (!list) return;

    if (!versions.length) {
      list.innerHTML = '<p style="color:#64748b;font-size:.85rem">No version history yet.</p>';
    } else {
      list.innerHTML = versions.map((v) => `
        <div class="version-item">
          <div>
            <span class="version-badge">v${v.version_number}</span>
            <span style="margin-left:8px;font-size:.82rem;color:#374151">${escHtml(v.change_note || 'No note')}</span>
            <div style="font-size:.75rem;color:#94a3b8;margin-top:3px">${fmtDate(v.created_at)}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="restoreVersion('${vId}', ${v.version_number})">
            <i class="fas fa-undo"></i> Restore
          </button>
        </div>`).join('');
    }

    document.getElementById('est-versions-tpl-id').value = vId;
    showModal('est-versions-modal');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function restoreVersion(templateId, version) {
  if (!confirm(`Restore template to version ${version}?`)) return;
  try {
    await apiFetch(`${TEMPLATES_API}/${templateId}/versions/${version}/restore`, { method: 'POST' });
    showToast(`Restored to version ${version}`, 'success');
    closeModal('est-versions-modal');
    loadTemplates(_currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Rich text toolbar commands ───────────────────────────────────────────────

function execCmd(cmd, val = null) {
  document.getElementById('est-rich-editor')?.focus();
  document.execCommand(cmd, false, val);
  schedulePreview();
}

function insertLink() {
  const url = prompt('Enter URL:', 'https://');
  if (url) execCmd('createLink', url);
}

function insertImage() {
  const url = prompt('Enter image URL:', 'https://');
  if (url) execCmd('insertImage', url);
}

// ─── Variable insertion ───────────────────────────────────────────────────────

function insertVariable(name) {
  const type = document.getElementById('est-type')?.value || _activeTab;
  const tag  = `{{${name}}}`;

  if (type === 'sms') {
    const ta = document.getElementById('est-sms-body');
    if (!ta) return;
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, pos) + tag + ta.value.slice(pos);
    ta.selectionStart = ta.selectionEnd = pos + tag.length;
    ta.focus();
    updateSmsCounter();
  } else {
    const ed = document.getElementById('est-rich-editor');
    if (!ed) return;
    ed.focus();
    document.execCommand('insertText', false, tag);
  }
  schedulePreview();
}

// ─── SMS character / segment counter ─────────────────────────────────────────

function updateSmsCounter() {
  const body = document.getElementById('est-sms-body')?.value || '';
  const len  = body.length;
  const charsPerSeg = len <= 160 ? 160 : 153;
  const segments    = len === 0 ? 1 : Math.ceil(len / charsPerSeg);

  const counter = document.getElementById('est-sms-counter');
  if (!counter) return;
  counter.querySelector('.char-count').textContent    = `${len} chars`;
  counter.querySelector('.segment-count').textContent = `${segments} segment${segments !== 1 ? 's' : ''}`;
  counter.className = `sms-counter${len > 306 ? ' danger' : len > 160 ? ' warn' : ''}`;
}

// ─── Live preview (debounced) ─────────────────────────────────────────────────

function schedulePreview() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(updateInlinePreview, 600);
}

async function updateInlinePreview() {
  const type    = document.getElementById('est-type')?.value || _activeTab;
  const subject = document.getElementById('est-subject')?.value || '';
  const body    = type === 'sms'
    ? document.getElementById('est-sms-body')?.value
    : document.getElementById('est-rich-editor')?.innerHTML;
  if (!body) { clearPreview(); return; }

  try {
    const { data } = await apiFetch(`${TEMPLATES_API}/preview-raw`, {
      method: 'POST',
      body: JSON.stringify({ body, subject }),
    });
    const panel = document.getElementById('est-inline-preview');
    if (!panel) return;

    if (type === 'email') {
      panel.innerHTML = `
        ${data.subject ? `<div class="preview-subject"><strong>Subject:</strong> ${escHtml(data.subject)}</div>` : ''}
        <div class="preview-body">${data.body}</div>`;
    } else {
      panel.innerHTML = `<div class="preview-body" style="font-family:monospace;white-space:pre-wrap">${escHtml(data.body)}</div>`;
    }
  } catch (_) { /* ignore preview errors */ }
}

function clearPreview() {
  const panel = document.getElementById('est-inline-preview');
  if (panel) panel.innerHTML = '';
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ─── Build category options ───────────────────────────────────────────────────

function buildCategoryOptions(selectId, includeAll = false) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const allOpt = includeAll ? '<option value="">All Categories</option>' : '<option value="">Select category…</option>';
  el.innerHTML = allOpt + TEMPLATE_CATEGORIES.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

// ─── Build variable chips ─────────────────────────────────────────────────────

function buildVariableChips() {
  const wrap = document.getElementById('est-variable-chips');
  if (!wrap) return;
  wrap.innerHTML = TEMPLATE_VARIABLES.map((v) =>
    `<button class="variable-chip" title="${escHtml(v.desc)}" onclick="insertVariable('${v.name}')">{{${v.name}}}</button>`
  ).join('');
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function applyFilters() {
  _filter.search   = document.getElementById('est-search')?.value  || '';
  _filter.category = document.getElementById('est-filter-cat')?.value || '';
  loadTemplates(1);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Populate dynamic dropdowns
  buildCategoryOptions('est-category');
  buildCategoryOptions('est-filter-cat', true);
  buildVariableChips();

  // Load initial data
  loadTemplates(1);
  updateMetrics();

  // Tab buttons
  document.querySelectorAll('.tpl-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filter events
  let searchTimer;
  document.getElementById('est-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 400);
  });
  document.getElementById('est-filter-cat')?.addEventListener('change', applyFilters);

  // Type switcher inside form
  document.getElementById('est-type')?.addEventListener('change', (e) => setTypeView(e.target.value));

  // SMS counter + live preview
  document.getElementById('est-sms-body')?.addEventListener('input', () => {
    updateSmsCounter();
    schedulePreview();
  });

  // Rich editor live preview
  document.getElementById('est-rich-editor')?.addEventListener('input', schedulePreview);

  // Subject live preview
  document.getElementById('est-subject')?.addEventListener('input', schedulePreview);

  // Modal close on overlay click
  document.querySelectorAll('.tpl-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
});

// ─── Global exports (called by inline HTML event handlers) ───────────────────
window.ESTPage = {
  loadTemplates,
  openCreateModal,
  openEditModal,
  saveTemplate,
  deleteTemplate,
  toggleTemplate,
  cloneTemplate,
  openPreviewModal,
  openTestSendModal,
  sendTestMessage,
  openVersionsModal,
  restoreVersion,
  insertVariable,
  execCmd,
  insertLink,
  insertImage,
  switchTab,
  applyFilters,
  closeModal,
};
