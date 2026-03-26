/**
 * Globex Sky — Chat Widget
 * Floating chat bubble (bottom-right) with mini-chat window.
 * Auto-connects via Socket.IO, shows unread count badge, recent conversations,
 * and allows quick replies without leaving the current page.
 */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const API = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';
  const WS_URL = (window.GlobexConfig && window.GlobexConfig.WS_URL) || window.location.origin;
  const CHAT_PAGE = (window.GlobexConfig && window.GlobexConfig.CHAT_PAGE) || '/pages/communication/chat.html';
  const NOTIF_SOUND_URL = (window.GlobexConfig && window.GlobexConfig.CHAT_SOUND) || null;

  // ── State ──────────────────────────────────────────────────────────────────
  let isOpen = false;
  let conversations = [];
  let activeConvId = null;
  let unreadTotal = 0;
  let socket = null;
  let notifAudio = null;

  if (NOTIF_SOUND_URL) {
    notifAudio = new Audio(NOTIF_SOUND_URL);
    notifAudio.volume = 0.4;
  }

  // ── Auth helpers ───────────────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() };
  }

  function getCurrentUserId() {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.id || null;
    } catch (e) { return null; }
  }

  // ── DOM builder ────────────────────────────────────────────────────────────
  function buildWidget() {
    // Bubble
    const bubble = document.createElement('button');
    bubble.className = 'chat-widget-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.setAttribute('title', 'Messages');
    bubble.innerHTML = '<i class="fas fa-comments"></i><span class="chat-widget-badge" id="chatWidgetBadge"></span>';

    // Window
    const win = document.createElement('div');
    win.className = 'chat-widget-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Chat window');
    win.innerHTML = `
      <div class="chat-widget-header">
        <i class="fas fa-comments" style="opacity:.8;"></i>
        <span class="chat-widget-header-title">Messages</span>
        <div class="chat-widget-header-actions">
          <button id="chatWidgetMaxBtn" title="Open full chat" aria-label="Open full chat">
            <i class="fas fa-expand-alt"></i>
          </button>
          <button id="chatWidgetCloseBtn" title="Close" aria-label="Close chat">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="chat-widget-conv-list" id="chatWidgetConvList">
        <div class="chat-widget-empty">
          <i class="fas fa-comments"></i>
          <span>Loading conversations…</span>
        </div>
      </div>
      <div class="chat-widget-quick-reply" id="chatWidgetQuickReply" style="display:none;">
        <input type="text" id="chatWidgetInput" placeholder="Quick reply…" autocomplete="off" maxlength="500"/>
        <button id="chatWidgetSendBtn" aria-label="Send message">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
      <div class="chat-widget-footer">
        <a href="${CHAT_PAGE}" id="chatWidgetFullLink">Open full chat <i class="fas fa-arrow-right"></i></a>
      </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(win);
    return { bubble, win };
  }

  // ── Render conversations ───────────────────────────────────────────────────
  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function getConvName(conv) {
    if (conv.name) return conv.name;
    if (conv.participants && conv.participants.length) {
      return conv.participants.map(p => p.full_name || 'User').join(', ');
    }
    return 'Conversation';
  }

  function getInitials(name) {
    return (name || 'U').split(' ').map(n => n[0] || '').slice(0, 2).join('').toUpperCase() || 'U';
  }

  function renderConversations() {
    const listEl = document.getElementById('chatWidgetConvList');
    const quickReply = document.getElementById('chatWidgetQuickReply');
    if (!listEl) return;

    if (!conversations.length) {
      listEl.innerHTML = `
        <div class="chat-widget-empty">
          <i class="fas fa-comments"></i>
          <span>No conversations yet.<br>
          <a href="${CHAT_PAGE}" style="color:#0052CC;">Start one →</a></span>
        </div>`;
      if (quickReply) quickReply.style.display = 'none';
      return;
    }

    const currentUserId = getCurrentUserId();

    listEl.innerHTML = conversations.slice(0, 6).map(conv => {
      const name = getConvName(conv);
      const initials = getInitials(name);
      const preview = conv.last_message
        ? (conv.last_message.content || (conv.last_message.type === 'image' ? '📷 Image' : '📎 File'))
        : 'No messages yet';
      const time = conv.last_activity || (conv.last_message && conv.last_message.created_at) || '';
      const isActive = conv.id === activeConvId;

      // Determine the other participant's user ID for the online dot
      const participantIds = conv.participant_ids || [];
      const otherUserId = participantIds.find(id => id !== currentUserId) ||
        (conv.buyer_id !== currentUserId ? conv.buyer_id : conv.supplier_id) || '';

      return `
        <div class="chat-widget-conv-item${isActive ? ' active' : ''}" data-conv-id="${esc(conv.id)}" tabindex="0" role="button" aria-label="Open conversation with ${esc(name)}">
          <div class="chat-widget-conv-avatar-wrap">
            <div class="chat-widget-conv-avatar">${esc(initials)}</div>
            <span class="chat-widget-online-dot" id="wdot_${esc(otherUserId)}"></span>
          </div>
          <div class="chat-widget-conv-meta">
            <div class="chat-widget-conv-name">${esc(name)}</div>
            <div class="chat-widget-conv-preview">${esc(preview)}</div>
          </div>
          <div class="chat-widget-conv-time">${esc(formatTime(time))}</div>
        </div>`;
    }).join('');

    // Attach click handlers
    listEl.querySelectorAll('.chat-widget-conv-item').forEach(item => {
      item.addEventListener('click', () => selectConversation(item.dataset.convId));
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectConversation(item.dataset.convId); });
    });
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Select a conversation for quick reply ──────────────────────────────────
  function selectConversation(convId) {
    activeConvId = convId;
    const quickReply = document.getElementById('chatWidgetQuickReply');
    if (quickReply) quickReply.style.display = 'flex';

    // Join socket room
    if (socket && socket.connected) {
      socket.emit('conversation:join', { conversationId: convId });
    }

    renderConversations();
    const input = document.getElementById('chatWidgetInput');
    if (input) input.focus();
  }

  // ── Send quick reply ───────────────────────────────────────────────────────
  async function sendQuickReply() {
    const input = document.getElementById('chatWidgetInput');
    if (!input || !activeConvId) return;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';

    // Optimistic: emit via socket if connected, fall back to REST
    if (socket && socket.connected) {
      socket.emit('message:send', { conversationId: activeConvId, content, type: 'text' });
    } else {
      try {
        await fetch(`${API}/chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ content, type: 'text' }),
        });
      } catch (e) { /* silent */ }
    }
  }

  // ── Badge ──────────────────────────────────────────────────────────────────
  function updateBadge(count) {
    unreadTotal = Math.max(0, count);
    const badge = document.getElementById('chatWidgetBadge');
    if (!badge) return;
    if (unreadTotal > 0) {
      badge.textContent = unreadTotal > 99 ? '99+' : String(unreadTotal);
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    const win = document.querySelector('.chat-widget-window');
    if (win) win.classList.add('open');
    fetchConversations();
  }

  function closeWidget() {
    isOpen = false;
    const win = document.querySelector('.chat-widget-window');
    if (win) win.classList.remove('open');
    activeConvId = null;
    const quickReply = document.getElementById('chatWidgetQuickReply');
    if (quickReply) quickReply.style.display = 'none';
  }

  function toggleWidget() {
    isOpen ? closeWidget() : openWidget();
  }

  // ── Fetch conversations ────────────────────────────────────────────────────
  async function fetchConversations() {
    const token = getToken();
    if (!token) {
      const listEl = document.getElementById('chatWidgetConvList');
      if (listEl) {
        listEl.innerHTML = `<div class="chat-widget-empty"><i class="fas fa-lock"></i><span>Please <a href="/pages/auth/login.html" style="color:#0052CC;">sign in</a> to chat.</span></div>`;
      }
      return;
    }
    try {
      const res = await fetch(`${API}/chat/conversations`, { headers: authHeaders() });
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      conversations = json.data || [];
      renderConversations();
      // Calculate unread total
      const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      updateBadge(total);
    } catch (e) {
      const listEl = document.getElementById('chatWidgetConvList');
      if (listEl) listEl.innerHTML = `<div class="chat-widget-empty"><i class="fas fa-exclamation-circle"></i><span>Could not load conversations.</span></div>`;
    }
  }

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  function connectSocket() {
    const token = getToken();
    if (!token) return;
    if (typeof io === 'undefined') return; // Socket.IO not loaded

    try {
      socket = io(`${WS_URL}/chat`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        // Re-join active room if any
        if (activeConvId) {
          socket.emit('conversation:join', { conversationId: activeConvId });
        }
      });

      socket.on('message:new', (message) => {
        const userId = getCurrentUserId();
        if (message.sender_id === userId) return; // own message

        // Update conversation preview
        const conv = conversations.find(c => c.id === message.conversation_id);
        if (conv) {
          conv.last_message = { content: message.content, type: message.type, created_at: message.created_at };
          conv.last_activity = message.created_at;
          if (!isOpen || activeConvId !== message.conversation_id) {
            conv.unread_count = (conv.unread_count || 0) + 1;
          }
        }
        if (isOpen) renderConversations();

        // Update badge
        const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        updateBadge(total);

        // Play notification sound
        if (notifAudio) {
          notifAudio.currentTime = 0;
          notifAudio.play().catch(() => {});
        }
      });

      socket.on('user:online', ({ userId }) => {
        const dot = document.getElementById(`wdot_${userId}`);
        if (dot) dot.classList.add('online');
      });

      socket.on('user:offline', ({ userId }) => {
        const dot = document.getElementById(`wdot_${userId}`);
        if (dot) dot.classList.remove('online');
      });
    } catch (e) { /* silent — widget is optional */ }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    const { bubble, win } = buildWidget();

    bubble.addEventListener('click', toggleWidget);

    const closeBtn = document.getElementById('chatWidgetCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeWidget(); });

    const maxBtn = document.getElementById('chatWidgetMaxBtn');
    if (maxBtn) maxBtn.addEventListener('click', () => { window.location.href = CHAT_PAGE; });

    const sendBtn = document.getElementById('chatWidgetSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendQuickReply);

    const input = document.getElementById('chatWidgetInput');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuickReply(); }
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && !win.contains(e.target) && !bubble.contains(e.target)) closeWidget();
    });

    // Connect WebSocket
    connectSocket();

    // Periodic badge refresh (every 60s)
    setInterval(fetchConversations, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.GlobexChatWidget = {
    open: openWidget,
    close: closeWidget,
    toggle: toggleWidget,
    openConversation: selectConversation,
    refresh: fetchConversations,
  };
}());
