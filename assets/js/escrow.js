/**
 * Globex Sky — escrow.js
 * Dedicated frontend module for Escrow Service (Trade Assurance).
 * Handles: create escrow, milestone tracking, dispute filing,
 *          release confirmation, refund requests, balance dashboard.
 */

const Escrow = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  const API = (window.GlobexConfig?.API_BASE_URL || '/api/v1') + '/trade-finance';

  /* ─────────────────────────────────────────────
     UTILITY — HTTP helpers
  ───────────────────────────────────────────── */
  function _authHeaders() {
    const token = localStorage.getItem('globex_token') || sessionStorage.getItem('globex_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function _post(url, body) {
    const res = await fetch(url, { method: 'POST', headers: _authHeaders(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
    return json.data;
  }

  async function _patch(url, body = {}) {
    const res = await fetch(url, { method: 'PATCH', headers: _authHeaders(), body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
    return json.data;
  }

  async function _get(url) {
    const res = await fetch(url, { headers: _authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
    return json.data;
  }

  /* ─────────────────────────────────────────────
     UTILITY — Toast
  ───────────────────────────────────────────── */
  function showToast(message, type = 'info') {
    if (window.TradeFinance?.showToast) { window.TradeFinance.showToast(message, type); return; }
    let toast = document.getElementById('tf-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tf-toast';
      toast.className = 'tf-toast';
      document.body.appendChild(toast);
    }
    toast.className = `tf-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 4500);
  }

  /* ─────────────────────────────────────────────
     UTILITY — Decimal-safe arithmetic
  ───────────────────────────────────────────── */
  function toFixed(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function _fmt(amount, currency = 'USD') {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    } catch (_) {
      return `${currency} ${parseFloat(amount).toFixed(2)}`;
    }
  }

  /* ─────────────────────────────────────────────
     UTILITY — Form validation
  ───────────────────────────────────────────── */
  function validateForm(formEl) {
    if (window.TradeFinance?.validateForm) return window.TradeFinance.validateForm(formEl);
    let valid = true;
    formEl.querySelectorAll('[required]').forEach((field) => {
      field.classList.remove('is-invalid');
      if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
    });
    return valid;
  }

  /* ─────────────────────────────────────────────
     MILESTONE DEFAULTS
  ───────────────────────────────────────────── */
  const DEFAULT_MILESTONES = [
    { key: 'order_placement', label: 'Order Placement',        pct: 30, icon: 'fa-shopping-cart' },
    { key: 'production',      label: 'Production Complete',    pct: 30, icon: 'fa-industry' },
    { key: 'delivery',        label: 'Delivery & Inspection',  pct: 40, icon: 'fa-truck' },
  ];

  /* ─────────────────────────────────────────────
     CREATE ESCROW
  ───────────────────────────────────────────── */
  async function createEscrow(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    if (!validateForm(form)) { showToast('Please fill in all required fields.', 'error'); return; }

    const btn = form.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Creating…`; }

    const rawAmount = parseFloat(document.getElementById('escrow-amount')?.value);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Please enter a valid amount.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-lock"></i> Create Escrow`; }
      return;
    }

    const milestones = _collectMilestones();

    const body = {
      seller_id:  document.getElementById('escrow-seller-id')?.value?.trim() || undefined,
      order_id:   document.getElementById('escrow-order-id')?.value?.trim()  || undefined,
      amount:     toFixed(rawAmount),
      currency:   document.getElementById('escrow-currency')?.value || 'USD',
      conditions: document.getElementById('escrow-conditions')?.value?.trim() || undefined,
      milestones: milestones.length ? milestones : undefined,
    };

    try {
      const record = await _post(`${API}/escrow`, body);
      showToast(`Escrow created. Reference: #ESC-${(record.id || '').slice(-6).toUpperCase()}`, 'success');
      form.reset();
      renderMilestones('milestone-container', rawAmount, document.getElementById('escrow-currency')?.value || 'USD');
      if (typeof loadEscrowList === 'function') loadEscrowList('escrow-list');
    } catch (err) {
      showToast(`Failed to create escrow: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-lock"></i> Create Escrow`; }
    }
  }

  function _collectMilestones() {
    const items = document.querySelectorAll('.milestone-pct-input');
    if (!items.length) return [];
    let totalPct = 0;
    const milestones = Array.from(items).map((el) => {
      const pct = parseFloat(el.value) || 0;
      totalPct += pct;
      return { key: el.dataset.key, label: el.dataset.label, pct };
    });
    if (Math.abs(totalPct - 100) > 0.01) return [];
    return milestones;
  }

  /* ─────────────────────────────────────────────
     RENDER MILESTONE UI
  ───────────────────────────────────────────── */
  function renderMilestones(containerId, totalAmount, currency = 'USD') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const amount = toFixed(parseFloat(totalAmount) || 0);
    container.innerHTML = DEFAULT_MILESTONES.map((m) => {
      const milestoneAmount = toFixed(amount * m.pct / 100);
      return `
        <div class="milestone-row" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas ${m.icon}" style="color:#0052cc;font-size:.9rem"></i>
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:.88rem;color:#0a0e27">${m.label}</div>
            <div style="font-size:.8rem;color:#64748b">${m.pct}% of total</div>
          </div>
          <div>
            <span style="font-family:'Poppins',sans-serif;font-weight:700;color:#059669">${_fmt(milestoneAmount, currency)}</span>
            <input type="number" class="milestone-pct-input" data-key="${m.key}" data-label="${m.label}"
              value="${m.pct}" min="0" max="100" step="1"
              style="display:none"/>
          </div>
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────────
     RELEASE ESCROW
  ───────────────────────────────────────────── */
  async function releaseEscrow(escrowId, btnEl) {
    if (!confirm('Release escrow funds to the seller? This cannot be undone.')) return;

    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = `<span class="spinner"></span>`; }

    try {
      await _patch(`${API}/escrow/${escrowId}/release`);
      showToast('Escrow funds released successfully.', 'success');
      _updateEscrowItemBadge(escrowId, 'released', 'badge-green');
      if (btnEl) btnEl.closest('.escrow-actions')?.querySelectorAll('.btn').forEach(b => b.remove());
    } catch (err) {
      showToast(`Release failed: ${err.message}`, 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = `<i class="fas fa-check"></i> Release`; }
    }
  }

  /* ─────────────────────────────────────────────
     REFUND ESCROW
  ───────────────────────────────────────────── */
  async function refundEscrow(escrowId, btnEl) {
    if (!confirm('Refund escrow back to the buyer?')) return;

    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = `<span class="spinner"></span>`; }

    try {
      await _patch(`${API}/escrow/${escrowId}/refund`);
      showToast('Escrow refunded to buyer successfully.', 'success');
      _updateEscrowItemBadge(escrowId, 'refunded', 'badge-gray');
      if (btnEl) btnEl.closest('.escrow-actions')?.querySelectorAll('.btn').forEach(b => b.remove());
    } catch (err) {
      showToast(`Refund failed: ${err.message}`, 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = `<i class="fas fa-undo"></i> Refund`; }
    }
  }

  function _updateEscrowItemBadge(escrowId, newStatus, badgeClass) {
    const badgeEl = document.querySelector(`[data-escrow-id="${escrowId}"] .escrow-badge`);
    if (badgeEl) {
      badgeEl.className = `badge-pill ${badgeClass} escrow-badge`;
      badgeEl.textContent = newStatus;
    }
  }

  /* ─────────────────────────────────────────────
     FILE ESCROW DISPUTE
  ───────────────────────────────────────────── */
  async function fileDispute(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    if (!validateForm(form)) { showToast('Please fill in all required fields.', 'error'); return; }

    const btn = form.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Submitting…`; }

    const escrowId = document.getElementById('dispute-escrow-id')?.value?.trim();
    if (!escrowId) {
      showToast('Escrow ID is required to file a dispute.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-flag"></i> File Dispute`; }
      return;
    }

    const body = {
      reason:      document.getElementById('dispute-reason')?.value?.trim(),
      description: document.getElementById('dispute-description')?.value?.trim(),
    };

    try {
      const record = await _post(`${API}/escrow/${escrowId}/dispute`, body);
      showToast(`Dispute filed. Reference: #DIS-${(record.id || '').slice(-6).toUpperCase()}. Our team will review within 48 hours.`, 'info');
      form.reset();
    } catch (err) {
      showToast(`Dispute filing failed: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-flag"></i> File Dispute`; }
    }
  }

  /* ─────────────────────────────────────────────
     LOAD ESCROW LIST
  ───────────────────────────────────────────── */
  async function loadEscrowList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading escrow transactions…</p></div>`;

    try {
      const escrows = await _get(`${API}/escrow`);
      if (!escrows || !escrows.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-shield-alt"></i><p>No escrow transactions found.</p></div>`;
        return;
      }
      container.innerHTML = escrows.map((e) => _renderEscrowItem(e)).join('');
    } catch (_err) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load escrow transactions.</p></div>`;
    }
  }

  function _renderEscrowItem(e) {
    const statusBadge = {
      held:     'badge-orange',
      released: 'badge-green',
      refunded: 'badge-gray',
      disputed: 'badge-red',
    }[e.status] || 'badge-gray';

    const actions = e.status === 'held'
      ? `<button class="btn btn-sm btn-success" onclick="Escrow.releaseEscrow('${e.id}', this)"><i class="fas fa-check"></i> Release</button>
         <button class="btn btn-sm btn-secondary" onclick="Escrow.refundEscrow('${e.id}', this)"><i class="fas fa-undo"></i> Refund</button>
         <button class="btn btn-sm btn-danger" onclick="document.getElementById('dispute-escrow-id').value='${e.id}'; document.getElementById('dispute-section')?.scrollIntoView({behavior:'smooth'})"><i class="fas fa-flag"></i> Dispute</button>`
      : '';

    return `
      <div class="escrow-item" data-escrow-id="${e.id}">
        <div class="escrow-header">
          <span class="escrow-id">#ESC-${(e.id || '').slice(-6).toUpperCase()}</span>
          <span class="badge-pill ${statusBadge} escrow-badge">${e.status}</span>
        </div>
        <div class="escrow-amount">${_fmt(e.amount, e.currency)}</div>
        <div class="escrow-meta">
          ${e.seller_id ? `Seller: …${e.seller_id.slice(-8)}` : 'No seller assigned'}
          ${e.order_id  ? ` · Order: …${e.order_id.slice(-8)}`  : ''}
          · Created: ${e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}
        </div>
        ${e.conditions ? `<div style="font-size:.82rem;color:#374151;margin-bottom:10px"><strong>Conditions:</strong> ${e.conditions}</div>` : ''}
        <div class="escrow-actions">${actions}</div>
      </div>`;
  }

  /* ─────────────────────────────────────────────
     DASHBOARD SUMMARY
  ───────────────────────────────────────────── */
  async function loadDashboardSummary() {
    try {
      const data = await _get(`${API}/analytics`);

      _setDashEl('dash-lc-total',        data.lc?.total ?? '—');
      _setDashEl('dash-lc-value',        _fmt(data.lc?.total_value ?? 0));
      _setDashEl('dash-escrow-held',     _fmt(data.escrow?.total_held ?? 0));
      _setDashEl('dash-escrow-released', _fmt(data.escrow?.total_released ?? 0));
      _setDashEl('dash-factoring-total', data.invoice_factoring?.total ?? '—');
      _setDashEl('dash-factoring-proceeds', _fmt(data.invoice_factoring?.total_net_proceeds ?? 0));
    } catch (_err) {
      // silently fail — dashboard shows static placeholder values
    }
  }

  function _setDashEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ─────────────────────────────────────────────
     DOCUMENT UPLOAD with drag-and-drop
  ───────────────────────────────────────────── */
  function initUploadZone(zoneId, inputId, listId) {
    if (window.TradeFinance?.initUploadZone) {
      return window.TradeFinance.initUploadZone(zoneId, inputId, listId);
    }
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      input.files = e.dataTransfer.files;
      _renderFileList(input.files, listId ? document.getElementById(listId) : null);
    });
    input.addEventListener('change', () => _renderFileList(input.files, listId ? document.getElementById(listId) : null));
  }

  function _renderFileList(files, listEl) {
    if (!listEl) return;
    listEl.innerHTML = Array.from(files).map((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = ext === 'pdf' ? 'fa-file-pdf' : ['jpg','jpeg','png'].includes(ext) ? 'fa-file-image' : 'fa-file-alt';
      return `<div class="upload-file-item"><i class="fas ${icon}"></i> ${f.name} <span style="margin-left:auto;color:#94a3b8">${(f.size/1024).toFixed(0)} KB</span></div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────────
     AUTO-RELEASE GRACE PERIOD DISPLAY
  ───────────────────────────────────────────── */
  /**
   * Show a countdown timer for auto-release grace period.
   * @param {string} containerId
   * @param {string|Date} releaseAt - ISO date string or Date when funds auto-release
   */
  function showGracePeriodTimer(containerId, releaseAt) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const target = new Date(releaseAt).getTime();

    function update() {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        container.innerHTML = `<span class="badge-pill badge-orange"><i class="fas fa-clock"></i> Auto-release imminent</span>`;
        return;
      }
      const days  = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      const mins  = Math.floor((remaining % 3600000)  / 60000);
      container.innerHTML = `<span style="font-size:.82rem;color:#64748b"><i class="fas fa-clock" style="color:#f97316"></i> Auto-release in <strong>${days}d ${hours}h ${mins}m</strong></span>`;
    }

    update();
    setInterval(update, 60000);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    createEscrow,
    releaseEscrow,
    refundEscrow,
    fileDispute,
    loadEscrowList,
    renderMilestones,
    loadDashboardSummary,
    initUploadZone,
    showGracePeriodTimer,
    showToast,
  };
})();

window.Escrow = Escrow;
