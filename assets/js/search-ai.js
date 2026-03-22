/**
 * Globex Sky — search-ai.js
 * Feature 6: AI Product Recommendations
 * Feature 7: "Ask AI" Chatbot
 */

'use strict';

const CHAT_STORAGE_KEY = 'globexChatHistory';

/* ── Utility ────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 6 — AI RECOMMENDATIONS
════════════════════════════════════════════════════════════════════════ */
const GlobexRecommendations = (() => {
  let currentContext = '';
  let dismissedIds = new Set();

  /* ── Fetch ───────────────────────────────────────────────────────────── */
  async function load(context, containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="display:flex;gap:12px;overflow:hidden">' + Array(6).fill(0).map(() => `
      <div class="skeleton-card" style="min-width:160px"><div class="skeleton skeleton-img"></div>
      <div class="skeleton-body"><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-price"></div></div></div>
    `).join('') + '</div>';

    try {
      const params = new URLSearchParams({ context: context || '', limit: 12 });
      const data = await window.API.get(`/search/recommendations?${params}`);
      const products = (data.data || []).filter(p => !dismissedIds.has(p.id));
      currentContext = data.context || title;

      if (products.length === 0) { container.innerHTML = ''; return; }

      container.innerHTML = `<div class="recs-carousel">${products.map(p => renderRecCard(p)).join('')}</div>`;

      // Dismiss buttons
      container.querySelectorAll('.rec-dismiss').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const card = btn.closest('.rec-card');
          if (card) {
            dismissedIds.add(card.dataset.id);
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => card.remove(), 300);
          }
        });
      });

      // Click to product
      container.querySelectorAll('.rec-card').forEach(card => {
        card.addEventListener('click', () => {
          if (card.dataset.id) window.location.href = `/pages/sourcing/product-detail.html?id=${card.dataset.id}`;
        });
      });
    } catch (_) { container.innerHTML = ''; }
  }

  function renderRecCard(p) {
    const img = p.images?.[0] || '';
    const price = p.price ? `$${parseFloat(p.price).toFixed(2)}` : 'Contact';
    const rating = p.average_rating ? Math.round(p.average_rating) : 0;
    const imgHtml = img ? `<img class="rec-img" src="${escapeHtml(img)}" alt="${escapeHtml(p.title || '')}" loading="lazy">`
      : `<div class="rec-img"><i class="fas fa-box"></i></div>`;

    return `<div class="rec-card" data-id="${escapeHtml(p.id || '')}">
      <button class="rec-dismiss" title="Not interested"><i class="fas fa-times"></i></button>
      ${imgHtml}
      <div class="rec-body">
        <div class="rec-name">${escapeHtml(p.title || 'Product')}</div>
        <div class="rec-price">${price}</div>
        ${rating ? `<div style="font-size:0.72rem;color:#f59e0b">${'★'.repeat(rating)}</div>` : ''}
      </div>
    </div>`;
  }

  /* ── Load all recommendation sections on page ─────────────────────── */
  async function initSections() {
    const q = new URLSearchParams(window.location.search).get('q') || '';

    await Promise.allSettled([
      load(q, 'recs-for-you', 'Recommended for You'),
      load(q, 'recs-similar', 'Customers Also Viewed'),
      load('', 'recs-trending', 'Trending in Your Industry'),
    ]);
  }

  return { initSections, load };
})();

/* ════════════════════════════════════════════════════════════════════════
   FEATURE 7 — ASK AI CHATBOT
════════════════════════════════════════════════════════════════════════ */
const GlobexChatbot = (() => {
  let chatWindowEl, messagesEl, inputEl, sendBtn, bubbleBtn;
  let isOpen = false;
  let isMinimized = false;
  let isSending = false;
  let history = [];

  const QUICK_REPLIES = [
    'Find electronics suppliers',
    'Best price for bulk orders',
    'Show trending products',
    'Verified suppliers only',
    'Products under $50',
  ];

  /* ── Load / Save Chat History ─────────────────────────────────────── */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || []; }
    catch (_) { return []; }
  }

  function saveHistory(msgs) {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-60))); }
    catch (_) {}
  }

  /* ── Open / Close / Minimize ─────────────────────────────────────── */
  function open() {
    isOpen = true;
    chatWindowEl.classList.add('open');
    chatWindowEl.classList.remove('minimized');
    isMinimized = false;
    if (bubbleBtn) bubbleBtn.querySelector('i').className = 'fas fa-times';
    scrollToBottom();
  }

  function close() {
    isOpen = false;
    chatWindowEl.classList.remove('open');
    if (bubbleBtn) bubbleBtn.querySelector('i').className = 'fas fa-robot';
  }

  function minimize() {
    isMinimized = !isMinimized;
    chatWindowEl.classList.toggle('minimized', isMinimized);
  }

  /* ── Render Message ───────────────────────────────────────────────── */
  function renderMessage(role, text, products, actions, time) {
    const isUser = role === 'user';
    const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let productsHtml = '';
    if (products && products.length > 0) {
      productsHtml = `<div class="chat-products">${products.map(p => {
        const img = p.images?.[0] || '';
        const price = p.price ? `$${parseFloat(p.price).toFixed(2)}` : '';
        const imgHtml = img ? `<img class="chat-product-img" src="${escapeHtml(img)}" alt="" loading="lazy">`
          : `<div class="chat-product-img"><i class="fas fa-box"></i></div>`;
        return `<div class="chat-product-card" onclick="window.location.href='/pages/sourcing/product-detail.html?id=${escapeHtml(p.id || '')}'">
          ${imgHtml}
          <div class="chat-product-body">
            <div class="chat-product-name">${escapeHtml(p.title || 'Product')}</div>
            ${price ? `<div class="chat-product-price">${price}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`;
    }

    let actionsHtml = '';
    if (!isUser && actions && actions.length > 0) {
      actionsHtml = `<div class="quick-replies">${actions.map(a =>
        `<button class="quick-reply-chip" data-action="${escapeHtml(a.action || '')}" data-query="${escapeHtml(a.query || '')}">${escapeHtml(a.label)}</button>`
      ).join('')}</div>`;
    }

    return `<div class="msg-wrap ${isUser ? 'user' : ''}">
      <div class="msg-avatar"><i class="fas fa-${isUser ? 'user' : 'robot'}"></i></div>
      <div style="flex:1;min-width:0">
        <div class="msg-bubble">${escapeHtml(text)}</div>
        ${productsHtml}
        ${actionsHtml}
        ${timeStr ? `<div class="msg-time">${timeStr}</div>` : ''}
      </div>
    </div>`;
  }

  function renderTyping() {
    return `<div class="typing-indicator" id="typing-indicator">
      <div class="msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="typing-dots">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>
    </div>`;
  }

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── Add Message to DOM ───────────────────────────────────────────── */
  function addMessage(role, text, products, actions) {
    if (!messagesEl) return;
    const time = new Date().toISOString();
    history.push({ role, text, products, actions, time });
    saveHistory(history);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderMessage(role, text, products, actions, time);
    messagesEl.appendChild(wrapper.firstElementChild);

    // Bind action chips
    wrapper.querySelectorAll('.quick-reply-chip').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.query));
    });

    scrollToBottom();
  }

  function handleAction(action, query) {
    switch (action) {
      case 'search':
        if (query && window.GlobexSearch) {
          const input = document.getElementById('main-search-input');
          if (input) input.value = query;
          window.GlobexSearch.search(query);
        }
        close();
        break;
      case 'open_filters':
        if (window.GlobexFilters) window.GlobexFilters.openMobile();
        break;
      case 'trending':
        if (window.GlobexSearch) window.GlobexSearch.search('');
        close();
        break;
      case 'browse_categories':
        window.location.href = '/pages/sourcing/categories.html';
        break;
      default:
        if (query) sendMessage(query);
    }
  }

  /* ── Send Message ─────────────────────────────────────────────────── */
  async function sendMessage(text) {
    if (isSending) return;
    const msg = (text || inputEl?.value || '').trim();
    if (!msg) return;

    if (inputEl) { inputEl.value = ''; autoResizeInput(); }
    addMessage('user', msg);
    isSending = true;
    if (sendBtn) sendBtn.disabled = true;

    // Show typing
    if (messagesEl) {
      const typingEl = document.createElement('div');
      typingEl.innerHTML = renderTyping();
      messagesEl.appendChild(typingEl.firstElementChild);
      scrollToBottom();
    }

    try {
      const historySlice = history.slice(-10).map(h => ({ role: h.role, content: h.text }));
      const data = await window.API.post('/search/ai-chat', { message: msg, history: historySlice });

      // Remove typing indicator
      document.getElementById('typing-indicator')?.remove();

      addMessage('bot', data.reply || 'Here are some results for you:', data.products, data.actions);
    } catch (err) {
      document.getElementById('typing-indicator')?.remove();
      addMessage('bot', 'Sorry, I encountered an error. Please try again.', [], []);
    } finally {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ── Auto-resize textarea ─────────────────────────────────────────── */
  function autoResizeInput() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  }

  /* ── Render Welcome + History ─────────────────────────────────────── */
  function renderInitial() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';

    // Welcome message
    const welcome = document.createElement('div');
    welcome.innerHTML = renderMessage('bot', '👋 Hi! I\'m your AI sourcing assistant. Ask me anything like:\n• "Find electronics suppliers in Guangzhou"\n• "Best price for USB cables in bulk"\n• "Show verified suppliers for textiles"', [], []);
    messagesEl.appendChild(welcome.firstElementChild);

    // Quick replies
    const quickEl = document.createElement('div');
    quickEl.className = 'quick-replies';
    quickEl.style.padding = '0 14px 10px';
    quickEl.innerHTML = QUICK_REPLIES.map(q =>
      `<button class="quick-reply-chip" data-msg="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    ).join('');
    messagesEl.appendChild(quickEl);
    quickEl.querySelectorAll('.quick-reply-chip').forEach(btn => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
    });

    // Load stored history
    if (history.length > 0) {
      history.forEach(h => {
        const el = document.createElement('div');
        el.innerHTML = renderMessage(h.role, h.text, h.products, h.actions, h.time);
        const msgEl = el.firstElementChild;
        if (msgEl) {
          messagesEl.appendChild(msgEl);
          msgEl.querySelectorAll('.quick-reply-chip').forEach(btn => {
            btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.query));
          });
        }
      });
    }

    scrollToBottom();
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  function init() {
    chatWindowEl = document.getElementById('chat-window');
    messagesEl = document.getElementById('chat-messages');
    inputEl = document.getElementById('chat-input');
    sendBtn = document.getElementById('btn-chat-send');
    bubbleBtn = document.getElementById('chat-bubble-btn');

    if (!chatWindowEl) return;

    history = loadHistory();

    bubbleBtn?.addEventListener('click', () => isOpen ? close() : open());

    // Minimize / Close buttons
    document.getElementById('chat-minimize')?.addEventListener('click', minimize);
    document.getElementById('chat-close')?.addEventListener('click', close);

    // Clear history
    document.getElementById('chat-clear')?.addEventListener('click', () => {
      history = [];
      saveHistory([]);
      renderInitial();
    });

    // Send
    sendBtn?.addEventListener('click', () => sendMessage());
    inputEl?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inputEl?.addEventListener('input', autoResizeInput);

    renderInitial();
  }

  return { init, open, close };
})();

/* ── Init on DOM ready ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  GlobexRecommendations.initSections();
  GlobexChatbot.init();
});

window.GlobexRecommendations = GlobexRecommendations;
window.GlobexChatbot = GlobexChatbot;
