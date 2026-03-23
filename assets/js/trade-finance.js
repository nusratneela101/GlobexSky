/**
 * Globex Sky — trade-finance.js
 * Frontend module for Letter of Credit, Invoice Factoring, and PO Financing.
 * Handles form validation, API calls, document uploads, and status displays.
 */

const TradeFinance = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  const API = (window.GlobexConfig?.API_BASE_URL || '/api/v1') + '/trade-finance';

  /* ─────────────────────────────────────────────
     UTILITY — Decimal-safe arithmetic
  ───────────────────────────────────────────── */
  /**
   * Round to a fixed number of decimal places without floating-point drift.
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {number}
   */
  function toFixed(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

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
  let _toastTimer = null;

  function showToast(message, type = 'info') {
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

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  /* ─────────────────────────────────────────────
     UTILITY — Form validation
  ───────────────────────────────────────────── */
  /**
   * Validate all fields in a form. Returns true if valid.
   * Marks invalid fields with `.is-invalid` and shows `.form-error` siblings.
   */
  function validateForm(formEl) {
    let valid = true;
    formEl.querySelectorAll('[required],[data-validate]').forEach((field) => {
      const errEl = formEl.querySelector(`[data-error-for="${field.id}"]`);
      const val = field.value.trim();

      field.classList.remove('is-invalid');
      if (errEl) errEl.classList.remove('visible');

      if (!val) {
        field.classList.add('is-invalid');
        if (errEl) { errEl.textContent = 'This field is required.'; errEl.classList.add('visible'); }
        valid = false;
        return;
      }

      if (field.type === 'number' && field.min && parseFloat(val) < parseFloat(field.min)) {
        field.classList.add('is-invalid');
        if (errEl) { errEl.textContent = `Minimum value is ${field.min}.`; errEl.classList.add('visible'); }
        valid = false;
        return;
      }

      if (field.dataset.validate === 'date-future') {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (new Date(val) <= today) {
          field.classList.add('is-invalid');
          if (errEl) { errEl.textContent = 'Date must be in the future.'; errEl.classList.add('visible'); }
          valid = false;
        }
      }
    });
    return valid;
  }

  /* ─────────────────────────────────────────────
     UTILITY — Document upload (multi-file)
  ───────────────────────────────────────────── */
  /**
   * Initialise a drag-and-drop upload zone.
   * @param {string} zoneId   - id of the .upload-zone element
   * @param {string} inputId  - id of the hidden <input type="file">
   * @param {string} listId   - id of the element to render the file list in
   */
  function initUploadZone(zoneId, inputId, listId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const list = listId ? document.getElementById(listId) : null;
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const dt = new DataTransfer();
      Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
      Array.from(input.files || []).forEach(f => dt.items.add(f));
      input.files = dt.files;
      _renderFileList(input.files, list);
    });

    input.addEventListener('change', () => _renderFileList(input.files, list));
  }

  function _renderFileList(files, listEl) {
    if (!listEl) return;
    listEl.innerHTML = '';
    Array.from(files).forEach((f) => {
      const item = document.createElement('div');
      item.className = 'upload-file-item';
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = ['pdf'].includes(ext) ? 'fa-file-pdf' : ['jpg', 'jpeg', 'png'].includes(ext) ? 'fa-file-image' : 'fa-file-alt';
      item.innerHTML = `<i class="fas ${icon}"></i> ${f.name} <span style="margin-left:auto;color:#94a3b8">${(f.size / 1024).toFixed(0)} KB</span>`;
      listEl.appendChild(item);
    });
  }

  /* ─────────────────────────────────────────────
     LC — Create Letter of Credit
  ───────────────────────────────────────────── */
  async function createLC(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    if (!validateForm(form)) { showToast('Please fill in all required fields.', 'error'); return; }

    const btn = form.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Submitting…`; }

    const amount = parseFloat(document.getElementById('lc-amount')?.value);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Submit Application`; }
      return;
    }

    const body = {
      beneficiary_id: document.getElementById('lc-beneficiary')?.value?.trim() || undefined,
      amount: toFixed(amount),
      currency: document.getElementById('lc-currency')?.value || 'USD',
      expiry_date: document.getElementById('lc-expiry')?.value,
      goods_description: document.getElementById('lc-goods')?.value?.trim() || undefined,
      terms: document.getElementById('lc-terms')?.value?.trim() || undefined,
    };

    try {
      const lc = await _post(`${API}/lc`, body);
      showToast(`L/C created successfully. Reference: #LC-${lc.id?.slice(-6).toUpperCase() || 'NEW'}`, 'success');
      form.reset();
      if (typeof refreshLCList === 'function') refreshLCList();
    } catch (err) {
      showToast(`Failed to create L/C: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Submit Application`; }
    }
  }

  /* ─────────────────────────────────────────────
     LC — Submit Amendment Request
  ───────────────────────────────────────────── */
  async function submitLCAmendment(lcId, amendmentData) {
    try {
      const result = await _post(`${API}/lc/${lcId}/amendment`, amendmentData);
      showToast('Amendment request submitted successfully.', 'success');
      return result;
    } catch (err) {
      showToast(`Amendment failed: ${err.message}`, 'error');
      return null;
    }
  }

  /* ─────────────────────────────────────────────
     LC — Fetch and render LC list
  ───────────────────────────────────────────── */
  async function loadLCList(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    try {
      const lcs = await _get(`${API}/lc`);
      tbody.innerHTML = '';
      if (!lcs || !lcs.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px">No letters of credit found.</td></tr>`;
        return;
      }
      lcs.forEach((lc) => {
        const tr = document.createElement('tr');
        const badgeClass = { draft: 'badge-gray', issued: 'badge-orange', accepted: 'badge-blue', fulfilled: 'badge-green', closed: 'badge-gray' }[lc.status] || 'badge-gray';
        tr.innerHTML = `
          <td>#LC-${(lc.id || '').slice(-6).toUpperCase()}</td>
          <td>${_fmt(lc.amount, lc.currency)}</td>
          <td>${lc.beneficiary_id ? lc.beneficiary_id.slice(-8) : '—'}</td>
          <td>${lc.expiry_date ? new Date(lc.expiry_date).toLocaleDateString() : '—'}</td>
          <td><span class="badge-pill ${badgeClass}">${lc.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (_err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:24px">Failed to load LC list.</td></tr>`;
    }
  }

  function _fmt(amount, currency = 'USD') {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    } catch (_) {
      return `${currency} ${parseFloat(amount).toFixed(2)}`;
    }
  }

  /* ─────────────────────────────────────────────
     INVOICE FACTORING — Calculate preview
  ───────────────────────────────────────────── */
  function calcFactoring() {
    const rawAmount = parseFloat(document.getElementById('inv-amount')?.value);
    const advanceRate = parseFloat(document.getElementById('inv-advance-rate')?.value) / 100 || 0.80;
    const feeRate     = parseFloat(document.getElementById('inv-fee-rate')?.value)    / 100 || 0.03;

    if (isNaN(rawAmount) || rawAmount <= 0) {
      const resultEl = document.getElementById('factoring-result');
      if (resultEl) resultEl.style.display = 'none';
      return;
    }

    const invoiceAmount  = toFixed(rawAmount);
    const advanceAmount  = toFixed(invoiceAmount * advanceRate);
    const discountFee    = toFixed(invoiceAmount * feeRate);
    const reserveAmount  = toFixed(invoiceAmount - advanceAmount);
    const netProceeds    = toFixed(advanceAmount - discountFee);

    _setCalcRow('calc-invoice-amount',  _fmt(invoiceAmount));
    _setCalcRow('calc-advance-amount',  _fmt(advanceAmount));
    _setCalcRow('calc-discount-fee',    _fmt(discountFee));
    _setCalcRow('calc-reserve-amount',  _fmt(reserveAmount));
    _setCalcRow('calc-net-proceeds',    _fmt(netProceeds));

    const resultEl = document.getElementById('factoring-result');
    if (resultEl) resultEl.style.display = 'block';
  }

  function _setCalcRow(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ─────────────────────────────────────────────
     INVOICE FACTORING — Submit
  ───────────────────────────────────────────── */
  async function submitInvoiceFactoring(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    if (!validateForm(form)) { showToast('Please fill in all required fields.', 'error'); return; }

    const btn = form.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Submitting…`; }

    const rawAmount = parseFloat(document.getElementById('inv-amount')?.value);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Please enter a valid invoice amount.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Submit for Factoring`; }
      return;
    }

    const body = {
      invoice_number:   document.getElementById('inv-number')?.value?.trim(),
      invoice_amount:   toFixed(rawAmount),
      debtor_name:      document.getElementById('inv-debtor')?.value?.trim(),
      due_date:         document.getElementById('inv-due-date')?.value,
      advance_rate:     (parseFloat(document.getElementById('inv-advance-rate')?.value) || 80) / 100,
      discount_fee_rate:(parseFloat(document.getElementById('inv-fee-rate')?.value) || 3) / 100,
    };

    try {
      const record = await _post(`${API}/invoice-factoring`, body);
      showToast(`Invoice submitted for factoring. Net proceeds: ${_fmt(record.net_proceeds)}`, 'success');
      form.reset();
      calcFactoring();
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Submit for Factoring`; }
    }
  }

  /* ─────────────────────────────────────────────
     PO FINANCING — Calculate preview
  ───────────────────────────────────────────── */
  function calcPOFinancing() {
    const poAmount    = toFixed(parseFloat(document.getElementById('po-amount')?.value) || 0);
    const advancePct  = parseFloat(document.getElementById('po-advance-pct')?.value) || 70;
    const interestRate= parseFloat(document.getElementById('po-interest-rate')?.value) || 8;
    const termDays    = parseInt(document.getElementById('po-term-days')?.value) || 90;

    if (poAmount <= 0) {
      const resultEl = document.getElementById('po-result');
      if (resultEl) resultEl.style.display = 'none';
      return;
    }

    const advanceAmount  = toFixed(poAmount * (advancePct / 100));
    const interestAmount = toFixed(advanceAmount * (interestRate / 100) * (termDays / 365));
    const totalRepayment = toFixed(advanceAmount + interestAmount);

    _setCalcRow('po-calc-advance',    _fmt(advanceAmount));
    _setCalcRow('po-calc-interest',   _fmt(interestAmount));
    _setCalcRow('po-calc-repayment',  _fmt(totalRepayment));
    _setCalcRow('po-calc-due-date', (() => {
      const d = new Date(); d.setDate(d.getDate() + termDays);
      return d.toLocaleDateString();
    })());

    const resultEl = document.getElementById('po-result');
    if (resultEl) resultEl.style.display = 'block';
  }

  /* ─────────────────────────────────────────────
     PO FINANCING — Submit
  ───────────────────────────────────────────── */
  async function submitPOFinancing(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    if (!validateForm(form)) { showToast('Please fill in all required fields.', 'error'); return; }

    const btn = form.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Submitting…`; }

    const poAmount = toFixed(parseFloat(document.getElementById('po-amount')?.value) || 0);
    if (poAmount <= 0) {
      showToast('Please enter a valid PO amount.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Apply for Financing`; }
      return;
    }

    const body = {
      po_number:        document.getElementById('po-number')?.value?.trim(),
      po_amount:        poAmount,
      buyer_name:       document.getElementById('po-buyer')?.value?.trim(),
      delivery_date:    document.getElementById('po-delivery-date')?.value,
      advance_pct:      parseFloat(document.getElementById('po-advance-pct')?.value) || 70,
      interest_rate:    parseFloat(document.getElementById('po-interest-rate')?.value) || 8,
      term_days:        parseInt(document.getElementById('po-term-days')?.value) || 90,
      notes:            document.getElementById('po-notes')?.value?.trim() || undefined,
    };

    try {
      const record = await _post(`${API}/po-financing`, body);
      showToast(`PO Financing application submitted. Reference: #POF-${(record.id || '').slice(-6).toUpperCase()}`, 'success');
      form.reset();
      calcPOFinancing();
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane"></i> Apply for Financing`; }
    }
  }

  /* ─────────────────────────────────────────────
     STATUS STEPPER — Update visual workflow
  ───────────────────────────────────────────── */
  /**
   * @param {string} stepperId - id of the .status-steps container
   * @param {string} currentStatus
   * @param {string[]} allStatuses - ordered list of status values
   */
  function updateStatusStepper(stepperId, currentStatus, allStatuses) {
    const stepper = document.getElementById(stepperId);
    if (!stepper) return;

    const currentIdx = allStatuses.indexOf(currentStatus);
    stepper.querySelectorAll('.step').forEach((stepEl, i) => {
      stepEl.classList.remove('done', 'active');
      if (i < currentIdx) stepEl.classList.add('done');
      else if (i === currentIdx) stepEl.classList.add('active');
    });
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    // LC
    createLC,
    submitLCAmendment,
    loadLCList,
    // Invoice Factoring
    calcFactoring,
    submitInvoiceFactoring,
    // PO Financing
    calcPOFinancing,
    submitPOFinancing,
    // Utilities
    showToast,
    validateForm,
    initUploadZone,
    updateStatusStepper,
    toFixed,
    fmt: _fmt,
  };
})();

window.TradeFinance = TradeFinance;
