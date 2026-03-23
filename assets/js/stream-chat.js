/**
 * Globex Sky – Stream Chat Module
 *
 * WebSocket-based real-time chat with:
 *   - Emoji reactions & quick reply buttons
 *   - Moderation tools: mute, ban, delete, slow mode
 *   - Basic profanity filter
 *   - Q&A mode
 *   - Pinned messages
 *
 * Exposes window.StreamChat.
 *
 * Usage:
 *   StreamChat.init({ streamId, authToken, role: 'host'|'moderator'|'viewer' });
 *   StreamChat.send(message);
 *   StreamChat.pinMessage(messageId);
 *   StreamChat.enableQAMode();
 *   StreamChat.enableSlowMode(seconds);
 *   StreamChat.destroy();
 */

(function () {
  'use strict';

  /* ── Profanity list (minimal, extensible) ─────────────────────────── */
  const BLOCKED_WORDS = ['spam', 'scam', 'phishing'];

  /* ── State ──────────────────────────────────────────────────────────── */
  let _socket       = null;
  let _streamId     = null;
  let _authToken    = null;
  let _role         = 'viewer';
  let _pinnedMsg    = null;
  let _qaMode       = false;
  let _slowMode     = 0;       // seconds; 0 = disabled
  let _lastSentAt   = 0;
  let _mutedUsers   = new Set();
  let _bannedUsers  = new Set();
  let _messageIndex = new Map(); // messageId -> DOM element
  let _reconnectAttempts = 0;
  let _reconnectTimer    = null;
  const MAX_RECONNECT    = 5;

  /* ── DOM helpers ─────────────────────────────────────────────────── */
  function qs(id)       { return document.getElementById(id); }
  function qsel(sel)    { return document.querySelector(sel); }

  function getChatMessages() {
    return qs('chatMessages') || qs('chatArea') || qsel('.chat-messages');
  }

  /* ── Profanity filter ────────────────────────────────────────────── */
  function _filterProfanity(text) {
    let cleaned = text;
    BLOCKED_WORDS.forEach(word => {
      const re = new RegExp(word, 'gi');
      cleaned = cleaned.replace(re, '*'.repeat(word.length));
    });
    return cleaned;
  }

  /* ── Build chat message element ──────────────────────────────────── */
  function _buildMsgEl(data) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.msgId  = data.id || '';
    div.dataset.userId = data.user_id || '';

    const isHost = data.role === 'host';
    const isMod  = data.role === 'moderator';
    const initial = (data.username || '?')[0].toUpperCase();
    const avatarClass = isHost ? 'host' : isMod ? 'mod' : '';
    const nameClass   = isHost ? 'host' : isMod ? 'mod' : '';

    const text = _filterProfanity(data.message || data.text || '');

    div.innerHTML = `
      <div class="chat-avatar ${avatarClass}" title="${data.username || ''}">${initial}</div>
      <div class="chat-bubble">
        <div class="chat-username ${nameClass}">${data.username || 'User'}${isHost ? ' 🎬' : isMod ? ' 🛡️' : ''}</div>
        <div class="chat-text" id="chat-text-${data.id || ''}"></div>
      </div>`;

    // Set text content safely (prevents XSS)
    const textEl = div.querySelector('.chat-text');
    if (textEl) textEl.textContent = text;

    // Context menu on right-click (mod/host only)
    if (_role === 'host' || _role === 'moderator') {
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showContextMenu(e.pageX, e.pageY, data);
      });
      div.title = 'Right-click to moderate';
    }

    return div;
  }

  /* ── Append message to chat ──────────────────────────────────────── */
  function _appendMessage(data) {
    if (_mutedUsers.has(data.user_id)) return;
    if (_bannedUsers.has(data.user_id)) return;

    const container = getChatMessages();
    if (!container) return;

    const el = _buildMsgEl(data);
    if (data.id) _messageIndex.set(data.id, el);

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  /* ── System notice ───────────────────────────────────────────────── */
  function _appendSystem(text) {
    const container = getChatMessages();
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-system';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /* ── Pin banner ──────────────────────────────────────────────────── */
  function _renderPinBanner(msgData) {
    let banner = qs('chatPinnedBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'chatPinnedBanner';
      banner.className = 'chat-pinned-msg';
      const messages = getChatMessages();
      if (messages && messages.parentNode) {
        messages.parentNode.insertBefore(banner, messages);
      }
    }

    if (!msgData) { banner.style.display = 'none'; return; }

    const text = _filterProfanity(msgData.message || msgData.text || '');
    banner.style.display = 'flex';
    banner.innerHTML = `
      <i class="fas fa-thumbtack"></i>
      <span><strong>${msgData.username || 'User'}:</strong> </span>
      <button class="chat-pinned-close" onclick="StreamChat.unpinMessage()" title="Unpin">
        <i class="fas fa-times"></i>
      </button>`;
    // Insert text safely
    const span = banner.querySelector('span');
    if (span) span.appendChild(document.createTextNode(text));
  }

  /* ── Context menu (moderation) ───────────────────────────────────── */
  function _closeContextMenu() {
    const old = qs('chatCtxMenu');
    if (old) old.remove();
  }

  function _showContextMenu(x, y, msgData) {
    _closeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'chatCtxMenu';
    menu.className = 'chat-ctx-menu';

    const items = [
      { icon: 'thumbtack', label: 'Pin message',   action: () => StreamChat.pinMessage(msgData) },
      { icon: 'volume-mute', label: 'Mute user',  action: () => StreamChat.muteUser(msgData.user_id, msgData.username) },
      { icon: 'trash-alt',  label: 'Delete message', action: () => StreamChat.deleteMessage(msgData.id), cls: 'danger' },
      { icon: 'ban',        label: 'Ban user',      action: () => StreamChat.banUser(msgData.user_id, msgData.username), cls: 'danger' },
    ];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'chat-ctx-item' + (item.cls ? ' ' + item.cls : '');
      el.innerHTML = `<i class="fas fa-${item.icon}"></i> ${item.label}`;
      el.onclick = () => { item.action(); _closeContextMenu(); };
      menu.appendChild(el);
    });

    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    document.body.appendChild(menu);
    document.addEventListener('click', _closeContextMenu, { once: true });
  }

  /* ── WebSocket connection ─────────────────────────────────────────── */
  function _connect() {
    if (!_streamId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/livestreams/${_streamId}/chat` +
                  (_authToken ? `?token=${encodeURIComponent(_authToken)}` : '');

    try {
      _socket = new WebSocket(wsUrl);
    } catch (e) {
      console.warn('[StreamChat] WebSocket unavailable, polling mode.');
      _startPolling();
      return;
    }

    _socket.onopen = () => {
      _reconnectAttempts = 0;
      _appendSystem('Connected to chat');
    };

    _socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        StreamChat._handleServerMessage(data);
      } catch (e) { /* ignore malformed */ }
    };

    _socket.onclose = () => {
      if (_reconnectAttempts < MAX_RECONNECT) {
        _reconnectAttempts++;
        const delay = Math.min(1000 * _reconnectAttempts, 8000);
        _reconnectTimer = setTimeout(_connect, delay);
        _appendSystem(`Reconnecting… (${_reconnectAttempts}/${MAX_RECONNECT})`);
      } else {
        _appendSystem('Chat disconnected. Please refresh.');
      }
    };

    _socket.onerror = () => { /* handled via onclose */ };
  }

  /* ── HTTP polling fallback ────────────────────────────────────────── */
  let _pollTimer = null;
  let _lastPollTs = 0;

  function _startPolling() {
    _pollTimer = setInterval(async () => {
      try {
        const url = `/api/v1/livestreams/${_streamId}/chat?since=${_lastPollTs}`;
        const res = await fetch(url, _authToken ? { headers: { Authorization: `Bearer ${_authToken}` } } : {});
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          json.data.forEach(msg => {
            _appendMessage(msg);
            if (msg.timestamp) _lastPollTs = msg.timestamp;
          });
        }
      } catch (e) { /* silent */ }
    }, 3000);
  }

  /* ── Slow mode guard ─────────────────────────────────────────────── */
  function _canSend() {
    if (_slowMode <= 0) return true;
    const now = Date.now();
    if (now - _lastSentAt < _slowMode * 1000) {
      const wait = Math.ceil(_slowMode - (now - _lastSentAt) / 1000);
      _appendSystem(`⏱ Slow mode: wait ${wait}s`);
      return false;
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════════ */

  const StreamChat = {

    /**
     * Initialize chat module.
     * @param {Object} opts
     * @param {string}   opts.streamId
     * @param {string}   [opts.authToken]
     * @param {string}   [opts.role] – 'host'|'moderator'|'viewer'
     */
    init(opts = {}) {
      _streamId  = opts.streamId  || null;
      _authToken = opts.authToken || null;
      _role      = opts.role      || 'viewer';
      _mutedUsers.clear();
      _bannedUsers.clear();
      _messageIndex.clear();
      _reconnectAttempts = 0;

      _connect();
      this._bindInputEvents();
      this._updateModeUI();
    },

    /* ── Message sending ─────────────────────────────────────────────── */

    /**
     * Send a chat message.
     * @param {string} text
     */
    async send(text) {
      const msg = (text || '').trim();
      if (!msg) return;
      if (!_canSend()) return;

      const filtered = _filterProfanity(msg);

      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'chat', message: filtered }));
      } else {
        // REST fallback
        if (!_authToken) { _appendSystem('Please log in to chat.'); return; }
        await fetch(`/api/v1/livestreams/${_streamId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${_authToken}`,
          },
          body: JSON.stringify({ message: filtered }),
        });
      }

      _lastSentAt = Date.now();

      // Optimistic UI
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      _appendMessage({
        id: 'local-' + Date.now(),
        user_id: user.id,
        username: user.name || user.company_name || 'You',
        message: filtered,
        role: _role,
      });

      const inputEl = qs('chatInput') || qsel('.chat-text-input');
      if (inputEl) inputEl.value = '';
    },

    /* ── Q&A mode ────────────────────────────────────────────────────── */

    enableQAMode() {
      _qaMode = true;
      this._updateModeUI();
      _appendSystem('Q&A mode enabled. Ask your questions!');
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'mode', mode: 'qa' }));
      }
    },

    disableQAMode() {
      _qaMode = false;
      this._updateModeUI();
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'mode', mode: 'normal' }));
      }
    },

    /* ── Slow mode ────────────────────────────────────────────────────── */

    enableSlowMode(seconds = 10) {
      _slowMode = seconds;
      this._updateModeUI();
      _appendSystem(`Slow mode enabled: ${seconds}s between messages`);
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'slow_mode', seconds }));
      }
    },

    disableSlowMode() {
      _slowMode = 0;
      this._updateModeUI();
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'slow_mode', seconds: 0 }));
      }
    },

    /* ── Pinning ──────────────────────────────────────────────────────── */

    pinMessage(msgData) {
      _pinnedMsg = msgData;
      _renderPinBanner(msgData);
      _appendSystem(`📌 ${msgData.username || 'A message'} was pinned`);
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'pin', message_id: msgData.id }));
      }
    },

    unpinMessage() {
      _pinnedMsg = null;
      _renderPinBanner(null);
    },

    /* ── Moderation ───────────────────────────────────────────────────── */

    muteUser(userId, username) {
      if (!userId) return;
      _mutedUsers.add(userId);
      _appendSystem(`🔇 ${username || 'User'} was muted`);
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'mute', user_id: userId }));
      }
    },

    unmuteUser(userId) {
      _mutedUsers.delete(userId);
    },

    banUser(userId, username) {
      if (!userId) return;
      _bannedUsers.add(userId);
      _appendSystem(`🚫 ${username || 'User'} was banned from chat`);
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'ban', user_id: userId }));
      }
    },

    deleteMessage(messageId) {
      if (!messageId) return;
      const el = _messageIndex.get(messageId);
      if (el) el.remove();
      if (_socket && _socket.readyState === WebSocket.OPEN) {
        _socket.send(JSON.stringify({ type: 'delete', message_id: messageId }));
      }
    },

    /* ── Reactions ────────────────────────────────────────────────────── */

    sendEmoji(emoji) {
      this.send(emoji);
    },

    /* ── Server message handler ────────────────────────────────────────── */

    _handleServerMessage(data) {
      switch (data.type) {
        case 'chat':
          _appendMessage(data);
          break;
        case 'pin':
          if (data.message) {
            _pinnedMsg = data.message;
            _renderPinBanner(data.message);
          }
          break;
        case 'delete':
          if (data.message_id) {
            const el = _messageIndex.get(data.message_id);
            if (el) el.remove();
          }
          break;
        case 'mute':
          if (data.user_id) _mutedUsers.add(data.user_id);
          break;
        case 'ban':
          if (data.user_id) _bannedUsers.add(data.user_id);
          break;
        case 'mode':
          _qaMode   = data.mode === 'qa';
          _slowMode = data.slow_mode || 0;
          this._updateModeUI();
          break;
        case 'system':
          _appendSystem(data.message);
          break;
        default:
          break;
      }
    },

    /* ── UI helpers ──────────────────────────────────────────────────── */

    _updateModeUI() {
      const badge = qs('chatModeBadge');
      if (badge) {
        if (_qaMode) {
          badge.style.display = '';
          badge.textContent = 'Q&A';
          badge.className = 'chat-mode-badge qa';
        } else if (_slowMode > 0) {
          badge.style.display = '';
          badge.textContent = `Slow ${_slowMode}s`;
          badge.className = 'chat-mode-badge slow';
        } else {
          badge.style.display = 'none';
        }
      }

      const slowBanner = qs('slowModeBanner');
      if (slowBanner) {
        slowBanner.style.display = _slowMode > 0 ? '' : 'none';
        if (_slowMode > 0) slowBanner.textContent = `⏱ Slow mode: ${_slowMode}s between messages`;
      }
    },

    _bindInputEvents() {
      const inputEl = qs('chatInput') || qsel('.chat-text-input');
      if (inputEl) {
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            StreamChat.send(inputEl.value);
          }
        });
      }
    },

    /* ── Cleanup ──────────────────────────────────────────────────────── */

    destroy() {
      if (_reconnectTimer) clearTimeout(_reconnectTimer);
      if (_pollTimer) clearInterval(_pollTimer);
      if (_socket) { _socket.onclose = null; _socket.close(); _socket = null; }
      _messageIndex.clear();
    },

    /* ── Getters ──────────────────────────────────────────────────────── */
    get isQAMode()    { return _qaMode; },
    get slowMode()    { return _slowMode; },
    get pinnedMsg()   { return _pinnedMsg; },
    get mutedUsers()  { return Array.from(_mutedUsers); },
    get bannedUsers() { return Array.from(_bannedUsers); },
  };

  window.StreamChat = StreamChat;
}());
