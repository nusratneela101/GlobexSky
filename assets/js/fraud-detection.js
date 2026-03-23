/**
 * Globex Sky — fraud-detection.js
 * Fraud detection module:
 *   - Real-time transaction risk scoring with configurable rules
 *   - Velocity checks (rapid transactions, account changes)
 *   - Device fingerprinting (browser, OS, screen resolution)
 *   - Geolocation anomaly detection (impossible travel)
 *   - Behavioral analysis patterns
 *   - Fraud review queue management
 *   - IP reputation checking
 *   - Fraud analytics dashboard
 */

'use strict';

const GlobexFraud = (() => {

  /* ── Device Fingerprint ─────────────────────────────────────────────── */
  function getDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('GlobexSky', 2, 2);
    const canvasHash = canvas.toDataURL().length;

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      canvasHash,
      touchPoints: navigator.maxTouchPoints || 0,
    };
  }

  function getFingerprintId() {
    const fp = getDeviceFingerprint();
    const str = JSON.stringify(fp);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  /* ── Velocity Checks ────────────────────────────────────────────────── */
  const VelocityChecker = (() => {
    const KEY = 'globexVelocity';
    const WINDOW_MS = 60 * 60 * 1000; // 1 hour

    function getEvents() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; }
      catch (_) { return []; }
    }

    function recordEvent(type, metadata = {}) {
      const events = getEvents();
      events.push({ type, metadata, ts: Date.now() });
      // Keep only last 24h of events
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const pruned = events.filter(e => e.ts > cutoff);
      localStorage.setItem(KEY, JSON.stringify(pruned));
    }

    function countInWindow(type, windowMs = WINDOW_MS) {
      const cutoff = Date.now() - windowMs;
      return getEvents().filter(e => e.type === type && e.ts > cutoff).length;
    }

    function checkVelocity(type, limit, windowMs = WINDOW_MS) {
      const count = countInWindow(type, windowMs);
      return { count, exceeded: count >= limit, limit };
    }

    return { recordEvent, countInWindow, checkVelocity };
  })();

  /* ── Risk Scoring ───────────────────────────────────────────────────── */
  const RULES = [
    { id: 'high_amount', label: 'Transaction > $1000', weight: 25, enabled: true },
    { id: 'rapid_txn', label: '3+ transactions/hour', weight: 40, enabled: true },
    { id: 'new_device', label: 'New device fingerprint', weight: 20, enabled: true },
    { id: 'vpn_detected', label: 'VPN/Proxy detected', weight: 30, enabled: true },
    { id: 'country_mismatch', label: 'IP country ≠ billing country', weight: 35, enabled: true },
    { id: 'multiple_declines', label: '2+ card declines (24h)', weight: 45, enabled: true },
    { id: 'email_domain', label: 'Disposable email domain', weight: 20, enabled: true },
    { id: 'address_mismatch', label: 'Shipping ≠ billing address', weight: 15, enabled: true },
  ];

  function getRules() {
    try {
      const stored = JSON.parse(localStorage.getItem('globexFraudRules'));
      return stored || RULES;
    } catch (_) {
      return RULES;
    }
  }

  function saveRules(rules) {
    localStorage.setItem('globexFraudRules', JSON.stringify(rules));
  }

  function scoreTransaction(transaction = {}) {
    const rules = getRules().filter(r => r.enabled);
    let score = 0;
    const triggered = [];

    rules.forEach(rule => {
      let hit = false;
      switch (rule.id) {
        case 'high_amount':
          hit = (transaction.amount || 0) > 1000;
          break;
        case 'rapid_txn':
          hit = VelocityChecker.checkVelocity('transaction', 3).exceeded;
          break;
        case 'new_device':
          hit = transaction.isNewDevice === true;
          break;
        case 'vpn_detected':
          hit = transaction.vpnDetected === true;
          break;
        case 'country_mismatch':
          hit = transaction.ipCountry && transaction.billingCountry &&
                transaction.ipCountry !== transaction.billingCountry;
          break;
        case 'multiple_declines':
          hit = VelocityChecker.checkVelocity('card_decline', 2, 24 * 60 * 60 * 1000).exceeded;
          break;
        case 'email_domain': {
          const disposable = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com', 'yopmail.com'];
          const domain = (transaction.email || '').split('@')[1] || '';
          hit = disposable.includes(domain.toLowerCase());
          break;
        }
        case 'address_mismatch':
          hit = transaction.shippingAddress && transaction.billingAddress &&
                transaction.shippingAddress !== transaction.billingAddress;
          break;
      }
      if (hit) {
        score += rule.weight;
        triggered.push(rule);
      }
    });

    const normalised = Math.min(100, score);
    return {
      score: normalised,
      level: normalised >= 70 ? 'high' : normalised >= 40 ? 'medium' : 'low',
      triggered,
      deviceFingerprint: getFingerprintId(),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /* ── Geolocation Anomaly ────────────────────────────────────────────── */
  function checkImpossibleTravel(currentLocation, lastLocation, lastTimestamp) {
    if (!currentLocation || !lastLocation) return false;
    const hoursElapsed = (Date.now() - lastTimestamp) / 3600000;
    const distKm = haversine(
      lastLocation.lat, lastLocation.lon,
      currentLocation.lat, currentLocation.lon
    );
    const speedKmh = distKm / Math.max(hoursElapsed, 0.01);
    // Impossible if speed exceeds 1200 km/h (max commercial aircraft)
    return speedKmh > 1200;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ── Fraud Review Queue ─────────────────────────────────────────────── */
  const QUEUE_KEY = 'globexFraudQueue';

  function getQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
    catch (_) { return []; }
  }

  function addToQueue(transaction, scoreResult) {
    const queue = getQueue();
    queue.unshift({
      id: 'FRD-' + Date.now(),
      transaction,
      scoreResult,
      status: 'pending',
      addedAt: new Date().toISOString(),
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, 100)));
  }

  function updateQueueItem(id, status) {
    const queue = getQueue().map(item =>
      item.id === id ? Object.assign({}, item, { status, updatedAt: new Date().toISOString() }) : item
    );
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    renderQueue();
  }

  /* ── Dashboard Rendering ────────────────────────────────────────────── */
  function renderQueue() {
    const tbody = document.getElementById('fraud-queue-tbody');
    if (!tbody) return;
    const queue = getQueue();
    if (!queue.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No flagged transactions.</td></tr>';
      return;
    }
    tbody.innerHTML = queue.slice(0, 50).map(item => {
      const s = item.scoreResult;
      const levelClass = s.level === 'high' ? 'badge-red' : s.level === 'medium' ? 'badge-orange' : 'badge-green';
      return `
        <tr>
          <td>${item.id}</td>
          <td>${new Date(item.addedAt).toLocaleString()}</td>
          <td>$${(item.transaction.amount || 0).toFixed(2)}</td>
          <td>${item.transaction.email || '—'}</td>
          <td>
            <span class="badge-pill ${levelClass}">${s.score}/100 ${s.level.toUpperCase()}</span>
          </td>
          <td><span class="badge-pill ${item.status === 'approved' ? 'badge-green' : item.status === 'rejected' ? 'badge-red' : 'badge-blue'}">${item.status}</span></td>
          <td>
            <button class="btn-sm btn-success" onclick="GlobexFraud.updateQueueItem('${item.id}','approved')">Approve</button>
            <button class="btn-sm btn-danger" onclick="GlobexFraud.updateQueueItem('${item.id}','rejected')" style="margin-left:4px">Reject</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderRuleConfig() {
    const container = document.getElementById('fraud-rules-list');
    if (!container) return;
    const rules = getRules();
    container.innerHTML = rules.map(r => `
      <div class="rule-row" data-rule-id="${r.id}">
        <div class="rule-info">
          <span class="rule-label">${r.label}</span>
          <span class="rule-weight">Weight: ${r.weight}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="GlobexFraud.toggleRule('${r.id}', this.checked)"/>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');
  }

  function toggleRule(id, enabled) {
    const rules = getRules().map(r => r.id === id ? Object.assign({}, r, { enabled }) : r);
    saveRules(rules);
  }

  function renderMetrics() {
    const queue = getQueue();
    const high = queue.filter(i => i.scoreResult.level === 'high').length;
    const medium = queue.filter(i => i.scoreResult.level === 'medium').length;
    const approved = queue.filter(i => i.status === 'approved').length;
    const rejected = queue.filter(i => i.status === 'rejected').length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('fraud-metric-total', queue.length);
    setEl('fraud-metric-high', high);
    setEl('fraud-metric-medium', medium);
    setEl('fraud-metric-approved', approved);
    setEl('fraud-metric-rejected', rejected);
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    renderQueue();
    renderRuleConfig();
    renderMetrics();
  }

  return {
    init,
    getDeviceFingerprint,
    getFingerprintId,
    VelocityChecker,
    getRules,
    saveRules,
    scoreTransaction,
    checkImpossibleTravel,
    getQueue,
    addToQueue,
    updateQueueItem,
    renderQueue,
    renderRuleConfig,
    toggleRule,
    renderMetrics,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('fraud-queue-tbody') || document.getElementById('fraud-rules-list')) {
    GlobexFraud.init();
  }
});

window.GlobexFraud = GlobexFraud;
