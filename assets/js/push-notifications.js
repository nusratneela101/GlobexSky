/**
 * Globex Sky — Push Notifications Module
 * Handles push permission, preferences (localStorage), quiet hours,
 * notification history, in-app bell, mock notifications, and admin campaigns.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  PREFS: 'gsky_push_prefs',
  HISTORY: 'gsky_push_history',
  CAMPAIGNS: 'gsky_push_campaigns',
  ENABLED: 'gsky_push_enabled',
  SOUND: 'gsky_push_sound',
};

const ALL_CATEGORIES = [
  'orders', 'messages', 'shipping', 'prices',
  'promotions', 'newproducts', 'rfq', 'system'
];

const SAMPLE_NOTIFICATIONS = [
  { id: 's1', title: 'Order #GS-40821 Shipped', body: 'Your order is on its way! Estimated delivery: 3-5 business days.', category: 'orders', read: false, sent_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 's2', title: 'New Message from TechPro Supplies', body: 'Hi, we have the bulk pricing you requested for LED panels.', category: 'messages', read: false, sent_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 's3', title: 'Price Drop Alert', body: 'Industrial Power Bank 20000mAh dropped 18% — now $24.99', category: 'prices', read: true, sent_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 's4', title: 'Shipment Cleared Customs', body: 'Container MSKU-4829172 cleared customs at Port of LA.', category: 'shipping', read: true, sent_at: new Date(Date.now() - 28800000).toISOString() },
  { id: 's5', title: 'Flash Sale: Electronics 30% OFF', body: 'Limited time offer on all electronic accessories. Ends midnight!', category: 'promotions', read: true, sent_at: new Date(Date.now() - 43200000).toISOString() },
  { id: 's6', title: 'RFQ Response Received', body: 'Supplier "Global Metals Inc" submitted a quote for your RFQ-2847.', category: 'rfq', read: false, sent_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 's7', title: 'New Product Match', body: '12 new products match your saved search "wireless earbuds wholesale".', category: 'newproducts', read: true, sent_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 's8', title: 'System Maintenance Scheduled', body: 'Platform will undergo maintenance on Sunday 2:00-4:00 AM UTC.', category: 'system', read: true, sent_at: new Date(Date.now() - 172800000).toISOString() },
];

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
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(isoString).toLocaleDateString();
}

function generateId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── localStorage Wrappers ────────────────────────────────────────────────────
function getStoredJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function setStoredJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* quota */ }
}

// ─── Preferences ──────────────────────────────────────────────────────────────
function getDefaultPrefs() {
  const cats = {};
  ALL_CATEGORIES.forEach(function(c) { cats[c] = (c === 'prices' || c === 'promotions' || c === 'newproducts') ? false : true; });
  return {
    categories: cats,
    quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
    sound: 'default',
  };
}

function loadPrefs() {
  return getStoredJSON(STORAGE_KEYS.PREFS, getDefaultPrefs());
}

function savePrefs(prefs) {
  setStoredJSON(STORAGE_KEYS.PREFS, prefs);
}

// ─── Notification History (localStorage) ──────────────────────────────────────
function getHistory() {
  var hist = getStoredJSON(STORAGE_KEYS.HISTORY, null);
  if (!hist) {
    hist = SAMPLE_NOTIFICATIONS.slice();
    setStoredJSON(STORAGE_KEYS.HISTORY, hist);
  }
  return hist;
}

function addToHistory(notification) {
  var hist = getHistory();
  hist.unshift(notification);
  if (hist.length > 50) hist = hist.slice(0, 50);
  setStoredJSON(STORAGE_KEYS.HISTORY, hist);
  return hist;
}

function clearHistory() {
  setStoredJSON(STORAGE_KEYS.HISTORY, []);
}

// ─── Quiet Hours Check ───────────────────────────────────────────────────────
function isQuietHoursActive() {
  var prefs = loadPrefs();
  if (!prefs.quiet_hours || !prefs.quiet_hours.enabled) return false;
  var now = new Date();
  var currentMinutes = now.getHours() * 60 + now.getMinutes();
  var parts = prefs.quiet_hours.start.split(':');
  var startMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  parts = prefs.quiet_hours.end.split(':');
  var endMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  var toast = document.getElementById('push-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'push-toast';
    toast.className = 'push-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  var iconClass = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
  toast.className = 'push-toast ' + type;
  toast.innerHTML = '<i class="fa-solid ' + iconClass + '"></i> ' + escapeHtml(message);
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

// ─── Permission Badge ─────────────────────────────────────────────────────────
function updatePermissionBadge() {
  var badge = document.getElementById('push-permission-badge');
  if (!badge) return;
  var perm = 'Notification' in window ? Notification.permission : 'default';
  badge.className = 'push-status-badge ' + perm;
  var labels = { granted: 'Enabled', denied: 'Blocked', 'default': 'Not Set' };
  var icons = { granted: 'fa-bell', denied: 'fa-bell-slash', 'default': 'fa-bell' };
  badge.innerHTML = '<i class="fa-solid ' + (icons[perm] || 'fa-bell') + '"></i> ' + (labels[perm] || perm);
}

// ─── Master Toggle Sync ──────────────────────────────────────────────────────
function syncMasterToggle() {
  var toggle = document.getElementById('push-master-toggle');
  if (!toggle) return;
  var enabled = getStoredJSON(STORAGE_KEYS.ENABLED, false);
  toggle.checked = enabled;
}

// ─── Subscribe (Browser Notification API) ────────────────────────────────────
function subscribe(callback) {
  if (!('Notification' in window)) {
    showToast('Push notifications are not supported in this browser.', 'error');
    if (callback) callback(false);
    return;
  }

  Notification.requestPermission().then(function(perm) {
    updatePermissionBadge();
    if (perm === 'granted') {
      setStoredJSON(STORAGE_KEYS.ENABLED, true);
      showToast('Push notifications enabled!', 'success');
      if (callback) callback(true);
    } else {
      showToast('Permission denied. Enable notifications in your browser settings.', 'error');
      if (callback) callback(false);
    }
  });
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
function unsubscribe() {
  setStoredJSON(STORAGE_KEYS.ENABLED, false);
  showToast('Push notifications disabled.', 'info');
}

// ─── Register Service Worker ──────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.warn('[PushNotifications] SW registration failed:', err);
    });
  }
}

// ─── Send Test Notification ───────────────────────────────────────────────────
function sendTestNotification() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser.', 'error');
    return;
  }

  if (Notification.permission !== 'granted') {
    showToast('Please enable notifications first.', 'error');
    return;
  }

  if (isQuietHoursActive()) {
    showToast('Quiet hours active — notification suppressed.', 'info');
    return;
  }

  var testNotif = {
    id: generateId(),
    title: 'Globex Sky — Test Notification',
    body: 'Push notifications are working correctly! 🎉',
    category: 'system',
    read: false,
    sent_at: new Date().toISOString(),
  };
  addToHistory(testNotif);

  try {
    new Notification(testNotif.title, {
      body: testNotif.body,
      icon: '/assets/images/logo.png',
    });
    showToast('Test notification delivered!', 'success');
  } catch (e) {
    showToast('Test notification added to history.', 'success');
  }
  renderHistory();
  updateBellCounter();
}

// ─── Render Notification History ──────────────────────────────────────────────
function renderHistory() {
  var container = document.getElementById('push-history-list');
  if (!container) return;

  var hist = getHistory();

  if (!hist || hist.length === 0) {
    container.innerHTML =
      '<div class="push-history-empty">' +
      '<i class="fa-regular fa-bell-slash"></i>' +
      '<span>No notifications yet. Enable push notifications to get started.</span>' +
      '</div>';
    return;
  }

  container.innerHTML = hist.slice(0, 20).map(function(item) {
    return '<div class="push-history-item ' + (item.read ? '' : 'unread') + '" data-id="' + escapeHtml(item.id || '') + '">' +
      '<div class="history-dot"></div>' +
      '<div class="history-body">' +
      '<div class="history-title">' + escapeHtml(item.title || 'Notification') + '</div>' +
      (item.body ? '<div class="history-message">' + escapeHtml(item.body) + '</div>' : '') +
      '<div class="history-time">' + formatRelativeTime(item.sent_at || item.created_at) + '</div>' +
      '</div></div>';
  }).join('');
}

// ─── Load Preferences into UI ─────────────────────────────────────────────────
function loadPreferencesUI() {
  var prefs = loadPrefs();

  ALL_CATEGORIES.forEach(function(cat) {
    var el = document.getElementById('pref-' + cat);
    if (el && prefs.categories && prefs.categories[cat] !== undefined) {
      el.checked = prefs.categories[cat];
    }
  });

  if (prefs.quiet_hours) {
    var startEl = document.getElementById('quiet-start');
    var endEl = document.getElementById('quiet-end');
    var enEl = document.getElementById('quiet-enabled');
    if (startEl && prefs.quiet_hours.start) startEl.value = prefs.quiet_hours.start;
    if (endEl && prefs.quiet_hours.end) endEl.value = prefs.quiet_hours.end;
    if (enEl) {
      enEl.checked = !!prefs.quiet_hours.enabled;
      toggleQuietHoursFields(enEl.checked);
    }
  }

  var soundSelect = document.getElementById('sound-select');
  if (soundSelect && prefs.sound) {
    soundSelect.value = prefs.sound;
  }
}

// ─── Save Preferences from UI ─────────────────────────────────────────────────
function savePreferencesUI() {
  var saveBtn = document.getElementById('btn-save-prefs');
  var feedback = document.getElementById('save-feedback');

  if (saveBtn) saveBtn.disabled = true;

  var categories = {};
  ALL_CATEGORIES.forEach(function(cat) {
    var el = document.getElementById('pref-' + cat);
    if (el) categories[cat] = el.checked;
  });

  var quietEnabled = document.getElementById('quiet-enabled');
  var quietStart = document.getElementById('quiet-start');
  var quietEnd = document.getElementById('quiet-end');
  var soundSelect = document.getElementById('sound-select');

  var prefs = {
    categories: categories,
    quiet_hours: {
      enabled: quietEnabled ? quietEnabled.checked : false,
      start: quietStart ? quietStart.value : '22:00',
      end: quietEnd ? quietEnd.value : '08:00',
    },
    sound: soundSelect ? soundSelect.value : 'default',
  };

  savePrefs(prefs);
  showToast('Preferences saved!', 'success');

  if (feedback) {
    feedback.classList.add('visible');
    setTimeout(function() { feedback.classList.remove('visible'); }, 3000);
  }
  if (saveBtn) saveBtn.disabled = false;
}

// ─── Quiet Hours Toggle ───────────────────────────────────────────────────────
function toggleQuietHoursFields(enabled) {
  var grid = document.getElementById('quiet-hours-grid');
  if (grid) grid.classList.toggle('disabled-row', !enabled);
}

function toggleCategoryRows(enabled) {
  document.querySelectorAll('.push-category-item, .quiet-hours-grid').forEach(function(el) {
    el.classList.toggle('disabled-row', !enabled);
  });
}

// ─── In-App Notification Bell ─────────────────────────────────────────────────
function updateBellCounter() {
  var badges = document.querySelectorAll('.push-bell-count');
  var hist = getHistory();
  var unread = hist.filter(function(n) { return !n.read; }).length;
  badges.forEach(function(badge) {
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  });
}

// ─── Mock Notification Generator ──────────────────────────────────────────────
var MOCK_TEMPLATES = [
  { title: 'New Order Received', body: 'Order #GS-{num} has been placed for ${amount}.', category: 'orders' },
  { title: 'Shipment Update', body: 'Your shipment {track} has arrived at the distribution center.', category: 'shipping' },
  { title: 'Price Drop!', body: '{product} is now {pct}% off — limited stock available.', category: 'prices' },
  { title: 'New Message', body: 'You have a new message from {supplier}.', category: 'messages' },
  { title: 'RFQ Quote Received', body: 'A new quote for RFQ-{rfq} has been submitted.', category: 'rfq' },
  { title: 'New Product Alert', body: '{count} new products match your saved search.', category: 'newproducts' },
  { title: 'Flash Sale Live!', body: 'Save up to {pct}% on {category} — ends tonight!', category: 'promotions' },
  { title: 'Security Alert', body: 'A new login was detected from {location}.', category: 'system' },
];

function generateMockNotification() {
  var tpl = MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)];
  var body = tpl.body
    .replace('{num}', (40000 + Math.floor(Math.random() * 10000)).toString())
    .replace('{amount}', (100 + Math.floor(Math.random() * 9900)).toFixed(2))
    .replace('{track}', 'TRK' + Math.floor(Math.random() * 999999))
    .replace('{product}', ['LED Panel Kit', 'Wireless Earbuds', 'Solar Charger', 'USB-C Hub'][Math.floor(Math.random() * 4)])
    .replace('{pct}', (10 + Math.floor(Math.random() * 40)).toString())
    .replace('{supplier}', ['TechPro Supplies', 'Global Metals Inc', 'EcoTrade Ltd', 'DigiParts Co'][Math.floor(Math.random() * 4)])
    .replace('{rfq}', (2000 + Math.floor(Math.random() * 8000)).toString())
    .replace('{count}', (3 + Math.floor(Math.random() * 20)).toString())
    .replace('{category}', ['Electronics', 'Home & Garden', 'Industrial', 'Apparel'][Math.floor(Math.random() * 4)])
    .replace('{location}', ['New York, US', 'London, UK', 'Tokyo, JP', 'Sydney, AU'][Math.floor(Math.random() * 4)]);

  return {
    id: generateId(),
    title: tpl.title,
    body: body,
    category: tpl.category,
    read: false,
    sent_at: new Date().toISOString(),
  };
}

// ─── Admin Campaign Management ────────────────────────────────────────────────
function getCampaigns() {
  return getStoredJSON(STORAGE_KEYS.CAMPAIGNS, []);
}

function saveCampaign(campaign) {
  var campaigns = getCampaigns();
  campaign.id = campaign.id || generateId();
  campaign.created_at = campaign.created_at || new Date().toISOString();
  campaign.stats = campaign.stats || { sent: 0, delivered: 0, clicked: 0 };
  campaigns.unshift(campaign);
  setStoredJSON(STORAGE_KEYS.CAMPAIGNS, campaigns);
  return campaign;
}

function deleteCampaign(id) {
  var campaigns = getCampaigns().filter(function(c) { return c.id !== id; });
  setStoredJSON(STORAGE_KEYS.CAMPAIGNS, campaigns);
}

// ─── Settings Page Init ───────────────────────────────────────────────────────
function initSettingsPage() {
  registerServiceWorker();
  updatePermissionBadge();
  syncMasterToggle();
  loadPreferencesUI();
  renderHistory();
  updateBellCounter();

  // Permission banner
  var banner = document.getElementById('push-permission-banner');
  if (banner && 'Notification' in window && Notification.permission === 'default') {
    banner.classList.add('visible');
  }

  // Master toggle
  var masterToggle = document.getElementById('push-master-toggle');
  if (masterToggle) {
    masterToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        subscribe(function(ok) {
          if (!ok) masterToggle.checked = false;
          updatePermissionBadge();
          toggleCategoryRows(masterToggle.checked);
        });
      } else {
        unsubscribe();
        updatePermissionBadge();
        toggleCategoryRows(false);
      }
    });
    toggleCategoryRows(masterToggle.checked);
  }

  // Quiet hours toggle
  var quietToggle = document.getElementById('quiet-enabled');
  if (quietToggle) {
    quietToggle.addEventListener('change', function(e) { toggleQuietHoursFields(e.target.checked); });
  }

  // Banner allow
  var btnAllow = document.getElementById('btn-allow-push');
  if (btnAllow) {
    btnAllow.addEventListener('click', function() {
      subscribe(function(ok) {
        if (ok) {
          if (banner) banner.classList.remove('visible');
          if (masterToggle) { masterToggle.checked = true; toggleCategoryRows(true); }
          updatePermissionBadge();
        }
      });
    });
  }

  // Banner dismiss
  var btnDismiss = document.getElementById('btn-dismiss-banner');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', function() { if (banner) banner.classList.remove('visible'); });
  }

  // Test notification
  var btnTest = document.getElementById('btn-test-push');
  if (btnTest) {
    btnTest.addEventListener('click', function() {
      btnTest.disabled = true;
      sendTestNotification();
      setTimeout(function() { btnTest.disabled = false; }, 1000);
    });
  }

  // Save preferences
  var btnSave = document.getElementById('btn-save-prefs');
  if (btnSave) {
    btnSave.addEventListener('click', savePreferencesUI);
  }

  // Clear history
  var btnClear = document.getElementById('btn-clear-history');
  if (btnClear) {
    btnClear.addEventListener('click', function() {
      clearHistory();
      renderHistory();
      updateBellCounter();
      showToast('Notification history cleared.', 'success');
    });
  }

  // Preview sound
  var btnPreview = document.getElementById('btn-preview-sound');
  if (btnPreview) {
    btnPreview.addEventListener('click', function() {
      showToast('Sound preview played.', 'info');
    });
  }
}

// ─── Admin Page Init ──────────────────────────────────────────────────────────
function initAdminPage() {
  renderAdminCampaigns();
  renderAdminMetrics();
  renderAdminTemplates();
}

function renderAdminMetrics() {
  var campaigns = getCampaigns();
  var totalSent = 0, totalDelivered = 0, totalClicked = 0;
  campaigns.forEach(function(c) {
    if (c.stats) {
      totalSent += c.stats.sent || 0;
      totalDelivered += c.stats.delivered || 0;
      totalClicked += c.stats.clicked || 0;
    }
  });

  var el;
  el = document.getElementById('metric-campaigns');
  if (el) el.textContent = campaigns.length;
  el = document.getElementById('metric-sent');
  if (el) el.textContent = totalSent.toLocaleString();
  el = document.getElementById('metric-delivered');
  if (el) el.textContent = totalDelivered.toLocaleString();
  el = document.getElementById('metric-clicked');
  if (el) el.textContent = totalClicked.toLocaleString();
}

function renderAdminCampaigns() {
  var tbody = document.getElementById('campaigns-tbody');
  if (!tbody) return;

  var campaigns = getCampaigns();
  if (campaigns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748b">No campaigns yet. Send your first push notification above.</td></tr>';
    return;
  }

  tbody.innerHTML = campaigns.map(function(c) {
    var statusClass = c.status === 'sent' ? 'badge-green' : c.status === 'scheduled' ? 'badge-blue' : 'badge-gray';
    return '<tr>' +
      '<td><strong>' + escapeHtml(c.title || '') + '</strong></td>' +
      '<td>' + escapeHtml(c.audience || 'all') + '</td>' +
      '<td><span class="badge ' + statusClass + '">' + escapeHtml(c.status || 'draft') + '</span></td>' +
      '<td>' + ((c.stats && c.stats.sent) || 0).toLocaleString() + '</td>' +
      '<td>' + ((c.stats && c.stats.delivered) || 0).toLocaleString() + '</td>' +
      '<td>' + ((c.stats && c.stats.clicked) || 0).toLocaleString() + '</td>' +
      '<td><button class="btn btn-sm btn-secondary" onclick="deleteAdminCampaign(\'' + c.id + '\')"><i class="fas fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function sendAdminCampaign() {
  var title = document.getElementById('camp-title');
  var body = document.getElementById('camp-body');
  var audience = document.getElementById('camp-audience');
  var url = document.getElementById('camp-url');
  var schedule = document.getElementById('camp-schedule');

  if (!title || !title.value.trim()) {
    showToast('Please enter a notification title.', 'error');
    return;
  }

  var sent = Math.floor(500 + Math.random() * 9500);
  var delivered = Math.floor(sent * (0.85 + Math.random() * 0.13));
  var clicked = Math.floor(delivered * (0.05 + Math.random() * 0.2));

  var campaign = {
    title: title.value.trim(),
    body: body ? body.value.trim() : '',
    audience: audience ? audience.value : 'all',
    url: url ? url.value.trim() : '',
    schedule: schedule ? schedule.value : '',
    status: (schedule && schedule.value) ? 'scheduled' : 'sent',
    stats: { sent: sent, delivered: delivered, clicked: clicked },
  };

  saveCampaign(campaign);
  renderAdminCampaigns();
  renderAdminMetrics();

  if (title) title.value = '';
  if (body) body.value = '';
  if (url) url.value = '';
  if (schedule) schedule.value = '';

  showToast('Campaign ' + (campaign.status === 'scheduled' ? 'scheduled' : 'sent') + ' successfully!', 'success');
}

function deleteAdminCampaign(id) {
  deleteCampaign(id);
  renderAdminCampaigns();
  renderAdminMetrics();
  showToast('Campaign deleted.', 'info');
}

function loadAdminTemplate(idx) {
  var templates = [
    { title: 'Flash Sale Alert', body: 'Don\'t miss our flash sale! Up to 50% off on selected items. Shop now before it ends!', audience: 'all' },
    { title: 'New Arrivals', body: 'Check out the latest products just added to our platform. Fresh inventory from verified suppliers!', audience: 'buyers' },
    { title: 'Order Reminder', body: 'You have items in your cart waiting for you. Complete your order now and save on shipping!', audience: 'buyers' },
    { title: 'Supplier Update', body: 'Your supplier verification has been updated. Log in to check your new status and badges.', audience: 'suppliers' },
    { title: 'Platform Maintenance', body: 'Scheduled maintenance will occur on Sunday 2:00-4:00 AM UTC. Plan accordingly.', audience: 'all' },
  ];

  var tpl = templates[idx];
  if (!tpl) return;

  var title = document.getElementById('camp-title');
  var body = document.getElementById('camp-body');
  var audience = document.getElementById('camp-audience');
  if (title) title.value = tpl.title;
  if (body) body.value = tpl.body;
  if (audience) audience.value = tpl.audience;

  showToast('Template loaded.', 'info');
}

function renderAdminTemplates() {
  var container = document.getElementById('templates-grid');
  if (!container) return;

  var templates = [
    { icon: 'fa-bolt', name: 'Flash Sale Alert', desc: 'Promote time-limited deals', color: '#f97316' },
    { icon: 'fa-box-open', name: 'New Arrivals', desc: 'Announce new products', color: '#0052CC' },
    { icon: 'fa-cart-shopping', name: 'Order Reminder', desc: 'Cart abandonment nudge', color: '#22C55E' },
    { icon: 'fa-building', name: 'Supplier Update', desc: 'Verification status changes', color: '#7c3aed' },
    { icon: 'fa-wrench', name: 'Platform Maintenance', desc: 'Scheduled downtime alerts', color: '#64748b' },
  ];

  container.innerHTML = templates.map(function(t, i) {
    return '<div class="template-card" onclick="loadAdminTemplate(' + i + ')">' +
      '<div class="template-icon" style="color:' + t.color + '"><i class="fas ' + t.icon + '"></i></div>' +
      '<div class="template-info"><div class="template-name">' + escapeHtml(t.name) + '</div>' +
      '<div class="template-desc">' + escapeHtml(t.desc) + '</div></div></div>';
  }).join('');
}

// Make admin functions globally available
if (typeof window !== 'undefined') {
  window.sendAdminCampaign = sendAdminCampaign;
  window.deleteAdminCampaign = deleteAdminCampaign;
  window.loadAdminTemplate = loadAdminTemplate;
}

// ─── Auto-Init ────────────────────────────────────────────────────────────────
function autoInit() {
  // Detect which page we're on
  if (document.getElementById('push-master-toggle')) {
    initSettingsPage();
  }
  if (document.getElementById('admin-push-form')) {
    initAdminPage();
  }
  updateBellCounter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}
