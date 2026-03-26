/**
 * Globex Sky — Push Notification Settings Page
 * Handles push permission, subscribe/unsubscribe, preferences, quiet hours, and history.
 */

const API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';

// ─── Utility: convert VAPID public key to Uint8Array ─────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Auth token helper ────────────────────────────────────────────────────────
function getAuthToken() {
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  let toast = document.getElementById('push-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'push-toast';
    toast.className = 'push-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.className = `push-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i> ${message}`;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Permission status badge ──────────────────────────────────────────────────
function updatePermissionBadge() {
  const badge = document.getElementById('push-permission-badge');
  if (!badge) return;
  const perm = 'Notification' in window ? Notification.permission : 'default';
  badge.className = `push-status-badge ${perm}`;
  const labels = { granted: 'Enabled', denied: 'Blocked', default: 'Not Set' };
  const icons  = { granted: 'fa-bell', denied: 'fa-bell-slash', default: 'fa-bell' };
  badge.innerHTML = `<i class="fa-solid ${icons[perm]}"></i> ${labels[perm] || perm}`;
}

// ─── Sync master toggle with subscription state ───────────────────────────────
async function syncMasterToggle() {
  const toggle = document.getElementById('push-master-toggle');
  if (!toggle) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toggle.checked = false;
    toggle.disabled = true;
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    toggle.checked = !!sub;
  } catch (_) {
    toggle.checked = false;
  }
}

// ─── Subscribe ────────────────────────────────────────────────────────────────
async function subscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push notifications are not supported in this browser.', 'error');
    return false;
  }

  const perm = await Notification.requestPermission();
  updatePermissionBadge();

  if (perm !== 'granted') {
    showToast('Permission denied. Enable notifications in your browser settings.', 'error');
    return false;
  }

  try {
    const vapidRes = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!vapidRes.ok) throw new Error('Could not load VAPID key.');
    const { data } = await vapidRes.json();

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    const token = getAuthToken();
    if (token) {
      await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub }),
      });
    }

    showToast('Push notifications enabled!', 'success');
    return true;
  } catch (err) {
    console.error('[PushSettings] Subscribe error:', err);
    showToast('Failed to enable push notifications.', 'error');
    return false;
  }
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
async function unsubscribe() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    const token = getAuthToken();
    if (token) {
      await fetch(`${API_BASE}/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    }

    await sub.unsubscribe();
    showToast('Push notifications disabled.', 'info');
    return true;
  } catch (err) {
    console.error('[PushSettings] Unsubscribe error:', err);
    showToast('Failed to disable push notifications.', 'error');
    return false;
  }
}

// ─── Load preferences from backend ───────────────────────────────────────────
async function loadPreferences() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/push/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data) return;

    // Apply category toggles
    const categories = ['orders', 'messages', 'shipping', 'prices', 'promotions'];
    categories.forEach((cat) => {
      const el = document.getElementById(`pref-${cat}`);
      if (el && data.categories && data.categories[cat] !== undefined) {
        el.checked = data.categories[cat];
      }
    });

    // Quiet hours
    if (data.quiet_hours) {
      const startEl = document.getElementById('quiet-start');
      const endEl   = document.getElementById('quiet-end');
      const enEl    = document.getElementById('quiet-enabled');
      if (startEl && data.quiet_hours.start) startEl.value = data.quiet_hours.start;
      if (endEl   && data.quiet_hours.end)   endEl.value   = data.quiet_hours.end;
      if (enEl    && data.quiet_hours.enabled !== undefined) {
        enEl.checked = data.quiet_hours.enabled;
        toggleQuietHoursFields(data.quiet_hours.enabled);
      }
    }
  } catch (err) {
    console.warn('[PushSettings] Could not load preferences:', err.message);
  }
}

// ─── Save preferences ─────────────────────────────────────────────────────────
async function savePreferences() {
  const token = getAuthToken();
  const saveBtn  = document.getElementById('btn-save-prefs');
  const feedback = document.getElementById('save-feedback');

  if (saveBtn) saveBtn.disabled = true;

  const categories = {};
  ['orders', 'messages', 'shipping', 'prices', 'promotions'].forEach((cat) => {
    const el = document.getElementById(`pref-${cat}`);
    if (el) categories[cat] = el.checked;
  });

  const quietEnabled = document.getElementById('quiet-enabled');
  const quietStart   = document.getElementById('quiet-start');
  const quietEnd     = document.getElementById('quiet-end');

  const payload = {
    categories,
    quiet_hours: {
      enabled: quietEnabled ? quietEnabled.checked : false,
      start: quietStart ? quietStart.value : '22:00',
      end:   quietEnd   ? quietEnd.value   : '08:00',
    },
  };

  try {
    if (token) {
      const res = await fetch(`${API_BASE}/push/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Server error.');
    } else {
      // Persist locally when not authenticated
      localStorage.setItem('push_prefs', JSON.stringify(payload));
    }
    showToast('Preferences saved!', 'success');
    if (feedback) {
      feedback.classList.add('visible');
      setTimeout(() => feedback.classList.remove('visible'), 3000);
    }
  } catch (err) {
    console.error('[PushSettings] Save error:', err);
    showToast('Failed to save preferences.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ─── Quiet hours toggle ───────────────────────────────────────────────────────
function toggleQuietHoursFields(enabled) {
  const grid = document.getElementById('quiet-hours-grid');
  if (grid) grid.classList.toggle('disabled-row', !enabled);
}

// ─── Send test notification ───────────────────────────────────────────────────
async function sendTestNotification() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser.', 'error');
    return;
  }

  if (Notification.permission !== 'granted') {
    showToast('Please enable notifications first.', 'error');
    return;
  }

  // Try backend test endpoint; fall back to local SW notification
  const token = getAuthToken();
  let sent = false;

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) { sent = true; showToast('Test notification sent!', 'success'); }
    } catch (_) { /* fall through */ }
  }

  if (!sent) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Globex Sky — Test Notification', {
        body: 'Push notifications are working correctly! 🎉',
        icon: '/assets/images/logo.png',
        badge: '/assets/images/badge.png',
        vibrate: [200, 100, 200],
        data: { url: '/pages/notifications/push-settings.html' },
        actions: [
          { action: 'view', title: 'View Settings' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      });
      showToast('Test notification delivered!', 'success');
    } catch (err) {
      console.error('[PushSettings] Test notification error:', err);
      showToast('Could not show test notification.', 'error');
    }
  }
}

// ─── Load notification history ────────────────────────────────────────────────
async function loadHistory() {
  const container = document.getElementById('push-history-list');
  if (!container) return;

  const token = getAuthToken();
  if (!token) {
    container.innerHTML = `
      <div class="push-history-empty">
        <i class="fa-regular fa-bell-slash"></i>
        <span>Sign in to view your notification history.</span>
      </div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/push/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch history.');
    const { data } = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="push-history-empty">
          <i class="fa-regular fa-bell-slash"></i>
          <span>No notifications yet. Enable push notifications to get started.</span>
        </div>`;
      return;
    }

    container.innerHTML = data.map((item) => `
      <div class="push-history-item ${item.read ? '' : 'unread'}">
        <div class="history-dot"></div>
        <div class="history-body">
          <div class="history-title">${escapeHtml(item.title || 'Notification')}</div>
          ${item.body ? `<div class="history-message">${escapeHtml(item.body)}</div>` : ''}
          <div class="history-time">${formatRelativeTime(item.sent_at || item.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    console.warn('[PushSettings] History load error:', err.message);
    container.innerHTML = `
      <div class="push-history-empty">
        <i class="fa-regular fa-bell-slash"></i>
        <span>Could not load notification history.</span>
      </div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

// ─── Register main sw.js ──────────────────────────────────────────────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[PushSettings] SW registration failed:', err);
    return null;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Register SW
  await registerServiceWorker();

  // Update permission badge
  updatePermissionBadge();

  // Sync master toggle
  await syncMasterToggle();

  // Permission banner visibility
  const banner = document.getElementById('push-permission-banner');
  if (banner && 'Notification' in window && Notification.permission === 'default') {
    banner.classList.add('visible');
  }

  // Master toggle event
  const masterToggle = document.getElementById('push-master-toggle');
  if (masterToggle) {
    masterToggle.addEventListener('change', async (e) => {
      masterToggle.disabled = true;
      if (e.target.checked) {
        const ok = await subscribe();
        if (!ok) masterToggle.checked = false;
      } else {
        const ok = await unsubscribe();
        if (!ok) masterToggle.checked = true;
      }
      masterToggle.disabled = false;
      updatePermissionBadge();
      toggleCategoryRows(masterToggle.checked);
    });
    toggleCategoryRows(masterToggle.checked);
  }

  // Quiet hours toggle
  const quietToggle = document.getElementById('quiet-enabled');
  if (quietToggle) {
    quietToggle.addEventListener('change', (e) => toggleQuietHoursFields(e.target.checked));
  }

  // Banner allow button
  const btnAllow = document.getElementById('btn-allow-push');
  if (btnAllow) {
    btnAllow.addEventListener('click', async () => {
      const ok = await subscribe();
      if (ok) {
        banner && banner.classList.remove('visible');
        if (masterToggle) { masterToggle.checked = true; toggleCategoryRows(true); }
        updatePermissionBadge();
      }
    });
  }

  // Banner dismiss
  const btnDismiss = document.getElementById('btn-dismiss-banner');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => banner && banner.classList.remove('visible'));
  }

  // Test notification
  const btnTest = document.getElementById('btn-test-push');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      btnTest.disabled = true;
      await sendTestNotification();
      btnTest.disabled = false;
    });
  }

  // Save preferences
  const btnSave = document.getElementById('btn-save-prefs');
  if (btnSave) {
    btnSave.addEventListener('click', savePreferences);
  }

  // Load data
  await loadPreferences();
  await loadHistory();
}

function toggleCategoryRows(enabled) {
  document.querySelectorAll('.push-category-item, .quiet-hours-grid').forEach((el) => {
    el.classList.toggle('disabled-row', !enabled);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
