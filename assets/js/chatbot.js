/**
 * GlobexSky — AI Chatbot Frontend Widget
 * Floating chat widget with real-time conversation, product suggestion cards,
 * quick replies, typing indicator, and localStorage history persistence.
 */

(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────────────────
  const API_BASE = '/api/v1/ai/chatbot';
  const STORAGE_KEY = 'globexsky_chat_history';
  const MAX_HISTORY = 50;
  const QUICK_REPLIES = [
    'Where is my order?',
    'Return policy',
    'Shipping time',
    'Payment help',
    'Speak to human',
  ];

  // ─── State ──────────────────────────────────────────────────────────────────
  let sessionId = null;
  let isOpen = false;
  let isTyping = false;
  let history = loadHistory();

  // ─── DOM helpers ────────────────────────────────────────────────────────────

  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  // ─── Build widget ────────────────────────────────────────────────────────────

  const widget = el(`
    <div id="gs-chat-widget" style="
      position:fixed;bottom:24px;right:24px;z-index:9999;
      font-family:'Inter',sans-serif;font-size:14px;">
      <!-- Toggle button -->
      <button id="gs-chat-toggle" aria-label="Open chat" style="
        width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;
        background:linear-gradient(135deg,#0052CC,#0070f3);color:#fff;
        box-shadow:0 4px 20px rgba(0,82,204,.4);font-size:1.3rem;
        display:flex;align-items:center;justify-content:center;
        transition:transform .2s;">
        <i class="fas fa-comments"></i>
      </button>
      <!-- Unread badge -->
      <span id="gs-badge" style="
        display:none;position:absolute;top:-2px;right:-2px;
        background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;
        width:18px;height:18px;border-radius:50%;line-height:18px;text-align:center;">1</span>

      <!-- Chat window -->
      <div id="gs-chat-window" style="
        display:none;flex-direction:column;
        width:360px;height:520px;max-height:80vh;
        background:#fff;border-radius:18px;
        box-shadow:0 12px 48px rgba(0,82,204,.18);
        overflow:hidden;margin-bottom:12px;
        position:absolute;bottom:68px;right:0;">

        <!-- Header -->
        <div style="
          background:linear-gradient(135deg,#0052CC,#0070f3);
          padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="
            width:38px;height:38px;border-radius:50%;
            background:rgba(255,255,255,.2);
            display:flex;align-items:center;justify-content:center;
            font-size:1.1rem;color:#fff;position:relative;">
            🤖
            <span style="
              position:absolute;bottom:0;right:0;
              width:10px;height:10px;background:#22c55e;
              border-radius:50%;border:2px solid #0052CC;"></span>
          </div>
          <div style="flex:1;color:#fff;">
            <div style="font-weight:600;font-size:.88rem;">GlobexSky Assistant</div>
            <div style="font-size:.72rem;opacity:.8;">AI-powered · Responds instantly</div>
          </div>
          <button id="gs-chat-close" aria-label="Close chat" style="
            background:none;border:none;color:rgba(255,255,255,.8);
            cursor:pointer;font-size:1.1rem;padding:4px;">✕</button>
        </div>

        <!-- Messages -->
        <div id="gs-messages" style="
          flex:1;overflow-y:auto;padding:14px;
          display:flex;flex-direction:column;gap:10px;
          background:#f8faff;"></div>

        <!-- Quick replies -->
        <div id="gs-quick-replies" style="
          padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;
          background:#f0f4ff;border-top:1px solid #e2e8f0;flex-shrink:0;"></div>

        <!-- Input -->
        <div style="
          padding:10px 12px;background:#fff;
          border-top:1px solid #e2e8f0;
          display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <input id="gs-input" type="text" placeholder="Type a message…" maxlength="500" style="
            flex:1;border:1.5px solid #e2e8f0;border-radius:10px;
            padding:9px 14px;font-size:.85rem;outline:none;
            font-family:'Inter',sans-serif;transition:border-color .2s;">
          <button id="gs-send" aria-label="Send" style="
            background:#0052CC;color:#fff;border:none;border-radius:10px;
            padding:9px 14px;cursor:pointer;font-size:.9rem;
            transition:background .2s;">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>

        <!-- Human escalation -->
        <div style="text-align:center;padding:6px;background:#fff;border-top:1px solid #f0f0f0;">
          <button id="gs-human-btn" style="
            background:none;border:none;color:#64748b;font-size:.75rem;
            cursor:pointer;text-decoration:underline;">
            Talk to a human agent
          </button>
        </div>
      </div>
    </div>
  `);

  document.body.appendChild(widget);

  // ─── Element refs ────────────────────────────────────────────────────────────
  const chatWindow = document.getElementById('gs-chat-window');
  const messagesEl = document.getElementById('gs-messages');
  const inputEl = document.getElementById('gs-input');
  const quickRepliesEl = document.getElementById('gs-quick-replies');
  const badge = document.getElementById('gs-badge');

  // ─── Toggle open/close ───────────────────────────────────────────────────────

  document.getElementById('gs-chat-toggle').addEventListener('click', () => toggleWidget(true));
  document.getElementById('gs-chat-close').addEventListener('click', () => toggleWidget(false));

  function toggleWidget(open) {
    isOpen = open;
    chatWindow.style.display = open ? 'flex' : 'none';
    badge.style.display = 'none';
    if (open && messagesEl.childElementCount === 0) {
      restoreHistory();
      renderQuickReplies();
    }
    if (open) setTimeout(() => inputEl.focus(), 100);
  }

  // ─── Quick replies ───────────────────────────────────────────────────────────

  function renderQuickReplies() {
    quickRepliesEl.innerHTML = '';
    QUICK_REPLIES.forEach((text) => {
      const btn = el(`<button style="
        background:#fff;border:1.5px solid #0052CC;color:#0052CC;
        border-radius:20px;padding:5px 12px;font-size:.75rem;
        cursor:pointer;white-space:nowrap;font-family:'Inter',sans-serif;
        transition:all .2s;">${text}</button>`);
      btn.addEventListener('click', () => sendMessage(text));
      btn.addEventListener('mouseenter', () => { btn.style.background = '#0052CC'; btn.style.color = '#fff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; btn.style.color = '#0052CC'; });
      quickRepliesEl.appendChild(btn);
    });
  }

  // ─── Message rendering ───────────────────────────────────────────────────────

  function appendMessage(role, content, products = []) {
    const isUser = role === 'user';
    const wrap = el(`<div style="
      display:flex;flex-direction:column;
      align-items:${isUser ? 'flex-end' : 'flex-start'};
      gap:4px;"></div>`);

    const bubble = el(`<div style="
      max-width:82%;padding:10px 14px;border-radius:${isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px'};
      background:${isUser ? '#0052CC' : '#fff'};
      color:${isUser ? '#fff' : '#1a1a2e'};
      box-shadow:0 2px 8px rgba(0,0,0,.08);
      font-size:.84rem;line-height:1.5;word-break:break-word;">
      ${escapeHtml(content)}
    </div>`);
    wrap.appendChild(bubble);

    // Product suggestion cards
    if (products && products.length > 0) {
      const cardsWrap = el('<div style="display:flex;flex-direction:column;gap:6px;max-width:82%;"></div>');
      products.slice(0, 3).forEach((p) => {
        const card = el(`<div style="
          background:#fff;border:1px solid #e2e8f0;border-radius:10px;
          padding:8px 10px;display:flex;gap:8px;align-items:center;cursor:pointer;
          box-shadow:0 1px 4px rgba(0,0,0,.06);">
          <img src="${p.images?.[0] || '/assets/images/placeholder.png'}" alt=""
            style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.78rem;font-weight:600;color:#0a0e27;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(p.title || p.name || '')}
            </div>
            <div style="font-size:.75rem;color:#0052CC;font-weight:700;">$${p.price}</div>
          </div>
          <span style="font-size:.7rem;background:#eff6ff;color:#0052CC;padding:2px 6px;border-radius:6px;">View</span>
        </div>`);
        card.addEventListener('click', () => window.open(`/pages/product/?id=${p.id}`, '_blank'));
        cardsWrap.appendChild(card);
      });
      wrap.appendChild(cardsWrap);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showTypingIndicator() {
    if (isTyping) return;
    isTyping = true;
    const dot = (d) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:gs-bounce ${d}s ease-in-out infinite;"></span>`;
    const indicator = el(`<div id="gs-typing" style="
      display:flex;align-items:flex-start;gap:4px;">
      <div style="
        background:#fff;padding:10px 14px;border-radius:4px 14px 14px 14px;
        box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;gap:4px;align-items:center;">
        ${dot('.4')}${dot('.6')}${dot('.8')}
      </div>
    </div>`);
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTypingIndicator() {
    isTyping = false;
    const ind = document.getElementById('gs-typing');
    if (ind) ind.remove();
  }

  // ─── History persistence ─────────────────────────────────────────────────────

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_e) { return []; }
  }

  function saveToHistory(role, content) {
    history.push({ role, content, ts: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_e) {}
  }

  function restoreHistory() {
    history.slice(-20).forEach((m) => appendMessage(m.role, m.content));
    if (history.length === 0) {
      appendMessage('bot', 'Hello! 👋 I\'m your GlobexSky shopping assistant. How can I help you today?');
    }
  }

  // ─── Send message ────────────────────────────────────────────────────────────

  async function sendMessage(text) {
    text = (text || inputEl.value).trim();
    if (!text) return;
    inputEl.value = '';

    appendMessage('user', text);
    saveToHistory('user', text);
    showTypingIndicator();

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      hideTypingIndicator();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        appendMessage('bot', err.error || 'Sorry, something went wrong. Please try again.');
        return;
      }

      const data = await res.json();
      const botMsg = data.data?.response || data.reply || 'I received your message.';
      sessionId = data.data?.session_id || sessionId;

      appendMessage('bot', botMsg, data.data?.suggested_products);
      saveToHistory('bot', botMsg);

      // Show human escalation notice
      if (data.data?.needs_human || data.data?.should_escalate) {
        appendMessage('bot', '↳ A human agent will be with you shortly. You can also email support@globexsky.com');
      }
    } catch (err) {
      hideTypingIndicator();
      appendMessage('bot', 'Connection error. Please check your internet and try again.');
    }
  }

  // ─── Event listeners ─────────────────────────────────────────────────────────

  document.getElementById('gs-send').addEventListener('click', () => sendMessage());
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); });

  document.getElementById('gs-human-btn').addEventListener('click', () => {
    sendMessage('I want to speak to a human agent');
  });

  inputEl.addEventListener('focus', () => { inputEl.style.borderColor = '#0052CC'; });
  inputEl.addEventListener('blur', () => { inputEl.style.borderColor = '#e2e8f0'; });

  // ─── Bounce animation CSS ─────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `@keyframes gs-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`;
  document.head.appendChild(style);

  // ─── Utility ─────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // Show unread badge when widget is closed
  window.addEventListener('gs-new-message', () => {
    if (!isOpen) { badge.style.display = 'block'; }
  });

})();
