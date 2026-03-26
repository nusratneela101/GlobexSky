/**
 * Globex Sky — Chat Frontend
 * Handles real-time chat UI: conversations, messages, send, read receipts, emoji.
 * Uses Socket.IO for real-time messaging when available, falls back to polling.
 */
(function () {
  'use strict';

  const API = (window.GlobexConfig && window.GlobexConfig.API_BASE) || '/api/v1';
  const WS_URL = (window.GlobexConfig && window.GlobexConfig.WS_URL) || window.location.origin;

  /* ── State ──────────────────────────────────────────────────────────────── */
  let conversations = [];
  let activeConversationId = null;
  let currentUser = null;
  let typingTimeout = null;
  let pollInterval = null;
  let lastMessageCount = 0;
  let socket = null;
  let socketConnected = false;
  let typingTimer = null;

  /* ── DOM Refs ───────────────────────────────────────────────────────────── */
  const convListEl    = document.getElementById('conversationList');
  const messagesEl    = document.getElementById('messagesArea');
  const chatWindowEl  = document.getElementById('chatWindow');
  const emptyStateEl  = document.getElementById('chatEmptyState');
  const chatTextarea  = document.getElementById('chatTextarea');
  const sendBtn       = document.getElementById('sendBtn');
  const chatHeaderEl  = document.getElementById('chatHeader');
  const searchInput   = document.getElementById('convSearch');
  const emojiBtn      = document.getElementById('emojiBtn');
  const emojiPicker   = document.getElementById('emojiPicker');
  const typingEl      = document.getElementById('typingIndicator');
  const translateToggle = document.getElementById('translateToggle');
  const newChatBtn    = document.getElementById('newChatBtn');

  /* ── Auth helper ────────────────────────────────────────────────────────── */
  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() };
  }

  /* ── LocalStorage demo / offline cache ─────────────────────────────────── */
  const LS_CONVS_KEY = 'globex_chat_conversations';
  const LS_MSGS_PREFIX = 'globex_chat_messages_';
  const DEMO_USER_ID = 'demo-user-001';

  /** Seed demo conversations + messages when localStorage is empty. */
  function seedDemoData() {
    const now = new Date();
    const ts = (offsetMinutes) => {
      const d = new Date(now - offsetMinutes * 60 * 1000);
      return d.toISOString();
    };

    const convs = [
      {
        id: 'demo-conv-001',
        participant_ids: [DEMO_USER_ID, 'demo-supplier-001'],
        type: 'buyer_supplier',
        name: 'Sunrise Electronics',
        last_message: 'Sure, I can arrange a sample shipment.',
        last_message_at: ts(5),
        unread_count: 2,
        participants: [{ id: 'demo-supplier-001', full_name: 'Sunrise Electronics', avatar_url: null }],
      },
      {
        id: 'demo-conv-002',
        participant_ids: [DEMO_USER_ID, 'demo-supplier-002'],
        type: 'buyer_supplier',
        name: 'Global Parts Ltd.',
        last_message: 'The order has been dispatched.',
        last_message_at: ts(90),
        unread_count: 0,
        participants: [{ id: 'demo-supplier-002', full_name: 'Global Parts Ltd.', avatar_url: null }],
      },
      {
        id: 'demo-conv-003',
        participant_ids: [DEMO_USER_ID, 'demo-supplier-003'],
        type: 'buyer_supplier',
        name: 'Pacific Textiles',
        last_message: 'Please review the attached catalogue.',
        last_message_at: ts(1440),
        unread_count: 1,
        participants: [{ id: 'demo-supplier-003', full_name: 'Pacific Textiles', avatar_url: null }],
      },
    ];

    const msgs001 = [
      { id: 'dm-001-1', conversation_id: 'demo-conv-001', sender_id: 'demo-supplier-001', content: 'Hello! I saw your RFQ for industrial LEDs. We can supply in bulk.', type: 'text', created_at: ts(60), read_at: ts(58), sender: { full_name: 'Sunrise Electronics' } },
      { id: 'dm-001-2', conversation_id: 'demo-conv-001', sender_id: DEMO_USER_ID, content: 'Great! What is the MOQ and lead time?', type: 'text', created_at: ts(55), read_at: ts(54), sender: { full_name: 'Me' } },
      { id: 'dm-001-3', conversation_id: 'demo-conv-001', sender_id: 'demo-supplier-001', content: 'MOQ is 500 units. Lead time is 2 weeks for standard orders.', type: 'text', created_at: ts(50), read_at: ts(49), sender: { full_name: 'Sunrise Electronics' } },
      { id: 'dm-001-4', conversation_id: 'demo-conv-001', sender_id: DEMO_USER_ID, content: 'Can you send a sample first?', type: 'text', created_at: ts(10), read_at: null, sender: { full_name: 'Me' } },
      { id: 'dm-001-5', conversation_id: 'demo-conv-001', sender_id: 'demo-supplier-001', content: 'Sure, I can arrange a sample shipment.', type: 'text', created_at: ts(5), read_at: null, sender: { full_name: 'Sunrise Electronics' } },
    ];

    const msgs002 = [
      { id: 'dm-002-1', conversation_id: 'demo-conv-002', sender_id: DEMO_USER_ID, content: 'Hi, just checking on order #PO-2024-887.', type: 'text', created_at: ts(120), read_at: ts(118), sender: { full_name: 'Me' } },
      { id: 'dm-002-2', conversation_id: 'demo-conv-002', sender_id: 'demo-supplier-002', content: 'The order has been dispatched.', type: 'text', created_at: ts(90), read_at: ts(88), sender: { full_name: 'Global Parts Ltd.' } },
    ];

    const msgs003 = [
      { id: 'dm-003-1', conversation_id: 'demo-conv-003', sender_id: 'demo-supplier-003', content: 'Please review the attached catalogue.', type: 'text', created_at: ts(1440), read_at: null, sender: { full_name: 'Pacific Textiles' } },
    ];

    localStorage.setItem(LS_CONVS_KEY, JSON.stringify(convs));
    localStorage.setItem(LS_MSGS_PREFIX + 'demo-conv-001', JSON.stringify(msgs001));
    localStorage.setItem(LS_MSGS_PREFIX + 'demo-conv-002', JSON.stringify(msgs002));
    localStorage.setItem(LS_MSGS_PREFIX + 'demo-conv-003', JSON.stringify(msgs003));
  }

  /** Load conversations from localStorage. Seeds demo data on first run. */
  function lsGetConversations() {
    let raw = localStorage.getItem(LS_CONVS_KEY);
    if (!raw) { seedDemoData(); raw = localStorage.getItem(LS_CONVS_KEY); }
    try { return JSON.parse(raw) || []; } catch (e) { return []; }
  }

  /** Load messages for a conversation from localStorage. */
  function lsGetMessages(convId) {
    try { return JSON.parse(localStorage.getItem(LS_MSGS_PREFIX + convId)) || []; } catch (e) { return []; }
  }

  /** Save messages for a conversation to localStorage. */
  function lsSaveMessages(convId, msgs) {
    localStorage.setItem(LS_MSGS_PREFIX + convId, JSON.stringify(msgs));
  }

  /** Append a new message to localStorage and update conversation preview. */
  function lsAppendMessage(msg) {
    const msgs = lsGetMessages(msg.conversation_id);
    msgs.push(msg);
    lsSaveMessages(msg.conversation_id, msgs);

    const convs = lsGetConversations();
    const conv = convs.find(c => c.id === msg.conversation_id);
    if (conv) {
      conv.last_message = msg.content;
      conv.last_message_at = msg.created_at;
      if (msg.sender_id !== getEffectiveUserId()) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
      localStorage.setItem(LS_CONVS_KEY, JSON.stringify(convs));
    }
  }

  /** Mark all messages in a conversation as read in localStorage. */
  function lsMarkRead(convId) {
    const convs = lsGetConversations();
    const conv = convs.find(c => c.id === convId);
    if (conv) { conv.unread_count = 0; localStorage.setItem(LS_CONVS_KEY, JSON.stringify(convs)); }
    const msgs = lsGetMessages(convId);
    msgs.forEach(m => { if (!m.read_at) m.read_at = new Date().toISOString(); });
    lsSaveMessages(convId, msgs);
  }

  /** Save a new conversation to localStorage. */
  function lsAddConversation(conv) {
    const convs = lsGetConversations();
    convs.unshift(conv);
    localStorage.setItem(LS_CONVS_KEY, JSON.stringify(convs));
  }

  /** Current user ID — real from JWT or demo fallback. */
  function getEffectiveUserId() {
    return getCurrentUserId() || DEMO_USER_ID;
  }

  /* ── Socket.IO real-time connection ─────────────────────────────────────── */
  function connectSocket() {
    if (typeof io === 'undefined') return; // Socket.IO not loaded — use polling
    const token = getToken();
    if (!token) return;

    try {
      socket = io(WS_URL + '/chat', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      socket.on('connect', () => {
        socketConnected = true;
        // Stop polling — real-time takes over
        clearInterval(pollInterval);
        pollInterval = null;
        // Re-join active conversation room if any
        if (activeConversationId) {
          socket.emit('conversation:join', { conversationId: activeConversationId });
        }
      });

      socket.on('disconnect', () => {
        socketConnected = false;
        // Fall back to polling if we have an active conversation
        if (activeConversationId && !pollInterval) {
          pollInterval = setInterval(() => fetchMessages(activeConversationId), 3000);
        }
      });

      socket.on('message:new', (message) => {
        // Skip own messages — shown optimistically on send
        if (message.sender_id === getCurrentUserId()) return;
        // Append new message to the active conversation without full reload
        if (message.conversation_id !== activeConversationId) {
          // Update unread badge for another conversation
          const conv = conversations.find(c => c.id === message.conversation_id);
          if (conv) {
            conv.unread_count = (conv.unread_count || 0) + 1;
            conv.last_message = message.content;
            conv.last_message_at = message.created_at;
            renderConversationList(conversations);
          }
          return;
        }
        // Append message directly to avoid full re-render
        appendNewMessage(message);
        markRead(activeConversationId);
      });

      socket.on('typing:start', ({ userId: typingUserId, conversationId }) => {
        if (conversationId !== activeConversationId) return;
        const conv = conversations.find(c => c.id === conversationId);
        const name = conv ? getConvName(conv) : 'Someone';
        if (typingEl) {
          const nameEl = document.getElementById('typingName');
          if (nameEl) nameEl.textContent = name + ' is typing…';
          typingEl.style.display = 'flex';
        }
      });

      socket.on('typing:stop', ({ conversationId }) => {
        if (conversationId !== activeConversationId) return;
        if (typingEl) typingEl.style.display = 'none';
      });

      socket.on('user:online', ({ userId }) => {
        updateOnlineStatus(userId, true);
      });

      socket.on('user:offline', ({ userId }) => {
        updateOnlineStatus(userId, false);
      });

      socket.on('messages:read', ({ conversationId, readBy }) => {
        if (conversationId === activeConversationId) {
          document.querySelectorAll('.msg-read-icon').forEach(el => el.classList.add('read'));
        }
      });

      socket.on('conversation:joined', ({ conversationId }) => {
        // Request online status for conversation partner (only if conversations loaded)
        const partnerIds = getConvPartnerIds(conversationId);
        if (socket && partnerIds.length > 0) {
          socket.emit('user:status', { userIds: partnerIds });
        }
      });

    } catch (e) {
      console.warn('Chat: Socket.IO connection failed', e);
    }
  }

  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
      socketConnected = false;
    }
  }

  function getConvPartnerIds(convId) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv || !conv.participant_ids) return [];
    const me = getEffectiveUserId();
    return conv.participant_ids.filter(id => id !== me);
  }

  function updateOnlineStatus(userId, online) {
    const conv = conversations.find(c => c.participant_ids && c.participant_ids.includes(userId));
    if (conv) {
      conv.is_online = online;
      renderConversationList(conversations);
      // Update header if this is the active conversation
      if (conv.id === activeConversationId && chatHeaderEl) {
        const dot = chatHeaderEl.querySelector('.dot');
        const statusText = chatHeaderEl.querySelector('#headerStatusText');
        if (dot) dot.className = 'dot' + (online ? '' : ' offline');
        if (statusText) statusText.textContent = online ? ' Online' : ' Offline';
      }
    }
  }

  /* ── Typing indicator emitter ───────────────────────────────────────────── */
  function emitTyping() {
    if (!socket || !socketConnected || !activeConversationId) return;
    socket.emit('typing:start', { conversationId: activeConversationId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (socket && socketConnected) {
        socket.emit('typing:stop', { conversationId: activeConversationId });
      }
    }, 2000);
  }

  /* ── API calls (with localStorage demo fallback) ───────────────────────── */
  async function fetchConversations() {
    const token = getToken();
    // No auth token → use localStorage demo data directly
    if (!token) {
      conversations = lsGetConversations();
      renderConversationList(conversations);
      return;
    }
    try {
      const res = await fetch(API + '/chat/conversations', { headers: authHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      conversations = json.data || [];
      renderConversationList(conversations);
    } catch (e) {
      console.warn('Chat: API unavailable, using localStorage demo data', e.message);
      conversations = lsGetConversations();
      renderConversationList(conversations);
    }
  }

  async function fetchMessages(convId) {
    const token = getToken();
    // No auth token → load from localStorage demo data
    if (!token) {
      const messages = lsGetMessages(convId);
      renderMessages(messages);
      if (messages.length !== lastMessageCount) {
        lastMessageCount = messages.length;
        scrollToBottom();
      }
      lsMarkRead(convId);
      return;
    }
    try {
      const res = await fetch(API + '/chat/conversations/' + convId + '/messages', { headers: authHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const messages = json.data || [];
      // Persist to localStorage as cache
      lsSaveMessages(convId, messages);
      renderMessages(messages);
      if (messages.length !== lastMessageCount) {
        lastMessageCount = messages.length;
        scrollToBottom();
      }
      markRead(convId);
    } catch (e) {
      console.warn('Chat: API unavailable, loading messages from localStorage', e.message);
      const messages = lsGetMessages(convId);
      renderMessages(messages);
      if (messages.length !== lastMessageCount) {
        lastMessageCount = messages.length;
        scrollToBottom();
      }
      lsMarkRead(convId);
    }
  }

  async function sendMessage(content, type) {
    type = type || 'text';
    if (!activeConversationId || !content.trim()) return;

    const userId = getEffectiveUserId();

    // If Socket.IO is connected, send via WebSocket for true real-time delivery
    if (socketConnected && socket) {
      // Optimistically show the message immediately
      const optimistic = {
        id: 'tmp_' + Date.now(),
        conversation_id: activeConversationId,
        sender_id: userId,
        content: content.trim(),
        type,
        created_at: new Date().toISOString(),
        sender: null,
      };
      appendNewMessage(optimistic);
      lsAppendMessage(optimistic);
      socket.emit('message:send', {
        conversationId: activeConversationId,
        content: content.trim(),
        type,
      }, (ack) => {
        // If server returns an error acknowledgment, fall back to REST API
        if (ack && ack.error) {
          console.warn('Chat: Socket.IO send failed, retrying via REST', ack.error);
          fetch(API + '/chat/conversations/' + activeConversationId + '/messages', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ content: content.trim(), type }),
          }).then(() => fetchMessages(activeConversationId)).catch(() => {});
        }
      });
      // Refresh conversations list to update preview
      fetchConversations();
      return;
    }

    const token = getToken();

    // Demo mode (no token) → save to localStorage only
    if (!token) {
      const msg = {
        id: 'local_' + Date.now(),
        conversation_id: activeConversationId,
        sender_id: userId,
        content: content.trim(),
        type,
        created_at: new Date().toISOString(),
        read_at: null,
        sender: { full_name: 'Me' },
      };
      lsAppendMessage(msg);
      appendNewMessage(msg);
      conversations = lsGetConversations();
      renderConversationList(conversations);
      return;
    }

    // Fallback: REST API
    try {
      const res = await fetch(API + '/chat/conversations/' + activeConversationId + '/messages', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: content.trim(), type }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await fetchMessages(activeConversationId);
      await fetchConversations();
    } catch (e) {
      console.warn('Chat: REST send failed, saving to localStorage', e.message);
      const msg = {
        id: 'local_' + Date.now(),
        conversation_id: activeConversationId,
        sender_id: userId,
        content: content.trim(),
        type,
        created_at: new Date().toISOString(),
        read_at: null,
        sender: { full_name: 'Me' },
      };
      lsAppendMessage(msg);
      appendNewMessage(msg);
      conversations = lsGetConversations();
      renderConversationList(conversations);
    }
  }

  async function markRead(convId) {
    lsMarkRead(convId);
    try {
      await fetch(API + '/chat/conversations/' + convId + '/read', {
        method: 'PATCH',
        headers: authHeaders(),
      });
    } catch (e) { /* silent */ }
  }

  async function createConversation(participantId) {
    const token = getToken();

    // Demo mode → create conversation in localStorage
    if (!token) {
      const existing = lsGetConversations().find(c => c.participant_ids.includes(participantId));
      if (existing) return existing;
      const conv = {
        id: 'local_conv_' + Date.now(),
        participant_ids: [DEMO_USER_ID, participantId],
        type: 'buyer_supplier',
        name: participantId,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        participants: [{ id: participantId, full_name: participantId, avatar_url: null }],
      };
      lsAddConversation(conv);
      return conv;
    }

    try {
      const res = await fetch(API + '/chat/conversations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ participant_id: participantId }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('Chat: createConversation API failed, using localStorage', e.message);
      const existing = lsGetConversations().find(c => c.participant_ids.includes(participantId));
      if (existing) return existing;
      const conv = {
        id: 'local_conv_' + Date.now(),
        participant_ids: [getEffectiveUserId(), participantId],
        type: 'buyer_supplier',
        name: participantId,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        participants: [{ id: participantId, full_name: participantId, avatar_url: null }],
      };
      lsAddConversation(conv);
      return conv;
    }
  }

  /* ── Render conversations ───────────────────────────────────────────────── */
  function renderConversationList(list) {
    if (!convListEl) return;
    if (!list.length) {
      convListEl.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.85rem;">No conversations yet.<br>Start a new chat below.</div>';
      return;
    }
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = q ? list.filter(c => {
      const name = getConvName(c).toLowerCase();
      return name.includes(q);
    }) : list;

    convListEl.innerHTML = filtered.map(conv => {
      const name = getConvName(conv);
      const initials = getInitials(name);
      const preview = conv.last_message || 'Start conversation…';
      const time = conv.last_message_at ? formatTime(conv.last_message_at) : '';
      const isActive = conv.id === activeConversationId;
      const unread = conv.unread_count || 0;
      return `<div class="conv-item${isActive ? ' active' : ''}${unread ? ' unread' : ''}" data-id="${conv.id}">
        <div class="conv-avatar">
          <div class="conv-avatar-initials">${initials}</div>
          <span class="online-dot${conv.is_online ? '' : ' offline-dot'}"></span>
        </div>
        <div class="conv-info">
          <div class="conv-name">${escHtml(name)}</div>
          <div class="conv-preview">${escHtml(preview)}</div>
        </div>
        <div class="conv-meta">
          <span class="conv-time">${time}</span>
          ${unread ? `<span class="conv-badge">${unread}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    convListEl.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', () => openConversation(el.dataset.id));
    });
  }

  /* ── Open conversation ──────────────────────────────────────────────────── */
  function openConversation(id) {
    activeConversationId = id;
    lastMessageCount = 0;
    const conv = conversations.find(c => c.id === id);

    // Show chat window, hide empty state
    if (chatWindowEl) chatWindowEl.style.display = 'flex';
    if (emptyStateEl) emptyStateEl.style.display = 'none';

    // Update header
    if (chatHeaderEl && conv) {
      const name = getConvName(conv);
      chatHeaderEl.querySelector('.chat-header-name').textContent = name;
      const statusEl = chatHeaderEl.querySelector('.chat-header-status');
      if (statusEl) {
        const dot = statusEl.querySelector('.dot');
        if (dot) dot.className = 'dot' + (conv.is_online ? '' : ' offline');
        statusEl.lastChild.textContent = conv.is_online ? ' Online' : ' Offline';
      }
    }

    // Highlight sidebar item
    renderConversationList(conversations);

    // Join Socket.IO room (real-time) or start polling (fallback)
    if (socketConnected && socket) {
      socket.emit('conversation:join', { conversationId: id });
      clearInterval(pollInterval);
      pollInterval = null;
    } else {
      clearInterval(pollInterval);
      pollInterval = setInterval(() => fetchMessages(id), 3000);
    }

    // Load initial messages
    fetchMessages(id);
  }

  /* ── Render messages ────────────────────────────────────────────────────── */
  function renderMessages(messages) {
    if (!messagesEl) return;
    if (!messages.length) {
      messagesEl.innerHTML = '<div class="msg-empty-placeholder" style="text-align:center;color:#94a3b8;font-size:.85rem;padding:40px;">No messages yet. Say hello!</div>';
      return;
    }

    const userId = getEffectiveUserId();
    let lastDay = null;
    const html = messages.map(msg => {
      const isOwn = msg.sender_id === userId;
      const day = formatDay(msg.created_at);
      let dayDiv = '';
      if (day !== lastDay) {
        dayDiv = `<div class="msg-day-divider"><span>${day}</span></div>`;
        lastDay = day;
      }
      const time = formatMsgTime(msg.created_at);
      const name = msg.sender ? (msg.sender.full_name || 'User') : 'User';
      const initials = getInitials(name);
      const readIcon = isOwn ? `<i class="fas fa-check-double msg-read-icon${msg.read_at ? ' read' : ''}"></i>` : '';

      let contentHtml;
      if (msg.type === 'image' && msg.file_url) {
        contentHtml = `<img src="${escHtml(msg.file_url)}" alt="Image" class="msg-image">`;
      } else if (msg.type === 'file' && msg.file_url) {
        contentHtml = `<div class="msg-file"><i class="fas fa-paperclip"></i><a href="${escHtml(msg.file_url)}" target="_blank" rel="noopener">${escHtml(msg.content)}</a></div>`;
      } else {
        const content = (translateToggle && translateToggle.checked && msg.translated_content) ? msg.translated_content : msg.content;
        contentHtml = escHtml(content);
      }

      return `${dayDiv}
        <div class="msg-wrapper${isOwn ? ' own' : ''}">
          ${!isOwn ? `<div class="msg-avatar">${escHtml(initials)}</div>` : ''}
          <div>
            <div class="msg-bubble">${contentHtml}</div>
            <div class="msg-time">${time}${readIcon}</div>
          </div>
          ${isOwn ? `<div class="msg-avatar">${escHtml(initials)}</div>` : ''}
        </div>`;
    }).join('');

    messagesEl.innerHTML = html;
  }

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── Append a single new message (real-time) ────────────────────────────── */
  function appendNewMessage(msg) {
    if (!messagesEl) return;
    // Remove "no messages" placeholder if present
    const placeholder = messagesEl.querySelector('.msg-empty-placeholder');
    if (placeholder) placeholder.remove();

    const userId = getEffectiveUserId();
    const isOwn = msg.sender_id === userId;
    const time = formatMsgTime(msg.created_at);
    const name = msg.sender ? (msg.sender.full_name || 'User') : 'User';
    const initials = getInitials(name);
    const readIcon = isOwn ? '<i class="fas fa-check-double msg-read-icon"></i>' : '';

    let contentHtml;
    if (msg.type === 'image' && msg.file_url) {
      contentHtml = `<img src="${escHtml(msg.file_url)}" alt="Image" class="msg-image">`;
    } else if (msg.type === 'file' && msg.file_url) {
      contentHtml = `<div class="msg-file"><i class="fas fa-paperclip"></i><a href="${escHtml(msg.file_url)}" target="_blank" rel="noopener">${escHtml(msg.content)}</a></div>`;
    } else {
      contentHtml = escHtml(msg.content);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'msg-wrapper' + (isOwn ? ' own' : '');
    wrapper.innerHTML = `
      ${!isOwn ? `<div class="msg-avatar">${escHtml(initials)}</div>` : ''}
      <div>
        <div class="msg-bubble">${contentHtml}</div>
        <div class="msg-time">${time}${readIcon}</div>
      </div>
      ${isOwn ? `<div class="msg-avatar">${escHtml(initials)}</div>` : ''}
    `;
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    lastMessageCount++;
  }

  /* ── Send button ────────────────────────────────────────────────────────── */
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
  }

  if (chatTextarea) {
    chatTextarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    chatTextarea.addEventListener('input', () => {
      autoResizeTextarea();
      emitTyping();
    });
  }

  function handleSend() {
    if (!chatTextarea || !chatTextarea.value.trim()) return;
    const content = chatTextarea.value.trim();
    chatTextarea.value = '';
    autoResizeTextarea();
    // Stop typing indicator
    if (socket && socketConnected && activeConversationId) {
      socket.emit('typing:stop', { conversationId: activeConversationId });
      clearTimeout(typingTimer);
    }
    sendMessage(content, 'text');
  }

  function autoResizeTextarea() {
    if (!chatTextarea) return;
    chatTextarea.style.height = 'auto';
    chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px';
  }

  /* ── Emoji picker ───────────────────────────────────────────────────────── */
  const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','👍','👎','❤️','🎉','🙏','💪','🔥','✅','⚠️','📦','🚀','💡','📊','🌏'];

  if (emojiPicker) {
    emojiPicker.innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
    emojiPicker.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (chatTextarea) {
          chatTextarea.value += btn.dataset.emoji;
          chatTextarea.focus();
        }
        emojiPicker.style.display = 'none';
      });
    });
  }

  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener('click', e => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid';
    });
    document.addEventListener('click', () => { emojiPicker.style.display = 'none'; });
    emojiPicker.addEventListener('click', e => e.stopPropagation());
  }

  /* ── Search conversations ───────────────────────────────────────────────── */
  if (searchInput) {
    searchInput.addEventListener('input', () => renderConversationList(conversations));
  }

  /* ── New chat modal ─────────────────────────────────────────────────────── */
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      const overlay = document.getElementById('newChatModal');
      if (overlay) overlay.classList.add('open');
    });
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('open');
    });
  });

  const startChatForm = document.getElementById('startChatForm');
  if (startChatForm) {
    startChatForm.addEventListener('submit', async e => {
      e.preventDefault();
      const idInput = document.getElementById('newChatParticipant');
      if (!idInput || !idInput.value.trim()) return;
      const conv = await createConversation(idInput.value.trim());
      if (conv) {
        await fetchConversations();
        openConversation(conv.id);
        const modal = startChatForm.closest('.modal-overlay');
        if (modal) modal.classList.remove('open');
        idInput.value = '';
      }
    });
  }

  /* ── File / image upload ────────────────────────────────────────────────── */
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file || !activeConversationId) return;
      await sendMessage(file.name, file.type.startsWith('image/') ? 'image' : 'file');
      fileInput.value = '';
    });
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function getConvName(conv) {
    if (conv.name) return conv.name;
    if (conv.participants && conv.participants.length) {
      return conv.participants.map(p => p.full_name || 'User').join(', ');
    }
    return 'Conversation';
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0] || '').slice(0, 2).join('').toUpperCase() || 'U';
  }

  function getCurrentUserId() {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.id || null;
    } catch (e) { return null; }
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return Math.floor(diffMs / 60000) + 'm';
    if (diffMs < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatMsgTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    fetchConversations();
    // Show empty state if no conversation selected
    if (chatWindowEl) chatWindowEl.style.display = 'none';
    if (emptyStateEl) emptyStateEl.style.display = 'flex';
    // Connect Socket.IO for real-time messaging
    connectSocket();
  }

  window.addEventListener('beforeunload', disconnectSocket);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use (e.g., open chat with specific user)
  window.GlobexChat = {
    open: openConversation,
    startWith: async function (userId) {
      const conv = await createConversation(userId);
      if (conv) { await fetchConversations(); openConversation(conv.id); }
    },
  };
}());
