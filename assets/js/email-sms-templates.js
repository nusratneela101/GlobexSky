/**
 * email-sms-templates.js
 * Email/SMS Template Management — localStorage-based CRUD and page logic
 * for pages/admin/email-sms-templates.html
 */

// ─── Storage key ──────────────────────────────────────────────────────────────
const LS_KEY = 'globexsky_email_sms_templates';

// ─── Registered template variables ───────────────────────────────────────────
const ALL_VARIABLES = [
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
  { name: 'platform_name',      desc: 'Platform/brand name' },
  { name: 'support_url',        desc: 'Support page link' },
  { name: 'year',               desc: 'Current year' },
];

// ─── Sample data for first-load initialization ────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-default-1',
    name: 'Order Confirmation',
    type: 'email',
    category: 'order_confirmation',
    subject: 'Your order {{order_id}} has been confirmed!',
    body: '<p>Hi {{customer_name}},</p><p>Thank you for your order! Your order <strong>{{order_id}}</strong> placed on {{order_date}} has been confirmed.</p><p><strong>Total:</strong> {{currency}} {{amount}}</p><p>We will send you a shipping update once your order is on its way.</p><p>Best regards,<br/>{{platform_name}} Team</p><p style="font-size:.8rem;color:#94a3b8"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-2',
    name: 'Shipping Update',
    type: 'email',
    category: 'shipping_update',
    subject: 'Your order {{order_id}} has shipped!',
    body: '<p>Hi {{customer_name}},</p><p>Great news! Your order <strong>{{order_id}}</strong> is on its way.</p><p><strong>Tracking number:</strong> {{tracking_number}}</p><p><strong>Estimated delivery:</strong> {{estimated_delivery}}</p><p><strong>Shipping to:</strong> {{shipping_address}}</p><p>Best regards,<br/>{{platform_name}} Team</p>',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-3',
    name: 'Welcome Email',
    type: 'email',
    category: 'welcome',
    subject: 'Welcome to {{platform_name}}, {{first_name}}!',
    body: '<p>Hi {{first_name}},</p><p>Welcome to <strong>{{platform_name}}</strong>! We are thrilled to have you on board.</p><p>Start exploring our catalog and place your first order today.</p><p>If you have any questions, visit our <a href="{{support_url}}">support center</a>.</p><p>Best regards,<br/>The {{platform_name}} Team</p><p style="font-size:.8rem;color:#94a3b8">© {{year}} {{platform_name}} | <a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-4',
    name: 'Password Reset',
    type: 'email',
    category: 'password_reset',
    subject: 'Reset your {{platform_name}} password',
    body: '<p>Hi {{first_name}},</p><p>We received a request to reset your password. Click the button below to create a new password:</p><p><a href="{{reset_url}}" style="background:#0052CC;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Reset Password</a></p><p>This link expires in 24 hours. If you did not request this, please ignore this email.</p><p>The {{platform_name}} Team</p>',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-5',
    name: 'Order Confirmation SMS',
    type: 'sms',
    category: 'order_confirmation',
    subject: null,
    body: 'Hi {{first_name}}, your order {{order_id}} is confirmed! Total: {{currency}} {{amount}}. Track it at {{support_url}}. - {{platform_name}}',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-6',
    name: 'Shipping Update SMS',
    type: 'sms',
    category: 'shipping_update',
    subject: null,
    body: 'Hi {{first_name}}, your order {{order_id}} has shipped! Tracking: {{tracking_number}}. Estimated delivery: {{estimated_delivery}}. - {{platform_name}}',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
  {
    id: 'tpl-default-7',
    name: 'Password Reset SMS',
    type: 'sms',
    category: 'password_reset',
    subject: null,
    body: 'Your {{platform_name}} password reset code is: {{reset_url}}. This code expires in 10 minutes. Do not share it with anyone.',
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [],
  },
];

// ─── Sample preview data ──────────────────────────────────────────────────────
const SAMPLE_DATA = {
  customer_name:      'Jane Smith',
  first_name:         'Jane',
  last_name:          'Smith',
  email:              'jane@example.com',
  order_id:           'ORD-20240315',
  order_date:         'March 15, 2024',
  amount:             '1,250.00',
  currency:           'USD',
  product_name:       'Industrial Widget Pro',
  tracking_number:    'TRK-9876543210',
  shipping_address:   '123 Business Ave, New York, NY 10001',
  estimated_delivery: 'March 20, 2024',
  reset_url:          'https://globexsky.com/reset?token=abc123',
  verification_url:   'https://globexsky.com/verify?token=xyz789',
  unsubscribe_url:    'https://globexsky.com/unsubscribe',
  platform_name:      'Globex Sky',
  support_url:        'https://globexsky.com/support',
  year:               new Date().getFullYear().toString(),
};

// ─── State ────────────────────────────────────────────────────────────────────
let templates = [];
let currentPage = 1;
let totalTemplates = 0;
let editingId = null;
let activeFilter = { type: '', category: '', search: '' };
let previewDebounceTimer = null;

// ─── UUID generator ───────────────────────────────────────────────────────────
function generateId() {
  return 'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function getAllTemplates() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function saveAllTemplates(all) {
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function initDefaultTemplates() {
  if (localStorage.getItem(LS_KEY) !== null) return;
  saveAllTemplates(DEFAULT_TEMPLATES);
}

// ─── Toast notifications ──────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('te-toast');
  if (!el) return;
  const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  el.className = `te-toast ${type}`;
  el.innerHTML = `<i class="fa fa-${icons[type] || 'info-circle'}"></i> ${escHtml(msg)}`;
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

// ─── Apply sample data to template body ──────────────────────────────────────
function applyVariables(text) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] || `{{${key}}}`);
}

// ─── Load & render template list ─────────────────────────────────────────────
function loadTemplates(page = 1) {
  currentPage = page;
  const PAGE_SIZE = 15;

  let all = getAllTemplates();

  // Apply filters
  if (activeFilter.type) all = all.filter(t => t.type === activeFilter.type);
  if (activeFilter.category) all = all.filter(t => t.category === activeFilter.category);
  if (activeFilter.search) {
    const q = activeFilter.search.toLowerCase();
    all = all.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.subject || '').toLowerCase().includes(q) ||
      (t.body || '').toLowerCase().includes(q)
    );
  }

  totalTemplates = all.length;
  templates = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  renderTemplateList();
  renderPagination(totalTemplates, page, PAGE_SIZE);

  // Update metric counters
  const allForMetrics = getAllTemplates();
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('total-count',  allForMetrics.length);
  setEl('email-count',  allForMetrics.filter(t => t.type === 'email').length);
  setEl('sms-count',    allForMetrics.filter(t => t.type === 'sms').length);
  setEl('active-count', allForMetrics.filter(t => t.is_active).length);
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

function openEditModal(id) {
  const all = getAllTemplates();
  const t = all.find(x => x.id === id);
  if (!t) { showToast('Template not found', 'error'); return; }

  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Template';
  document.getElementById('tpl-name').value = t.name;
  document.getElementById('tpl-type').value = t.type;
  document.getElementById('tpl-category').value = t.category || '';
  document.getElementById('tpl-subject').value = t.subject || '';
  document.getElementById('tpl-change-note').value = '';
  onTypeChange(t.type);
  if (t.type === 'sms') {
    document.getElementById('tpl-sms-body').value = t.body || '';
    updateSmsCounter();
  } else {
    document.getElementById('tpl-rich-editor').innerHTML = t.body || '';
  }
  schedulePreview();
  document.getElementById('editor-modal').classList.remove('hidden');
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
  const previewEl = document.getElementById('inline-preview');
  if (previewEl) previewEl.innerHTML = '<div class="preview-body" style="color:#94a3b8;text-align:center;padding-top:60px"><i class="fas fa-eye" style="font-size:2rem;display:block;margin-bottom:8px"></i>Preview will appear here as you type…</div>';
}

function onTypeChange(typeVal) {
  const type = typeVal || document.getElementById('tpl-type').value;
  document.getElementById('subject-row').style.display = type === 'email' ? '' : 'none';
  document.getElementById('email-editor-wrap').style.display = type === 'email' ? '' : 'none';
  document.getElementById('sms-editor-wrap').style.display = type === 'sms' ? '' : 'none';
}

function saveTemplate() {
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
  if (type === 'email' && !payload.subject) {
    showToast('Subject is required for email templates.', 'error');
    return;
  }

  const all = getAllTemplates();
  const now = new Date().toISOString();

  if (editingId) {
    const idx = all.findIndex(x => x.id === editingId);
    if (idx === -1) { showToast('Template not found.', 'error'); return; }
    const existing = all[idx];
    // Save current state as a version before overwriting
    const versions = existing.versions || [];
    versions.push({
      version_number: versions.length + 1,
      body: existing.body,
      subject: existing.subject,
      changed_at: existing.updated_at,
      change_note: payload.change_note || '',
    });
    all[idx] = { ...existing, ...payload, versions, updated_at: now };
    showToast('Template updated successfully!', 'success');
  } else {
    const newTpl = {
      id: generateId(),
      name: payload.name,
      type: payload.type,
      category: payload.category,
      subject: payload.subject,
      body: payload.body,
      is_active: true,
      created_at: now,
      updated_at: now,
      versions: [],
    };
    all.unshift(newTpl);
    showToast('Template created successfully!', 'success');
  }

  saveAllTemplates(all);
  closeEditorModal();
  loadTemplates(currentPage);
}

// ─── Preview modal ────────────────────────────────────────────────────────────
function openPreviewModal(id) {
  const all = getAllTemplates();
  const t = all.find(x => x.id === id);
  if (!t) { showToast('Template not found.', 'error'); return; }

  document.getElementById('preview-template-name').textContent = t.name;
  const renderedBody = applyVariables(t.body || '');
  const renderedSubject = applyVariables(t.subject || '');

  if (t.type === 'email') {
    document.getElementById('preview-content').innerHTML = `
      ${renderedSubject ? `<div class="preview-subject"><strong>Subject:</strong> ${escHtml(renderedSubject)}</div>` : ''}
      <div class="preview-body">${renderedBody}</div>
    `;
  } else {
    document.getElementById('preview-content').innerHTML = `
      <div class="preview-body" style="font-family:monospace;white-space:pre-wrap">${escHtml(renderedBody)}</div>
    `;
  }

  document.getElementById('preview-test-btn').onclick = () => openTestSendModal(id, t.type);
  document.getElementById('preview-versions-btn').onclick = () => openVersionsModal(id);
  document.getElementById('preview-modal').classList.remove('hidden');
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

function sendTestMessage() {
  const id = document.getElementById('test-template-id').value;
  const to = document.getElementById('test-to').value.trim();
  if (!to) { showToast('Please enter a recipient.', 'error'); return; }

  const all = getAllTemplates();
  const t = all.find(x => x.id === id);
  if (!t) { showToast('Template not found.', 'error'); return; }

  // Simulate sending (localStorage demo — no actual send)
  showToast(`Test ${t.type === 'sms' ? 'SMS' : 'email'} sent to ${to} (demo mode)`, 'success');
  closeTestModal();
}

// ─── Version history modal ────────────────────────────────────────────────────
function openVersionsModal(id) {
  const all = getAllTemplates();
  const t = all.find(x => x.id === id);
  if (!t) { showToast('Template not found.', 'error'); return; }

  document.getElementById('versions-modal').classList.remove('hidden');
  document.getElementById('versions-template-id').value = id;

  const versions = t.versions || [];
  if (!versions.length) {
    document.getElementById('versions-list').innerHTML = '<li style="padding:20px;color:#94a3b8;text-align:center">No version history yet.</li>';
    return;
  }

  document.getElementById('versions-list').innerHTML = versions.slice().reverse().map((v) => `
    <li class="version-item">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span class="version-number">v${v.version_number}</span>
        <button class="btn btn-sm btn-secondary" onclick="restoreVersion('${id}', ${v.version_number})">
          <i class="fa fa-history"></i> Restore
        </button>
      </div>
      <div class="version-meta">${v.changed_at ? new Date(v.changed_at).toLocaleString() : ''}</div>
      ${v.change_note ? `<div class="version-note">"${escHtml(v.change_note)}"</div>` : ''}
    </li>
  `).join('');
}

function closeVersionsModal() {
  document.getElementById('versions-modal').classList.add('hidden');
}

function restoreVersion(templateId, versionNumber) {
  if (!confirm(`Restore version ${versionNumber}? The current content will be saved as a new version.`)) return;

  const all = getAllTemplates();
  const idx = all.findIndex(x => x.id === templateId);
  if (idx === -1) { showToast('Template not found.', 'error'); return; }

  const t = all[idx];
  const version = (t.versions || []).find(v => v.version_number === versionNumber);
  if (!version) { showToast('Version not found.', 'error'); return; }

  // Save current state as new version
  const versions = t.versions || [];
  versions.push({
    version_number: versions.length + 1,
    body: t.body,
    subject: t.subject,
    changed_at: t.updated_at,
    change_note: `Restored from v${versionNumber}`,
  });

  all[idx] = { ...t, body: version.body, subject: version.subject, versions, updated_at: new Date().toISOString() };
  saveAllTemplates(all);
  showToast(`Restored to version ${versionNumber}`, 'success');
  closeVersionsModal();
  loadTemplates(currentPage);
}

// ─── Clone ────────────────────────────────────────────────────────────────────
function cloneTemplate(id) {
  if (!confirm('Create a copy of this template?')) return;
  const all = getAllTemplates();
  const t = all.find(x => x.id === id);
  if (!t) { showToast('Template not found.', 'error'); return; }

  const now = new Date().toISOString();
  const clone = {
    ...t,
    id: generateId(),
    name: `Copy of ${t.name}`,
    is_active: false,
    versions: [],
    created_at: now,
    updated_at: now,
  };
  all.unshift(clone);
  saveAllTemplates(all);
  showToast('Template cloned!', 'success');
  loadTemplates(currentPage);
}

// ─── Toggle active ────────────────────────────────────────────────────────────
function toggleTemplate(id, currentActive) {
  const all = getAllTemplates();
  const idx = all.findIndex(x => x.id === id);
  if (idx === -1) { showToast('Template not found.', 'error'); return; }
  all[idx].is_active = !currentActive;
  all[idx].updated_at = new Date().toISOString();
  saveAllTemplates(all);
  showToast(`Template ${currentActive ? 'disabled' : 'enabled'}`, 'success');
  loadTemplates(currentPage);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function deleteTemplate(id) {
  if (!confirm('Delete this template? This action cannot be undone.')) return;
  const all = getAllTemplates().filter(x => x.id !== id);
  saveAllTemplates(all);
  showToast('Template deleted.', 'success');
  loadTemplates(currentPage);
}

// ─── Export templates as JSON ─────────────────────────────────────────────────
function exportTemplates() {
  const all = getAllTemplates();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `globexsky-templates-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${all.length} templates`, 'success');
}

// ─── Import templates from JSON ───────────────────────────────────────────────
function importTemplates() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Invalid format: expected an array');
        const all = getAllTemplates();
        let added = 0;
        imported.forEach(t => {
          if (!t.id || !t.name || !t.type || !t.body) return;
          if (!all.find(x => x.id === t.id)) {
            all.push({ ...t, versions: t.versions || [] });
            added++;
          }
        });
        saveAllTemplates(all);
        showToast(`Imported ${added} new template(s)`, 'success');
        loadTemplates(1);
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ─── Rich text toolbar commands ───────────────────────────────────────────────
function execFormat(cmd, value = null) {
  document.execCommand(cmd, false, value);
  document.getElementById('tpl-rich-editor').focus();
  schedulePreview();
}

// ─── Variable insertion ───────────────────────────────────────────────────────
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
  const charsPerSeg = len <= 160 ? 160 : 153;
  const segments = len === 0 ? 1 : Math.ceil(len / charsPerSeg);

  const counter = document.getElementById('sms-counter');
  if (!counter) return;
  counter.querySelector('.char-count').textContent = `${len} chars`;
  counter.querySelector('.segment-count').textContent = `${segments} segment${segments > 1 ? 's' : ''}`;
  counter.className = `sms-counter ${len > 306 ? 'danger' : len > 160 ? 'warn' : ''}`;
}

// ─── Live preview (debounced, local rendering) ────────────────────────────────
function schedulePreview() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(updateInlinePreview, 400);
}

function updateInlinePreview() {
  const type = document.getElementById('tpl-type')?.value;
  const body = type === 'sms'
    ? document.getElementById('tpl-sms-body')?.value
    : document.getElementById('tpl-rich-editor')?.innerHTML;
  const subject = document.getElementById('tpl-subject')?.value;
  const previewEl = document.getElementById('inline-preview');
  if (!previewEl) return;

  if (!body) {
    previewEl.innerHTML = '<div class="preview-body" style="color:#94a3b8;text-align:center;padding-top:60px"><i class="fas fa-eye" style="font-size:2rem;display:block;margin-bottom:8px"></i>Preview will appear here as you type…</div>';
    return;
  }

  const renderedBody = applyVariables(body);
  const renderedSubject = applyVariables(subject || '');

  if (type === 'email') {
    previewEl.innerHTML = `
      ${renderedSubject ? `<div class="preview-subject"><strong>Subject:</strong> ${escHtml(renderedSubject)}</div>` : ''}
      <div class="preview-body">${renderedBody}</div>
    `;
  } else {
    previewEl.innerHTML = `<div class="preview-body" style="font-family:monospace;white-space:pre-wrap;padding:16px">${escHtml(renderedBody)}</div>`;
  }
}

// ─── Filter/search handlers ───────────────────────────────────────────────────
function applyFilters() {
  activeFilter.type = document.getElementById('filter-type')?.value || '';
  activeFilter.category = document.getElementById('filter-category')?.value || '';
  activeFilter.search = document.getElementById('filter-search')?.value || '';
  loadTemplates(1);
}

// ─── Build variable chips ─────────────────────────────────────────────────────
function buildVariableChips() {
  const container = document.getElementById('variable-chips');
  if (!container) return;
  container.innerHTML = ALL_VARIABLES.map((v) =>
    `<button class="variable-tag-chip" title="${escHtml(v.desc)}" onclick="insertVariable('${v.name}')">
      <i class="fa fa-at"></i> ${v.name}
    </button>`
  ).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDefaultTemplates();
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

  // Subject live preview
  document.getElementById('tpl-subject')?.addEventListener('input', schedulePreview);

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
