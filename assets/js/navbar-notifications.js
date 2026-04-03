/**
 * Globex Sky — navbar-notifications.js
 * Handles notification bell in the navbar: unread count, dropdown list, mark as read.
 */
(function () {
  'use strict';

  var API_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';
  var POLL_MS  = 30000; // 30s polling

  /* ── DOM refs ── */
  var wrapper  = document.getElementById('nav-notif-wrapper');
  var btn      = document.getElementById('nav-notif-btn');
  var badge    = document.getElementById('nav-notif-badge');
  var dropdown = document.getElementById('nav-notif-dropdown');
  var list     = document.getElementById('nav-notif-list');
  var markAll  = document.getElementById('nav-notif-mark-all');

  if (!wrapper || !btn) return; // not on this page

  /* ── Auth helper ── */
  function getToken() {
    try {
      var s = JSON.parse(localStorage.getItem('globexSession') || '{}');
      if (s.token) return s.token;
    } catch(_) {}
    return localStorage.getItem('globexToken') || localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function isLoggedIn() { return !!getToken(); }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
  }

  /* ── Show/hide wrapper based on auth ── */
  function checkAuth() {
    if (isLoggedIn()) {
      wrapper.style.display = '';
      loadUnreadCount();
    }
  }

  /* ── Fetch unread count ── */
  function loadUnreadCount() {
    fetch(API_BASE + '/notifications/unread-count', { headers: authHeaders() })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) {
        var count = j && j.data ? (j.data.count || 0) : 0;
        updateBadge(count);
      })
      .catch(function() {});
  }

  function updateBadge(count) {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ── Fetch notifications for dropdown ── */
  function loadNotifications() {
    if (!list) return;
    fetch(API_BASE + '/notifications?limit=5', { headers: authHeaders() })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) {
        var items = j && j.data ? j.data : [];
        renderList(items);
      })
      .catch(function() {
        if (list) list.innerHTML = '<div class="nav-notif-empty">Could not load notifications</div>';
      });
  }

  /* ── Render dropdown list ── */
  function renderList(items) {
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="nav-notif-empty">No notifications</div>';
      return;
    }
    var iconMap = {
      order: { color: '#3b82f6', bg: '#eff6ff', icon: 'fa-box' },
      message: { color: '#8b5cf6', bg: '#f5f3ff', icon: 'fa-envelope' },
      price_alert: { color: '#f59e0b', bg: '#fffbeb', icon: 'fa-tag' },
      system: { color: '#6b7280', bg: '#f9fafb', icon: 'fa-info-circle' },
      shipping: { color: '#10b981', bg: '#f0fdf4', icon: 'fa-truck' },
    };
    list.innerHTML = items.map(function(n) {
      var type = n.type || 'system';
      var ic   = iconMap[type] || iconMap.system;
      var isUnread = !n.is_read && !n.read;
      return '<div class="nav-notif-item' + (isUnread ? ' unread' : '') + '" data-id="' + n.id + '">' +
        '<div class="nav-notif-icon" style="background:' + ic.bg + ';color:' + ic.color + '">' +
          '<i class="fas ' + ic.icon + '"></i>' +
        '</div>' +
        '<div class="nav-notif-content">' +
          '<div class="nav-notif-text">' + escHtml(n.message || n.title || 'Notification') + '</div>' +
          '<div class="nav-notif-time">' + timeAgo(n.created_at) + '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.nav-notif-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = el.getAttribute('data-id');
        markRead(id, el);
      });
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }

  /* ── Mark single read ── */
  function markRead(id, el) {
    var doFetch = (window.GlobexCSRF && window.GlobexCSRF.fetch) ? window.GlobexCSRF.fetch : fetch;
    doFetch(API_BASE + '/notifications/' + id + '/read', { method: 'PATCH', headers: authHeaders() })
      .then(function() {
        if (el) el.classList.remove('unread');
        loadUnreadCount();
      })
      .catch(function() {});
  }

  /* ── Toggle dropdown ── */
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) loadNotifications();
  });

  /* ── Mark all read ── */
  if (markAll) {
    markAll.addEventListener('click', function(e) {
      e.stopPropagation();
      var doFetch = (window.GlobexCSRF && window.GlobexCSRF.fetch) ? window.GlobexCSRF.fetch : fetch;
      doFetch(API_BASE + '/notifications/mark-all-read', { method: 'PATCH', headers: authHeaders() })
        .then(function() {
          updateBadge(0);
          loadNotifications();
        })
        .catch(function() {});
    });
  }

  /* ── Close on outside click ── */
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ── Close on Escape ── */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ── Init ── */
  checkAuth();

  /* ── Poll for updates ── */
  if (isLoggedIn()) {
    setInterval(loadUnreadCount, POLL_MS);
  }

})();
