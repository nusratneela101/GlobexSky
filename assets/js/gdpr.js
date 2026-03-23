/**
 * Globex Sky — gdpr.js
 * GDPR compliance module:
 *   - Granular cookie consent categories
 *   - "Right to be Forgotten" data deletion request
 *   - Data portability (export user data as JSON/CSV)
 *   - Consent management dashboard
 *   - Privacy preference center logic
 *   - Data breach notification system
 *   - Age verification
 */

'use strict';

const GlobexGDPR = (() => {

  const CONSENT_KEY = 'globexGDPRConsent';
  const AGE_KEY = 'globexAgeVerified';
  const DELETION_KEY = 'globexDeletionRequests';

  /* ── Consent Categories ─────────────────────────────────────────────── */
  const CATEGORIES = {
    necessary: { label: 'Necessary', description: 'Required for the platform to function. Always active.', alwaysOn: true },
    analytics: { label: 'Analytics', description: 'Help us understand how you use the site (Google Analytics, Hotjar).' },
    marketing: { label: 'Marketing', description: 'Personalised ads and campaign tracking (Meta Pixel, Google Ads).' },
    functional: { label: 'Functional', description: 'Enhanced features like live chat, saved preferences, and search history.' },
  };

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); }
    catch (_) { return null; }
  }

  function saveConsent(prefs) {
    const record = Object.assign({ necessary: true }, prefs, {
      necessary: true,
      consentDate: new Date().toISOString(),
      consentVersion: '1.0',
      ipHash: null, // Would be set server-side
    });
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent('gdprConsentUpdated', { detail: record }));
    return record;
  }

  function hasConsent(category) {
    const c = getConsent();
    return c ? Boolean(c[category]) : false;
  }

  function revokeAll() {
    saveConsent({ analytics: false, marketing: false, functional: false });
  }

  /* ── Privacy Preference Center ──────────────────────────────────────── */
  function initPrivacyCenter() {
    const form = document.getElementById('privacy-preferences-form');
    if (!form) return;

    const consent = getConsent() || {};

    // Populate toggles
    Object.keys(CATEGORIES).forEach(key => {
      const toggle = form.querySelector(`[data-consent="${key}"]`);
      if (!toggle) return;
      if (CATEGORIES[key].alwaysOn) {
        toggle.checked = true;
        toggle.disabled = true;
      } else {
        toggle.checked = Boolean(consent[key]);
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const prefs = {};
      Object.keys(CATEGORIES).forEach(key => {
        const toggle = form.querySelector(`[data-consent="${key}"]`);
        prefs[key] = toggle ? toggle.checked : false;
      });
      saveConsent(prefs);
      showToast('Privacy preferences saved successfully.', 'success');
    });

    // Render category descriptions
    const descContainer = document.getElementById('consent-categories-list');
    if (descContainer) {
      descContainer.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
        <div class="consent-category-row">
          <div class="consent-cat-info">
            <span class="consent-cat-name">${cat.label}${cat.alwaysOn ? ' <span class="badge-pill badge-green" style="font-size:.7rem">Always On</span>' : ''}</span>
            <span class="consent-cat-desc">${cat.description}</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" data-consent="${key}" ${cat.alwaysOn ? 'checked disabled' : ''}/>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `).join('');
    }
  }

  /* ── Right to be Forgotten ──────────────────────────────────────────── */
  function submitDeletionRequest(reason) {
    const requests = getDeletionRequests();
    const req = {
      id: 'DEL-' + Date.now(),
      reason: reason || 'User requested account deletion',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    requests.unshift(req);
    localStorage.setItem(DELETION_KEY, JSON.stringify(requests.slice(0, 20)));
    window.dispatchEvent(new CustomEvent('gdprDeletionRequested', { detail: req }));
    return req;
  }

  function getDeletionRequests() {
    try { return JSON.parse(localStorage.getItem(DELETION_KEY)) || []; }
    catch (_) { return []; }
  }

  function initDeletionRequest() {
    const btn = document.getElementById('btn-request-deletion');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const reason = document.getElementById('deletion-reason')?.value || '';
      if (!reason.trim()) { showToast('Please provide a reason for deletion.', 'error'); return; }
      if (!confirm('Are you sure you want to request deletion of all your personal data? This action cannot be undone.')) return;
      const req = submitDeletionRequest(reason);
      showToast(`Deletion request submitted (Ref: ${req.id}). You will be contacted within 30 days.`, 'success');
      renderDeletionHistory();
    });
  }

  function renderDeletionHistory() {
    const tbody = document.getElementById('deletion-history-tbody');
    if (!tbody) return;
    const requests = getDeletionRequests();
    if (!requests.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No deletion requests.</td></tr>';
      return;
    }
    tbody.innerHTML = requests.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${new Date(r.submittedAt).toLocaleString()}</td>
        <td>${r.reason}</td>
        <td><span class="badge-pill ${r.status === 'completed' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-orange'}">${r.status}</span></td>
      </tr>
    `).join('');
  }

  /* ── Data Portability ───────────────────────────────────────────────── */
  function collectUserData() {
    return {
      profile: JSON.parse(localStorage.getItem('globexProfile') || 'null'),
      consentRecord: getConsent(),
      searchHistory: JSON.parse(localStorage.getItem('globexSearchHistory') || '[]'),
      orderHistory: JSON.parse(localStorage.getItem('globexOrders') || '[]'),
      wishlist: JSON.parse(localStorage.getItem('globexWishlist') || '[]'),
      preferences: JSON.parse(localStorage.getItem('globexPreferences') || 'null'),
      exportDate: new Date().toISOString(),
    };
  }

  function exportAsJSON() {
    const data = collectUserData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `globexsky-data-export-${Date.now()}.json`);
  }

  function exportAsCSV() {
    const data = collectUserData();
    const rows = [
      ['Category', 'Key', 'Value'],
      ['Profile', 'name', data.profile?.name || ''],
      ['Profile', 'email', data.profile?.email || ''],
      ['Consent', 'analytics', data.consentRecord?.analytics ?? ''],
      ['Consent', 'marketing', data.consentRecord?.marketing ?? ''],
      ['Consent', 'functional', data.consentRecord?.functional ?? ''],
      ['Meta', 'exportDate', data.exportDate],
      ...data.searchHistory.map((q, i) => ['Search History', `query_${i + 1}`, q]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `globexsky-data-export-${Date.now()}.csv`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function initDataExport() {
    const jsonBtn = document.getElementById('btn-export-json');
    const csvBtn = document.getElementById('btn-export-csv');
    if (jsonBtn) jsonBtn.addEventListener('click', () => { exportAsJSON(); showToast('JSON export downloaded.', 'success'); });
    if (csvBtn) csvBtn.addEventListener('click', () => { exportAsCSV(); showToast('CSV export downloaded.', 'success'); });
  }

  /* ── Age Verification ───────────────────────────────────────────────── */
  function isAgeVerified() {
    return localStorage.getItem(AGE_KEY) === 'true';
  }

  function verifyAge(dob) {
    const birth = new Date(dob);
    const ageDiff = Date.now() - birth.getTime();
    const ageDate = new Date(ageDiff);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    if (age >= 18) {
      localStorage.setItem(AGE_KEY, 'true');
      return { verified: true, age };
    }
    return { verified: false, age };
  }

  function initAgeVerification() {
    const form = document.getElementById('age-verification-form');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const dob = form.querySelector('[name="dob"]')?.value;
      if (!dob) return;
      const result = verifyAge(dob);
      if (result.verified) {
        const overlay = document.getElementById('age-gate');
        if (overlay) overlay.remove();
        showToast('Age verified. Welcome!', 'success');
      } else {
        showToast(`Sorry, you must be 18 or older to access this page. (Age: ${result.age})`, 'error');
      }
    });
  }

  /* ── Data Breach Notification ───────────────────────────────────────── */
  function checkBreachNotification() {
    const breachKey = 'globexBreachNotice';
    const breach = JSON.parse(localStorage.getItem(breachKey) || 'null');
    if (!breach || breach.dismissed) return;

    const banner = document.createElement('div');
    banner.className = 'breach-notification-banner';
    banner.innerHTML = `
      <div class="breach-banner-inner">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Security Notice — ${new Date(breach.date).toLocaleDateString()}</strong>
          <p>${breach.message}</p>
        </div>
        <button onclick="GlobexGDPR.dismissBreachNotice()" class="btn-sm btn-secondary">Dismiss</button>
      </div>
    `;
    document.body.prepend(banner);
  }

  function dismissBreachNotice() {
    const breachKey = 'globexBreachNotice';
    const breach = JSON.parse(localStorage.getItem(breachKey) || '{}');
    breach.dismissed = true;
    localStorage.setItem(breachKey, JSON.stringify(breach));
    const banner = document.querySelector('.breach-notification-banner');
    if (banner) banner.remove();
  }

  /* ── Consent Dashboard (Admin) ──────────────────────────────────────── */
  function renderConsentDashboard() {
    const container = document.getElementById('consent-stats');
    if (!container) return;

    // Demo stats
    const stats = [
      { category: 'Analytics', accepted: 7840, rejected: 2160 },
      { category: 'Marketing', accepted: 5230, rejected: 4770 },
      { category: 'Functional', accepted: 8920, rejected: 1080 },
    ];

    container.innerHTML = stats.map(s => {
      const total = s.accepted + s.rejected;
      const pct = Math.round((s.accepted / total) * 100);
      return `
        <div class="consent-stat-row">
          <span class="consent-stat-cat">${s.category}</span>
          <div class="consent-stat-bar">
            <div class="consent-stat-fill" style="width:${pct}%;background:#059669"></div>
          </div>
          <span class="consent-stat-pct">${pct}% accepted</span>
          <span class="consent-stat-total">${total.toLocaleString()} users</span>
        </div>
      `;
    }).join('');
  }

  /* ── Utility ────────────────────────────────────────────────────────── */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `gdpr-toast gdpr-toast--${type}`;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;font-size:.88rem;font-weight:500;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:opacity .3s';
    toast.style.background = type === 'success' ? '#059669' : type === 'error' ? '#ef4444' : '#0052CC';
    toast.style.color = '#fff';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    initPrivacyCenter();
    initDeletionRequest();
    initDataExport();
    initAgeVerification();
    checkBreachNotification();
    renderDeletionHistory();
    renderConsentDashboard();
  }

  return {
    init,
    getConsent,
    saveConsent,
    hasConsent,
    revokeAll,
    submitDeletionRequest,
    getDeletionRequests,
    renderDeletionHistory,
    exportAsJSON,
    exportAsCSV,
    isAgeVerified,
    verifyAge,
    dismissBreachNotice,
    renderConsentDashboard,
    CATEGORIES,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  GlobexGDPR.init();
});

window.GlobexGDPR = GlobexGDPR;
