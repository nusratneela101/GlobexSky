/**
 * Globex Sky — realtime.js
 * Real-time features via Socket.io: chat messaging, typing indicators,
 * online status, live notifications, order status updates, live stream.
 *
 * Requires socket.io-client to be loaded before this script.
 * Gracefully degrades when Socket.io is unavailable.
 */

const Realtime = (() => {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIGURATION
  ───────────────────────────────────────────── */
  function _getSocketURL() {
    if (window.GlobexConfig && window.GlobexConfig.SOCKET_URL) {
      return window.GlobexConfig.SOCKET_URL;
    }
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1')
      ? 'http://localhost:5000'
      : 'https://globexsky-backend.up.railway.app';
  }

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let _socket     = null;
  let _connected  = false;
  let _listeners  = {};        // event → [callbacks]
  let _typingTimers = {};      // conversationId → timer handle

  /* ─────────────────────────────────────────────
     TOKEN HELPERS
  ───────────────────────────────────────────── */
  function _getToken() {
    try {
      const s = JSON.parse(localStorage.getItem('globexSession') || 'null');
      return s?.token || null;
    } catch (_) { return null; }
  }

  /* ─────────────────────────────────────────────
     EVENT BUS (internal)
  ───────────────────────────────────────────── */
  function _emit(event, ...args) {
    (_listeners[event] || []).forEach((cb) => { try { cb(...args); } catch (_) {} });
  }

  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
    return () => off(event, callback); // returns unsubscribe fn
  }

  function off(event, callback) {
    if (_listeners[event]) {
      _listeners[event] = _listeners[event].filter((cb) => cb !== callback);
    }
  }

  /* ─────────────────────────────────────────────
     CONNECTION
  ───────────────────────────────────────────── */
  function connect() {
    if (_socket && _connected) return _socket;

    if (typeof io === 'undefined') {
      console.warn('[Realtime] Socket.io not loaded — real-time features disabled.');
      return null;
    }

    const token = _getToken();
    _socket = io(_getSocketURL(), {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    _socket.on('connect', () => {
      _connected = true;
      _emit('connected');
      _updateOnlineIndicator(true);
    });

    _socket.on('disconnect', (reason) => {
      _connected = false;
      _emit('disconnected', reason);
      _updateOnlineIndicator(false);
    });

    _socket.on('connect_error', (err) => {
      _emit('error', err);
    });

    // ── Chat events ──────────────────────────────
    _socket.on('message:new', (msg) => {
      _emit('message:new', msg);
      _appendChatMessage(msg, false);
    });

    _socket.on('message:delivered', (data) => {
      _emit('message:delivered', data);
      _updateMessageStatus(data.messageId, 'delivered');
    });

    _socket.on('message:read', (data) => {
      _emit('message:read', data);
      _updateMessageStatus(data.messageId, 'read');
    });

    _socket.on('typing:start', (data) => {
      _emit('typing:start', data);
      _showTypingIndicator(data.conversationId, data.userName);
    });

    _socket.on('typing:stop', (data) => {
      _emit('typing:stop', data);
      _hideTypingIndicator(data.conversationId);
    });

    // ── Presence ─────────────────────────────────
    _socket.on('user:online', (data) => {
      _emit('user:online', data);
      _updateUserPresence(data.userId, true);
    });

    _socket.on('user:offline', (data) => {
      _emit('user:offline', data);
      _updateUserPresence(data.userId, false);
    });

    // ── Notifications ────────────────────────────
    _socket.on('notification:new', (notif) => {
      _emit('notification:new', notif);
      _handleNewNotification(notif);
    });

    // ── Order updates ────────────────────────────
    _socket.on('order:status', (data) => {
      _emit('order:status', data);
      _handleOrderUpdate(data);
    });

    // ── Live stream ──────────────────────────────
    _socket.on('stream:viewer-count', (data) => {
      _emit('stream:viewer-count', data);
      _updateViewerCount(data.count);
    });

    _socket.on('stream:comment', (data) => {
      _emit('stream:comment', data);
      _appendStreamComment(data);
    });

    return _socket;
  }

  function disconnect() {
    if (_socket) {
      _socket.disconnect();
      _socket = null;
      _connected = false;
    }
  }

  function isConnected() { return _connected; }

  /* ─────────────────────────────────────────────
     CHAT
  ───────────────────────────────────────────── */
  function joinConversation(conversationId) {
    if (!_socket) return;
    _socket.emit('conversation:join', { conversationId });
  }

  function leaveConversation(conversationId) {
    if (!_socket) return;
    _socket.emit('conversation:leave', { conversationId });
  }

  function sendMessage(conversationId, content, type = 'text') {
    if (!_socket || !content.trim()) return;

    const tempId = `tmp_${Date.now()}`;
    const msg = {
      id: tempId,
      conversationId,
      content,
      type,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    _appendChatMessage(msg, true);

    _socket.emit('message:send', { conversationId, content, type }, (ack) => {
      if (ack && ack.id) {
        // Replace temp message with confirmed one
        const el = document.querySelector(`[data-message-id="${tempId}"]`);
        if (el) {
          el.dataset.messageId = ack.id;
          el.classList.remove('msg-sending');
          el.classList.add('msg-sent');
        }
      }
    });
  }

  function sendTyping(conversationId) {
    if (!_socket) return;
    _socket.emit('typing:start', { conversationId });

    clearTimeout(_typingTimers[conversationId]);
    _typingTimers[conversationId] = setTimeout(() => {
      _socket.emit('typing:stop', { conversationId });
    }, 2000);
  }

  function markMessagesRead(conversationId) {
    if (!_socket) return;
    _socket.emit('message:read', { conversationId });
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS — CHAT
  ───────────────────────────────────────────── */
  function _appendChatMessage(msg, isSelf) {
    const container = document.querySelector('[data-chat-messages]');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `chat-message ${isSelf ? 'chat-message--self' : 'chat-message--other'}`;
    el.dataset.messageId = msg.id;
    el.innerHTML = `
      <div class="chat-bubble">
        ${_escapeHTML(msg.content)}
        <span class="chat-time">${_formatTime(msg.createdAt)}</span>
        ${isSelf ? `<span class="chat-status msg-${msg.status}"></span>` : ''}
      </div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function _updateMessageStatus(messageId, status) {
    const el = document.querySelector(`[data-message-id="${messageId}"] .chat-status`);
    if (el) {
      el.className = `chat-status msg-${status}`;
    }
  }

  function _showTypingIndicator(conversationId, userName) {
    const id = `typing-${conversationId}`;
    if (document.getElementById(id)) return;

    const container = document.querySelector('[data-chat-messages]');
    if (!container) return;

    const el = document.createElement('div');
    el.id = id;
    el.className = 'chat-typing';
    el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>
                    <small>${_escapeHTML(userName || 'Someone')} is typing…</small>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function _hideTypingIndicator(conversationId) {
    const el = document.getElementById(`typing-${conversationId}`);
    if (el) el.remove();
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS — PRESENCE
  ───────────────────────────────────────────── */
  function _updateUserPresence(userId, isOnline) {
    document.querySelectorAll(`[data-user-id="${userId}"] .presence-dot`).forEach((dot) => {
      dot.classList.toggle('online', isOnline);
      dot.classList.toggle('offline', !isOnline);
      dot.setAttribute('title', isOnline ? 'Online' : 'Offline');
    });
  }

  function _updateOnlineIndicator(connected) {
    document.querySelectorAll('[data-realtime-status]').forEach((el) => {
      el.dataset.realtimeStatus = connected ? 'connected' : 'disconnected';
    });
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS — NOTIFICATIONS
  ───────────────────────────────────────────── */
  function _handleNewNotification(notif) {
    // Update badge count
    const badge = document.querySelector('.notif-badge, [data-notif-badge]');
    if (badge) {
      const count = (parseInt(badge.textContent, 10) || 0) + 1;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    }

    // Show toast
    if (window.GlobexSky && typeof window.GlobexSky.showToast === 'function') {
      window.GlobexSky.showToast(notif.title || 'New notification', 'info');
    }

    // Emit to notification module if available
    if (window.Notifications && typeof window.Notifications.prepend === 'function') {
      window.Notifications.prepend(notif);
    }
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS — ORDER UPDATES
  ───────────────────────────────────────────── */
  function _handleOrderUpdate(data) {
    const statusEl = document.querySelector(`[data-order-id="${data.orderId}"] .order-status`);
    if (statusEl) {
      statusEl.textContent = data.status;
      statusEl.dataset.status = data.status.toLowerCase().replace(/\s+/g, '-');
    }

    if (window.GlobexSky && typeof window.GlobexSky.showToast === 'function') {
      window.GlobexSky.showToast(`Order #${data.orderId} — ${data.status}`, 'info');
    }
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS — LIVE STREAM
  ───────────────────────────────────────────── */
  function joinStream(streamId) {
    if (!_socket) return;
    _socket.emit('stream:join', { streamId });
  }

  function leaveStream(streamId) {
    if (!_socket) return;
    _socket.emit('stream:leave', { streamId });
  }

  function sendStreamComment(streamId, comment) {
    if (!_socket || !comment.trim()) return;
    _socket.emit('stream:comment', { streamId, comment });
  }

  function _updateViewerCount(count) {
    const el = document.querySelector('[data-stream-viewers]');
    if (el) el.textContent = count.toLocaleString();
  }

  function _appendStreamComment(data) {
    const feed = document.querySelector('[data-stream-comments]');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = 'stream-comment';
    el.innerHTML = `<strong>${_escapeHTML(data.userName)}</strong> ${_escapeHTML(data.comment)}`;
    feed.prepend(el);
    // Keep only last 50 comments visible
    while (feed.children.length > 50) feed.lastChild.remove();
  }

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    connect,
    disconnect,
    isConnected,
    on,
    off,
    // Chat
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    markMessagesRead,
    // Stream
    joinStream,
    leaveStream,
    sendStreamComment,
  };
})();

window.Realtime = Realtime;
