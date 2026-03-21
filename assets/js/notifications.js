/**
 * Globex Sky — Notifications Frontend
 * Handles notification list, filtering, mark read, unread count badge.
 */
(function () {
  'use strict';

  const API = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';

  /* ── State ──────────────────────────────────────────────────────────────── */
  let notifications = [];
  let activeFilter = 'all';
  let pollInterval = null;

  /* ── DOM Refs ───────────────────────────────────────────────────────────── */
  const listEl          = document.getElementById('notificationList');
  const unreadBadge     = document.querySelector('.notif-unread-badge');
  const markAllBtn      = document.getElementById('markAllReadBtn');
  const filterTabs      = document.querySelectorAll('[data-notif-filter]');
  const emptyStateEl    = document.getElementById('notifEmptyState');
  const loadingEl       = document.getElementById('notifLoading');

  /* ── Auth helper ────────────────────────────────────────────────────────── */
  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() };
  }

  /* ── API calls ──────────────────────────────────────────────────────────── */
  async function fetchNotifications() {
    try {
      if (loadingEl) loadingEl.style.display = 'block';
      const res = await fetch(API + '/notifications', { headers: authHeaders() });
      if (!res.ok) { if (loadingEl) loadingEl.style.display = 'none'; return; }
      const json = await res.json();
      notifications = json.data || [];
      renderNotifications();
      if (loadingEl) loadingEl.style.display = 'none';
    } catch (e) {
      if (loadingEl) loadingEl.style.display = 'none';
      console.warn('Notifications: failed to load', e);
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch(API + '/notifications/unread-count', { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      updateBadge(json.data ? json.data.count : 0);
    } catch (e) { /* silent */ }
  }

  async function markRead(id) {
    try {
      await fetch(API + '/notifications/' + id + '/read', { method: 'PATCH', headers: authHeaders() });
      const notif = notifications.find(n => n.id === id);
      if (notif) { notif.read = true; notif.is_read = true; }
      renderNotifications();
      fetchUnreadCount();
    } catch (e) { console.warn('Notifications: mark read failed', e); }
  }

  async function markAllRead() {
    try {
      await fetch(API + '/notifications/mark-all-read', { method: 'PATCH', headers: authHeaders() });
      notifications.forEach(n => { n.read = true; n.is_read = true; });
      renderNotifications();
      updateBadge(0);
    } catch (e) { console.warn('Notifications: mark all read failed', e); }
  }

  async function deleteNotification(id) {
    try {
      await fetch(API + '/notifications/' + id, { method: 'DELETE', headers: authHeaders() });
      notifications = notifications.filter(n => n.id !== id);
      renderNotifications();
      fetchUnreadCount();
    } catch (e) { console.warn('Notifications: delete failed', e); }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  function renderNotifications() {
    if (!listEl) return;

    const filtered = activeFilter === 'all'
      ? notifications
      : activeFilter === 'unread'
        ? notifications.filter(n => !(n.read || n.is_read))
        : notifications.filter(n => (n.type || '') === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = '';
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      return;
    }
    if (emptyStateEl) emptyStateEl.style.display = 'none';

    listEl.innerHTML = filtered.map(notif => {
      const isRead = notif.read || notif.is_read;
      const icon = getNotifIcon(notif.type);
      const time = formatTime(notif.created_at);
      return `<div class="notif-item${isRead ? '' : ' unread'}" data-id="${notif.id}">
        <div class="notif-icon ${getNotifClass(notif.type)}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="notif-body" style="flex:1;min-width:0;">
          <div class="notif-title" style="font-weight:${isRead ? '500' : '700'};font-size:.88rem;color:#0a0e27;">${escHtml(notif.title)}</div>
          <div class="notif-message" style="font-size:.82rem;color:#64748b;margin-top:2px;">${escHtml(notif.message)}</div>
          <div class="notif-time" style="font-size:.75rem;color:#94a3b8;margin-top:4px;">${time}</div>
        </div>
        <div class="notif-actions" style="display:flex;gap:6px;flex-shrink:0;">
          ${!isRead ? `<button class="icon-btn notif-read-btn" title="Mark as read" data-id="${notif.id}"><i class="fas fa-check"></i></button>` : ''}
          <button class="icon-btn notif-delete-btn" title="Delete" data-id="${notif.id}" style="color:#ef4444;"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
    }).join('');

    // Bind events
    listEl.querySelectorAll('.notif-read-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); markRead(btn.dataset.id); });
    });
    listEl.querySelectorAll('.notif-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteNotification(btn.dataset.id); });
    });
    listEl.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const notif = notifications.find(n => n.id === id);
        if (notif && !(notif.read || notif.is_read)) markRead(id);
        if (notif && notif.link) window.location.href = notif.link;
      });
    });

    // Update unread count badge
    const unreadCount = notifications.filter(n => !(n.read || n.is_read)).length;
    updateBadge(unreadCount);
  }

  /* ── Badge update ───────────────────────────────────────────────────────── */
  function updateBadge(count) {
    // Update all badges with .notif-unread-badge or .notification-badge class
    const badges = document.querySelectorAll('.notif-unread-badge, .notification-badge, [data-notif-count]');
    badges.forEach(b => {
      b.textContent = count > 99 ? '99+' : count;
      b.style.display = count > 0 ? '' : 'none';
    });
  }

  /* ── Filter tabs ────────────────────────────────────────────────────────── */
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.notifFilter;
      renderNotifications();
    });
  });

  /* ── Mark all read ──────────────────────────────────────────────────────── */
  if (markAllBtn) {
    markAllBtn.addEventListener('click', markAllRead);
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function getNotifIcon(type) {
    const icons = {
      order: 'fa-box', payment: 'fa-credit-card', shipment: 'fa-shipping-fast',
      message: 'fa-comment-dots', promotion: 'fa-tag', system: 'fa-bell',
      info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle',
      error: 'fa-times-circle', dispute: 'fa-gavel',
    };
    return icons[type] || 'fa-bell';
  }

  function getNotifClass(type) {
    const classes = {
      order: 'orders', payment: 'orders', shipment: 'shipments',
      message: 'orders', promotion: 'promotions', system: 'system',
    };
    return classes[type] || 'system';
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return Math.floor(diffMs / 60000) + ' min ago';
    if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + ' hr ago';
    if (diffMs < 604800000) return Math.floor(diffMs / 86400000) + ' days ago';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    fetchNotifications();
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    pollInterval = setInterval(() => { fetchUnreadCount(); }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for use in navbar badge updates
  window.GlobexNotifications = {
    refresh: fetchNotifications,
    getUnreadCount: fetchUnreadCount,
    updateBadge: updateBadge,
  };
}());
