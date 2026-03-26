/**
 * Globex Sky - ai.js
 * AI section: chatbot interface, product recommendations, fraud detection dashboard.
 */

const _AI_BASE = (window.GlobexConfig && window.GlobexConfig.API_BASE_URL) || '/api/v1';

/* ─────────────────────────────────────────────
   CHATBOT
───────────────────────────────────────────── */
function initAIChatbot() {
  const chatContainer = document.querySelector('.ai-chat-container, [data-ai-chat]');
  const messagesEl    = document.querySelector('.ai-chat-messages, [data-chat-messages]');
  const form          = document.querySelector('#aiChatForm, [data-chat-form]');
  const input         = form?.querySelector('[name="message"], #chatInput');
  if (!chatContainer || !form || !messagesEl) return;

  const conversationHistory = [];

  const appendMessage = (text, role) => {
    const isBot = role === 'assistant';
    const wrap  = document.createElement('div');
    wrap.className = `chat-message d-flex gap-2 mb-3 ${isBot ? '' : 'flex-row-reverse'}`;
    wrap.innerHTML = `
      <div class="chat-avatar rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
        style="width:36px;height:36px;background:${isBot ? '#0d6efd' : '#6c757d'};color:#fff;font-size:.8rem">
        ${isBot ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>'}
      </div>
      <div class="chat-bubble px-3 py-2 rounded" style="max-width:75%;background:${isBot ? '#f0f4ff' : '#e9ecef'}">
        ${escapeHtml(text)}
      </div>`;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const showTypingIndicator = () => {
    const el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'chat-message d-flex gap-2 mb-3';
    el.innerHTML = `
      <div class="chat-avatar rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
        style="width:36px;height:36px;background:#0d6efd;color:#fff;font-size:.8rem">
        <i class="fas fa-robot"></i>
      </div>
      <div class="chat-bubble px-3 py-2 rounded" style="background:#f0f4ff">
        <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>`;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const removeTypingIndicator = () => {
    document.getElementById('typingIndicator')?.remove();
  };

  // Welcome message
  appendMessage('Hello! I\'m GlobexSky AI Assistant. How can I help you today? You can ask about products, orders, shipping, or anything else!', 'assistant');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input?.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });
    if (input) input.value = '';

    showTypingIndicator();
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
      const res = await fetch(`${_AI_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, history: conversationHistory.slice(-10) }),
      });
      const data = await res.json();
      const reply = data.reply || data.message || data.response || 'I\'m sorry, I couldn\'t process that request.';
      removeTypingIndicator();
      appendMessage(reply, 'assistant');
      conversationHistory.push({ role: 'assistant', content: reply });
    } catch (_) {
      removeTypingIndicator();
      appendMessage('Sorry, I\'m having trouble connecting right now. Please try again.', 'assistant');
    } finally {
      if (btn) btn.disabled = false;
      input?.focus();
    }
  });

  // Quick suggestion chips
  document.querySelectorAll('[data-chat-suggestion]').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (input) { input.value = chip.dataset.chatSuggestion; form.dispatchEvent(new Event('submit')); }
    });
  });

  // Allow Enter key
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────────────────────────────────────────
   AI RECOMMENDATIONS
───────────────────────────────────────────── */
async function initAIRecommendations() {
  const container = document.querySelector('.ai-recommendations, [data-ai-recommendations]');
  if (!container) return;

  try {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const res  = await fetch(`${_AI_BASE}/ai/recommendations`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data  = await res.json();
    const items = data.data || data.products || data || [];

    if (!items.length) {
      container.innerHTML = '<p class="text-muted text-center py-4">No recommendations available yet. Start browsing products!</p>';
      return;
    }

    container.innerHTML = `<div class="row g-3">` + items.map((p) => `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="card product-card h-100">
          <img src="${p.image || '/assets/images/placeholder.png'}" class="card-img-top" alt="${p.name}" style="height:160px;object-fit:cover">
          <div class="card-body d-flex flex-column">
            <h6 class="card-title text-truncate">${p.name}</h6>
            <p class="text-muted small mb-1">${p.category || ''}</p>
            <p class="fw-bold text-primary mb-2">$${parseFloat(p.price || 0).toFixed(2)}</p>
            ${p.ai_reason ? `<p class="text-muted small fst-italic mb-2">💡 ${p.ai_reason}</p>` : ''}
            <div class="d-flex gap-2 mt-auto">
              <a href="/pages/sourcing/product-detail.html?id=${p.id}" class="btn btn-sm btn-outline-primary flex-grow-1">View</a>
              <button class="btn btn-sm btn-primary" data-add-to-cart="${p.id}"
                data-product-id="${p.id}" data-product-name="${p.name}"
                data-product-price="${p.price}" data-product-image="${p.image || ''}">
                <i class="fas fa-cart-plus"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`).join('') + `</div>`;

    container.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset;
        if (typeof addToCart === 'function') {
          addToCart({ id: d.productId, name: d.productName, price: parseFloat(d.productPrice), image: d.productImage, quantity: 1 });
          if (typeof showToast === 'function') showToast(`${d.productName} added to cart!`, 'success');
        }
      });
    });
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load recommendations.</p>';
  }
}

/* ─────────────────────────────────────────────
   FRAUD DETECTION DASHBOARD
───────────────────────────────────────────── */
async function initFraudDetectionDashboard() {
  const section = document.querySelector('.fraud-dashboard, [data-fraud-dashboard]');
  if (!section) return;

  try {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const res  = await fetch(`${_AI_BASE}/ai/fraud/dashboard`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const d    = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-stat="flagged"]',    d.flaggedTransactions ?? '—');
    set('[data-stat="blocked"]',    d.blockedTransactions  ?? '—');
    set('[data-stat="risk-score"]', d.avgRiskScore         ? (d.avgRiskScore * 100).toFixed(1) + '%' : '—');
    set('[data-stat="saved"]',      d.amountSaved          ? '$' + parseFloat(d.amountSaved).toFixed(2) : '—');

    // Risk alerts table
    const alertsTable = section.querySelector('.alerts-table tbody');
    if (alertsTable && Array.isArray(d.recentAlerts)) {
      alertsTable.innerHTML = d.recentAlerts.map((a) => `
        <tr>
          <td>#${a.transaction_id}</td>
          <td>${a.user || '—'}</td>
          <td>$${parseFloat(a.amount || 0).toFixed(2)}</td>
          <td>
            <div class="progress" style="height:8px;width:80px">
              <div class="progress-bar bg-${riskColor(a.risk_score)}" style="width:${(a.risk_score * 100).toFixed(0)}%"></div>
            </div>
            <small>${(a.risk_score * 100).toFixed(0)}%</small>
          </td>
          <td><span class="badge bg-${a.blocked ? 'danger' : 'warning'}">${a.blocked ? 'Blocked' : 'Flagged'}</span></td>
          <td>${new Date(a.created_at).toLocaleString()}</td>
        </tr>`).join('');
    }

    // Chart
    const canvas = section.querySelector('#fraudChart, [data-fraud-chart]');
    if (canvas && typeof Chart !== 'undefined' && d.chartData) {
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: d.chartData.labels || [],
          datasets: [{
            label: 'Risk Score',
            data: d.chartData.scores || [],
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220,53,69,.1)',
            tension: 0.4,
            fill: true,
          }],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 1 } } },
      });
    }
  } catch (_) {
    section.querySelector('.fraud-stats')?.insertAdjacentHTML('beforeend', '<p class="text-danger small">Failed to load fraud data.</p>');
  }
}

function riskColor(score) {
  if (score >= 0.8) return 'danger';
  if (score >= 0.5) return 'warning';
  return 'success';
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAIChatbot();
  initAIRecommendations();
  initFraudDetectionDashboard();
});
