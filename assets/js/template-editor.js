/**
 * template-editor.js
 * Email/SMS Template Management — frontend logic for pages/admin/email-sms-templates.html
 */

const API = '/api/v1/templates';
const TOKEN = () => localStorage.getItem('token') || '';

// ─── Registered template variables ───────────────────────────────────────────
const ALL_VARIABLES = [
  { name: 'customer_name',    desc: 'Full name of the customer' },
  { name: 'first_name',       desc: 'Customer first name' },
  { name: 'last_name',        desc: 'Customer last name' },
  { name: 'email',            desc: 'Customer email address' },
  { name: 'order_id',         desc: 'Order identifier' },
  { name: 'order_date',       desc: 'Date of order' },
  { name: 'amount',           desc: 'Order amount' },
  { name: 'currency',         desc: 'Currency code' },
  { name: 'product_name',     desc: 'Product name' },
  { name: 'tracking_number',  desc: 'Shipment tracking number' },
  { name: 'shipping_address', desc: 'Full shipping address' },
  { name: 'estimated_delivery', desc: 'Estimated delivery date' },
  { name: 'reset_url',        desc: 'Password reset link' },
  { name: 'verification_url', desc: 'Account verification link' },
  { name: 'unsubscribe_url',  desc: 'Unsubscribe link' },
  { name: 'platform_name',    desc: 'Platform/brand name' },
  { name: 'support_url',      desc: 'Support page link' },
  { name: 'year',             desc: 'Current year' },
];

// ─── State ────────────────────────────────────────────────────────────────────
let templates = [];
let currentPage = 1;
let totalTemplates = 0;
let editingId = null;
let activeFilter = { type: '', category: '', search: '' };
let previewDebounceTimer = null;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN()}`,
      ...options.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

// ─── Toast notifications ──────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  const el = document.getElementById('te-toast');
  if (!el) return;
  el.className = `te-toast ${type}`;
  el.innerHTML = `<i class="fa fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${escHtml(msg)}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Load & render template list ─────────────────────────────────────────────

async function loadTemplates(page = 1) {
  currentPage = page;
  const params = new URLSearchParams({ page, limit: 15 });
  if (activeFilter.type) params.set('type', activeFilter.type);
  if (activeFilter.category) params.set('category', activeFilter.category);
  if (activeFilter.search) params.set('search', activeFilter.search);

  try {
    const data = await apiFetch(`${API}?${params}`);
    templates = data.data ?? [];
    totalTemplates = data.total ?? 0;
    renderTemplateList();
    renderPagination(data.total, data.page, data.limit);
    document.getElementById('total-count').textContent = data.total ?? 0;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderTemplateList() {
  const tbody = document.getElementById('template-tbody');
  if (!tbody) return;

  if (!templates.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><i class="fa fa-envelope-open-text"></i><p>No templates found.</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = templates.map((t) => `
    <tr>
      <td>
        <div class="template-name-cell">
          <span class="template-name">${escHtml(t.name)}</span>
          <span class="template-category">${escHtml(t.category || '')}</span>
        </div>
      </td>
      <td><span class="badge badge-${t.type}">${t.type === 'email' ? '✉ Email' : '💬 SMS'}</span></td>
      <td>${escHtml(t.subject || '—')}</td>
      <td>
        <span class="badge ${t.is_active ? 'badge-green' : 'badge-gray'}">
          ${t.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="openEditModal('${t.id}')"><i class="fa fa-pen"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="openPreviewModal('${t.id}')"><i class="fa fa-eye"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="cloneTemplate('${t.id}')"><i class="fa fa-copy"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="toggleTemplate('${t.id}', ${t.is_active})" title="${t.is_active ? 'Disable' : 'Enable'}">
            <i class="fa fa-${t.is_active ? 'toggle-on' : 'toggle-off'}"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteTemplate('${t.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination(total, page, limit) {
  const el = document.getElementById('pagination');
  if (!el) return;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}" onclick="loadTemplates(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function openCreateModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New Template';
  resetEditorForm();
  document.getElementById('editor-modal').classList.remove('hidden');
}

async function openEditModal(id) {
  editingId = id;
  try {
    const { data: t } = await apiFetch(`${API}/${id}`);
    document.getElementById('modal-title').textContent = 'Edit Template';
    document.getElementById('tpl-name').value = t.name;
    document.getElementById('tpl-type').value = t.type;
    document.getElementById('tpl-category').value = t.category || '';
    document.getElementById('tpl-subject').value = t.subject || '';
    document.getElementById('tpl-change-note').value = '';
    onTypeChange(t.type);
    if (t.type === 'sms') {
      document.getElementById('tpl-sms-body').value = t.body;
      updateSmsCounter();
    } else {
      document.getElementById('tpl-rich-editor').innerHTML = t.body;
    }
    document.getElementById('editor-modal').classList.remove('hidden');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function closeEditorModal() {
  document.getElementById('editor-modal').classList.add('hidden');
  editingId = null;
}

function resetEditorForm() {
  document.getElementById('tpl-name').value = '';
  document.getElementById('tpl-type').value = 'email';
  document.getElementById('tpl-category').value = '';
  document.getElementById('tpl-subject').value = '';
  document.getElementById('tpl-change-note').value = '';
  document.getElementById('tpl-rich-editor').innerHTML = '';
  document.getElementById('tpl-sms-body').value = '';
  onTypeChange('email');
}

function onTypeChange(typeVal) {
  const type = typeVal || document.getElementById('tpl-type').value;
  document.getElementById('subject-row').style.display = type === 'email' ? '' : 'none';
  document.getElementById('email-editor-wrap').style.display = type === 'email' ? '' : 'none';
  document.getElementById('sms-editor-wrap').style.display = type === 'sms' ? '' : 'none';
}

async function saveTemplate() {
  const type = document.getElementById('tpl-type').value;
  const body = type === 'sms'
    ? document.getElementById('tpl-sms-body').value
    : document.getElementById('tpl-rich-editor').innerHTML;

  const payload = {
    name: document.getElementById('tpl-name').value.trim(),
    type,
    category: document.getElementById('tpl-category').value.trim(),
    subject: document.getElementById('tpl-subject').value.trim() || null,
    body,
    change_note: document.getElementById('tpl-change-note').value.trim(),
  };

  if (!payload.name || !payload.category || !payload.body) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  try {
    if (editingId) {
      await apiFetch(`${API}/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Template updated successfully!', 'success');
    } else {
      await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });
      showToast('Template created successfully!', 'success');
    }
    closeEditorModal();
    loadTemplates(currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Preview modal ────────────────────────────────────────────────────────────

async function openPreviewModal(id) {
  document.getElementById('preview-modal').classList.remove('hidden');
  document.getElementById('preview-content').innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8"><i class="fa fa-spinner fa-spin"></i> Loading preview…</div>';
  try {
    const [{ data: t }, { data: rendered }] = await Promise.all([
      apiFetch(`${API}/${id}`),
      apiFetch(`${API}/${id}/preview`, { method: 'POST', body: JSON.stringify({}) }),
    ]);

    document.getElementById('preview-template-name').textContent = t.name;
    if (t.type === 'email') {
      document.getElementById('preview-content').innerHTML = `
        <div class="preview-subject"><strong>Subject:</strong> ${escHtml(rendered.subject)}</div>
        <div class="preview-body">${rendered.body}</div>
      `;
    } else {
      document.getElementById('preview-content').innerHTML = `
        <div class="preview-body" style="font-family:monospace;white-space:pre-wrap">${escHtml(rendered.body)}</div>
      `;
    }
    document.getElementById('preview-test-btn').onclick = () => openTestSendModal(id, t.type);
    document.getElementById('preview-versions-btn').onclick = () => openVersionsModal(id);
  } catch (e) {
    document.getElementById('preview-content').innerHTML = `<div class="preview-body" style="color:#ef4444">${escHtml(e.message)}</div>`;
  }
}

function closePreviewModal() {
  document.getElementById('preview-modal').classList.add('hidden');
}

// ─── Test send modal ──────────────────────────────────────────────────────────

function openTestSendModal(id, type) {
  document.getElementById('test-template-id').value = id;
  document.getElementById('test-to-label').textContent = type === 'sms' ? 'Phone Number (E.164)' : 'Email Address';
  document.getElementById('test-to').value = '';
  document.getElementById('test-modal').classList.remove('hidden');
}

function closeTestModal() {
  document.getElementById('test-modal').classList.add('hidden');
}

async function sendTestMessage() {
  const id = document.getElementById('test-template-id').value;
  const to = document.getElementById('test-to').value.trim();
  if (!to) { showToast('Please enter a recipient.', 'error'); return; }

  try {
    const { message } = await apiFetch(`${API}/${id}/test-send`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
    showToast(message, 'success');
    closeTestModal();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Version history modal ────────────────────────────────────────────────────

async function openVersionsModal(id) {
  document.getElementById('versions-modal').classList.remove('hidden');
  document.getElementById('versions-list').innerHTML = '<li style="padding:20px;color:#94a3b8;text-align:center"><i class="fa fa-spinner fa-spin"></i></li>';
  document.getElementById('versions-template-id').value = id;
  try {
    const { data: versions } = await apiFetch(`${API}/${id}/versions`);
    if (!versions.length) {
      document.getElementById('versions-list').innerHTML = '<li style="padding:20px;color:#94a3b8;text-align:center">No version history yet.</li>';
      return;
    }
    document.getElementById('versions-list').innerHTML = versions.map((v) => `
      <li class="version-item">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span class="version-number">v${v.version_number}</span>
          <button class="btn btn-sm btn-secondary" onclick="restoreVersion('${id}', ${v.version_number})">
            <i class="fa fa-history"></i> Restore
          </button>
        </div>
        <div class="version-meta">${v.changed_by ? `by ${escHtml(v.changed_by)}` : ''} • ${new Date(v.created_at).toLocaleString()}</div>
        ${v.change_note ? `<div class="version-note">"${escHtml(v.change_note)}"</div>` : ''}
      </li>
    `).join('');
  } catch (e) {
    document.getElementById('versions-list').innerHTML = `<li style="padding:16px;color:#ef4444">${escHtml(e.message)}</li>`;
  }
}

function closeVersionsModal() {
  document.getElementById('versions-modal').classList.add('hidden');
}

async function restoreVersion(templateId, versionNumber) {
  if (!confirm(`Restore version ${versionNumber}? The current content will be saved as a new version.`)) return;
  try {
    await apiFetch(`${API}/${templateId}/versions/${versionNumber}/restore`, { method: 'POST' });
    showToast(`Restored to version ${versionNumber}`, 'success');
    closeVersionsModal();
    loadTemplates(currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Clone ────────────────────────────────────────────────────────────────────

async function cloneTemplate(id) {
  if (!confirm('Create a copy of this template?')) return;
  try {
    await apiFetch(`${API}/${id}/clone`, { method: 'POST' });
    showToast('Template cloned!', 'success');
    loadTemplates(currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Toggle active ────────────────────────────────────────────────────────────

async function toggleTemplate(id, currentActive) {
  try {
    await apiFetch(`${API}/${id}/toggle`, { method: 'PATCH' });
    showToast(`Template ${currentActive ? 'disabled' : 'enabled'}`, 'success');
    loadTemplates(currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteTemplate(id) {
  if (!confirm('Delete this template? This action cannot be undone.')) return;
  try {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    showToast('Template deleted.', 'success');
    loadTemplates(currentPage);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Rich text editor toolbar ─────────────────────────────────────────────────

function execFormat(cmd, value = null) {
  document.execCommand(cmd, false, value);
  document.getElementById('tpl-rich-editor').focus();
}

function insertVariable(varName) {
  const tag = `{{${varName}}}`;
  const type = document.getElementById('tpl-type').value;
  if (type === 'sms') {
    const ta = document.getElementById('tpl-sms-body');
    const start = ta.selectionStart;
    ta.value = ta.value.slice(0, start) + tag + ta.value.slice(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = start + tag.length;
    ta.focus();
    updateSmsCounter();
  } else {
    const editor = document.getElementById('tpl-rich-editor');
    editor.focus();
    document.execCommand('insertHTML', false,
      `<span class="variable-tag" contenteditable="false">${escHtml(tag)}</span>&nbsp;`);
  }
  schedulePreview();
}

// ─── SMS character counter ────────────────────────────────────────────────────

function updateSmsCounter() {
  const text = document.getElementById('tpl-sms-body')?.value || '';
  const len = text.length;
  // SMS segments: up to 160 chars = 1 segment at 160 chars/seg;
  // over 160 chars uses 153 chars/seg (7 bytes reserved for UDH header)
  const charsPerSeg = len <= 160 ? 160 : 153;
  const segments = len === 0 ? 1 : Math.ceil(len / charsPerSeg);

  const counter = document.getElementById('sms-counter');
  if (!counter) return;
  counter.querySelector('.char-count').textContent = `${len} chars`;
  counter.querySelector('.segment-count').textContent = `${segments} segment${segments > 1 ? 's' : ''}`;
  counter.className = `sms-counter ${len > 306 ? 'danger' : len > 160 ? 'warn' : ''}`;
}

// ─── Live preview (debounced) ─────────────────────────────────────────────────

function schedulePreview() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(updateInlinePreview, 600);
}

async function updateInlinePreview() {
  const type = document.getElementById('tpl-type')?.value;
  const body = type === 'sms'
    ? document.getElementById('tpl-sms-body')?.value
    : document.getElementById('tpl-rich-editor')?.innerHTML;
  const subject = document.getElementById('tpl-subject')?.value;
  if (!body) return;

  try {
    const { data } = await apiFetch(`${API}/preview-raw`, {
      method: 'POST',
      body: JSON.stringify({ body, subject }),
    });
    const previewEl = document.getElementById('inline-preview');
    if (!previewEl) return;
    if (type === 'email') {
      previewEl.innerHTML = `
        ${data.subject ? `<div class="preview-subject"><strong>Subject:</strong> ${escHtml(data.subject)}</div>` : ''}
        <div class="preview-body">${data.body}</div>
      `;
    } else {
      previewEl.innerHTML = `<div class="preview-body" style="font-family:monospace;white-space:pre-wrap">${escHtml(data.body)}</div>`;
    }
  } catch (_) { /* ignore preview errors */ }
}

// ─── Filter/search handlers ───────────────────────────────────────────────────

function applyFilters() {
  activeFilter.type = document.getElementById('filter-type')?.value || '';
  activeFilter.category = document.getElementById('filter-category')?.value || '';
  activeFilter.search = document.getElementById('filter-search')?.value || '';
  loadTemplates(1);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function buildVariableChips() {
  const container = document.getElementById('variable-chips');
  if (!container) return;
  container.innerHTML = ALL_VARIABLES.map((v) =>
    `<button class="variable-tag-chip" title="${escHtml(v.desc)}" onclick="insertVariable('${v.name}')">
      <i class="fa fa-at"></i> ${v.name}
    </button>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  buildVariableChips();
  loadTemplates(1);

  // SMS counter
  document.getElementById('tpl-sms-body')?.addEventListener('input', () => {
    updateSmsCounter();
    schedulePreview();
  });

  // Rich editor live preview
  document.getElementById('tpl-rich-editor')?.addEventListener('input', schedulePreview);

  // Type switcher
  document.getElementById('tpl-type')?.addEventListener('change', (e) => onTypeChange(e.target.value));

  // Search input debounce
  let searchTimer;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 400);
  });

  // Filter dropdowns
  document.getElementById('filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('filter-category')?.addEventListener('change', applyFilters);
});
