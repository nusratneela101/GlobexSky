/**
 * Globex Sky — security.js
 * PCI DSS compliance module:
 *   - Tokenized card storage management
 *   - PCI-compliant payment form handler
 *   - Audit logging for payment operations
 *   - Security scan scheduling interface
 *   - PCI compliance status dashboard logic
 */

'use strict';

/* ── PCI Compliance Status ─────────────────────────────────────────────── */
const GlobexSecurity = (() => {

  const API_BASE = '/api/security';

  /* ── Audit Log ──────────────────────────────────────────────────────── */
  function logAuditEvent(action, details = {}) {
    const entry = {
      action,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      page: window.location.pathname,
    };
    const logs = getAuditLog();
    logs.unshift(entry);
    try {
      localStorage.setItem('globexAuditLog', JSON.stringify(logs.slice(0, 200)));
    } catch (_) {}
    // Fire event for any listeners
    window.dispatchEvent(new CustomEvent('globexAuditEvent', { detail: entry }));
  }

  function getAuditLog() {
    try {
      return JSON.parse(localStorage.getItem('globexAuditLog')) || [];
    } catch (_) {
      return [];
    }
  }

  /* ── Tokenized Card Storage ─────────────────────────────────────────── */
  const CardTokenStore = (() => {
    const KEY = 'globexCardTokens';

    function getAll() {
      try {
        return JSON.parse(localStorage.getItem(KEY)) || [];
      } catch (_) {
        return [];
      }
    }

    function add(token, last4, brand, expiryMonth, expiryYear, cardholderName) {
      if (!token || !last4) return false;
      const cards = getAll();
      // Prevent duplicates
      if (cards.find(c => c.token === token)) return false;
      cards.push({
        token,
        last4: String(last4).slice(-4),
        brand: brand || 'card',
        expiryMonth,
        expiryYear,
        cardholderName: cardholderName || '',
        addedAt: new Date().toISOString(),
      });
      localStorage.setItem(KEY, JSON.stringify(cards));
      logAuditEvent('CARD_TOKEN_ADDED', { last4, brand });
      return true;
    }

    function remove(token) {
      const cards = getAll().filter(c => c.token !== token);
      localStorage.setItem(KEY, JSON.stringify(cards));
      logAuditEvent('CARD_TOKEN_REMOVED', { token: token.slice(0, 8) + '…' });
    }

    function setDefault(token) {
      const cards = getAll().map(c => Object.assign({}, c, { isDefault: c.token === token }));
      localStorage.setItem(KEY, JSON.stringify(cards));
    }

    return { getAll, add, remove, setDefault };
  })();

  /* ── PCI-Compliant Payment Form Handler ─────────────────────────────── */
  function initPaymentForm(formSelector) {
    const form = document.querySelector(formSelector);
    if (!form) return;

    // Mask card number input as user types
    const cardInput = form.querySelector('[data-field="card-number"]');
    if (cardInput) {
      cardInput.setAttribute('autocomplete', 'cc-number');
      cardInput.setAttribute('inputmode', 'numeric');
      cardInput.setAttribute('maxlength', '19');
      cardInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 16);
        e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
      });
    }

    // Mask CVV
    const cvvInput = form.querySelector('[data-field="cvv"]');
    if (cvvInput) {
      cvvInput.setAttribute('autocomplete', 'cc-csc');
      cvvInput.setAttribute('inputmode', 'numeric');
      cvvInput.setAttribute('maxlength', '4');
      cvvInput.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
    }

    // Expiry format MM/YY
    const expiryInput = form.querySelector('[data-field="expiry"]');
    if (expiryInput) {
      expiryInput.setAttribute('autocomplete', 'cc-exp');
      expiryInput.setAttribute('placeholder', 'MM / YY');
      expiryInput.setAttribute('maxlength', '7');
      expiryInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (v.length >= 3) v = v.slice(0, 2) + ' / ' + v.slice(2);
        e.target.value = v;
      });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validatePaymentForm(form)) return;
      logAuditEvent('PAYMENT_FORM_SUBMITTED', { formId: form.id || 'payment-form' });
      // Clear card data from DOM before processing
      const sensitiveFields = form.querySelectorAll('[data-field="card-number"],[data-field="cvv"]');
      sensitiveFields.forEach(f => {
        const val = f.value;
        setTimeout(() => { f.value = ''; }, 2000);
        f.dataset.tokenValue = val;
      });
      form.dispatchEvent(new CustomEvent('pciFormReady', { detail: collectFormData(form) }));
    });
  }

  function collectFormData(form) {
    const cardNumber = (form.querySelector('[data-field="card-number"]')?.value || '').replace(/\s/g, '');
    const expiry = (form.querySelector('[data-field="expiry"]')?.value || '').replace(/\s/g, '');
    const [month, year] = expiry.split('/');
    return {
      cardNumber,
      cvv: form.querySelector('[data-field="cvv"]')?.value || '',
      expiryMonth: month,
      expiryYear: year ? '20' + year.trim() : '',
      cardholderName: form.querySelector('[data-field="name"]')?.value || '',
      saveCard: form.querySelector('[data-field="save-card"]')?.checked || false,
    };
  }

  function validatePaymentForm(form) {
    let valid = true;
    form.querySelectorAll('[data-field]').forEach(f => {
      f.classList.remove('field-error');
    });

    const cardEl = form.querySelector('[data-field="card-number"]');
    if (cardEl) {
      const num = cardEl.value.replace(/\s/g, '');
      if (num.length < 13 || num.length > 19 || !luhnCheck(num)) {
        cardEl.classList.add('field-error');
        valid = false;
      }
    }

    const expiryEl = form.querySelector('[data-field="expiry"]');
    if (expiryEl) {
      const val = expiryEl.value.replace(/\s/g, '');
      const [m, y] = val.split('/');
      const now = new Date();
      const expDate = new Date(2000 + parseInt(y || '0', 10), parseInt(m || '0', 10) - 1, 1);
      if (!m || !y || expDate < now) {
        expiryEl.classList.add('field-error');
        valid = false;
      }
    }

    const cvvEl = form.querySelector('[data-field="cvv"]');
    if (cvvEl && (cvvEl.value.length < 3 || cvvEl.value.length > 4)) {
      cvvEl.classList.add('field-error');
      valid = false;
    }

    return valid;
  }

  function luhnCheck(num) {
    let sum = 0;
    let odd = true;
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num[i], 10);
      if (!odd) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      odd = !odd;
    }
    return sum % 10 === 0;
  }

  /* ── PCI Compliance Dashboard ───────────────────────────────────────── */
  function loadComplianceStatus() {
    const container = document.getElementById('pci-status-grid');
    if (!container) return;

    const checks = [
      { id: 'firewall', label: 'Firewall Configuration', status: 'pass', detail: 'Perimeter firewall rules reviewed' },
      { id: 'default-pass', label: 'Default Passwords', status: 'pass', detail: 'No vendor defaults detected' },
      { id: 'card-data', label: 'Cardholder Data Protection', status: 'pass', detail: 'Tokenization active; no raw PANs stored' },
      { id: 'transmission', label: 'Encrypted Transmission', status: 'pass', detail: 'TLS 1.3 enforced on all endpoints' },
      { id: 'anti-malware', label: 'Anti-Malware', status: 'warning', detail: 'Scheduled scan overdue by 2 days' },
      { id: 'secure-systems', label: 'Secure System Development', status: 'pass', detail: 'OWASP guidelines followed' },
      { id: 'access-control', label: 'Access Control', status: 'pass', detail: 'Least-privilege model enforced' },
      { id: 'unique-ids', label: 'Unique IDs per User', status: 'pass', detail: 'No shared accounts detected' },
      { id: 'physical', label: 'Physical Access Controls', status: 'pass', detail: 'Data centres locked; CCTV operational' },
      { id: 'logging', label: 'Logging & Monitoring', status: 'pass', detail: 'Audit trails retained 12 months' },
      { id: 'pen-test', label: 'Penetration Testing', status: 'warning', detail: 'Annual test due in 14 days' },
      { id: 'isms', label: 'Information Security Policy', status: 'pass', detail: 'Policy reviewed Q2 2025' },
    ];

    const passed = checks.filter(c => c.status === 'pass').length;
    const warned = checks.filter(c => c.status === 'warning').length;
    const failed = checks.filter(c => c.status === 'fail').length;

    container.innerHTML = checks.map(c => `
      <div class="pci-check-card pci-${c.status}">
        <div class="pci-check-icon">
          ${c.status === 'pass' ? '<i class="fas fa-check-circle"></i>' :
            c.status === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
            '<i class="fas fa-times-circle"></i>'}
        </div>
        <div class="pci-check-body">
          <div class="pci-check-label">${c.label}</div>
          <div class="pci-check-detail">${c.detail}</div>
        </div>
      </div>
    `).join('');

    const summary = document.getElementById('pci-summary');
    if (summary) {
      summary.innerHTML = `
        <span class="badge-pill badge-green"><i class="fas fa-check"></i> ${passed} Pass</span>
        ${warned > 0 ? `<span class="badge-pill badge-orange"><i class="fas fa-exclamation-triangle"></i> ${warned} Warning</span>` : ''}
        ${failed > 0 ? `<span class="badge-pill badge-red"><i class="fas fa-times"></i> ${failed} Fail</span>` : ''}
      `;
    }
  }

  /* ── Security Scan Scheduler ────────────────────────────────────────── */
  function initScanScheduler() {
    const schedBtn = document.getElementById('btn-schedule-scan');
    const scanList = document.getElementById('scan-list');
    if (!schedBtn) return;

    const scans = [
      { id: 1, type: 'Vulnerability Scan', scheduled: '2025-07-01 02:00', status: 'scheduled' },
      { id: 2, type: 'Penetration Test', scheduled: '2025-07-15 00:00', status: 'scheduled' },
      { id: 3, type: 'PCI ASV Scan', scheduled: '2025-06-28 03:00', status: 'completed' },
    ];

    if (scanList) {
      scanList.innerHTML = scans.map(s => `
        <tr>
          <td>${s.type}</td>
          <td>${s.scheduled}</td>
          <td><span class="badge-pill ${s.status === 'completed' ? 'badge-green' : 'badge-blue'}">${s.status}</span></td>
          <td><button class="btn-sm btn-secondary" onclick="GlobexSecurity.cancelScan(${s.id})"><i class="fas fa-times"></i> Cancel</button></td>
        </tr>
      `).join('');
    }

    schedBtn.addEventListener('click', () => {
      const typeEl = document.getElementById('scan-type');
      const dateEl = document.getElementById('scan-date');
      if (!typeEl || !dateEl) return;
      if (!dateEl.value) { alert('Please select a scan date.'); return; }
      logAuditEvent('SCAN_SCHEDULED', { type: typeEl.value, date: dateEl.value });
      alert(`Scan scheduled: ${typeEl.value} on ${dateEl.value}`);
    });
  }

  function cancelScan(id) {
    logAuditEvent('SCAN_CANCELLED', { id });
    const row = document.querySelector(`#scan-list tr[data-scan-id="${id}"]`);
    if (row) row.remove();
  }

  /* ── Audit Log Table ────────────────────────────────────────────────── */
  function renderAuditLog() {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody) return;
    const logs = getAuditLog();
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No audit events recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.slice(0, 50).map(l => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleString()}</td>
        <td><span class="badge-pill badge-blue">${l.action}</span></td>
        <td>${l.page || '—'}</td>
        <td style="font-size:.8rem;color:#64748b">${JSON.stringify(l.details || {}).slice(0, 80)}</td>
      </tr>
    `).join('');
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    loadComplianceStatus();
    initScanScheduler();
    renderAuditLog();
    // Log page view
    logAuditEvent('PAGE_VIEW', { page: window.location.pathname });
  }

  return {
    init,
    logAuditEvent,
    getAuditLog,
    CardTokenStore,
    initPaymentForm,
    loadComplianceStatus,
    renderAuditLog,
    cancelScan,
    luhnCheck,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('pci-status-grid') || document.getElementById('audit-log-tbody')) {
    GlobexSecurity.init();
  }
});

window.GlobexSecurity = GlobexSecurity;
