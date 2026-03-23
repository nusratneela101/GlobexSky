/**
 * Globex Sky - support-page.js
 * Support section: ticket creation, ticket list, chatbot interface.
 */

const SupportAPI = {
  BASE: '/api/v1/support',
  headers(json = true) {
    const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },
  async get(path) {
    const res = await fetch(this.BASE + path, { headers: this.headers(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const isFormData = body instanceof FormData;
    const res = await fetch(this.BASE + path, {
      method: 'POST',
      headers: isFormData ? this.headers(false) : this.headers(),
      body: isFormData ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   TICKET CREATION FORM
───────────────────────────────────────────── */
function initTicketForm() {
  const form = document.querySelector('#supportTicketForm, [data-ticket-form]');
  if (!form) return;

  // Character counter for description
  const descArea   = form.querySelector('[name="description"], #ticketDescription');
  const charCounter = form.querySelector('[data-char-count]');
  if (descArea && charCounter) {
    const max = parseInt(descArea.maxLength || '2000', 10);
    descArea.addEventListener('input', () => {
      charCounter.textContent = `${descArea.value.length}/${max}`;
      if (descArea.value.length > max * 0.9) charCounter.classList.add('text-danger');
      else charCounter.classList.remove('text-danger');
    });
  }

  // File attachment preview
  const fileInput    = form.querySelector('[name="attachments"], #ticketAttachments');
  const filePreview  = form.querySelector('[data-file-preview]');
  if (fileInput && filePreview) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      filePreview.innerHTML = files.map((f) => `
        <div class="badge bg-light text-dark border me-1 mb-1">
          <i class="fas fa-paperclip me-1"></i>${f.name} (${(f.size / 1024).toFixed(0)}KB)
        </div>`).join('');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    try {
      const fd = new FormData(form);
      const json = await SupportAPI.post('/tickets', fd);
      const ticket = json.data || json;

      if (typeof showToast === 'function') showToast(`Ticket #${ticket.id} submitted! We'll respond within 24 hours.`, 'success');
      form.reset();
      if (filePreview) filePreview.innerHTML = '';

      // Show success banner
      const banner = document.querySelector('[data-ticket-success]');
      if (banner) {
        banner.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i>Your ticket <strong>#${ticket.id}</strong> has been submitted. <a href="/pages/support/tickets.html">View your tickets</a></div>`;
        banner.style.display = 'block';
        form.style.display = 'none';
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Failed to submit ticket.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   TICKET LIST
───────────────────────────────────────────── */
async function initTicketsList() {
  const container    = document.querySelector('.tickets-list, [data-tickets-list]');
  const statusFilter = document.querySelector('#ticketStatusFilter, [data-ticket-status]');
  const searchInput  = document.querySelector('#ticketSearch, [data-ticket-search]');
  if (!container) return;

  let tickets = [];

  const render = (list) => {
    container.innerHTML = list.length
      ? list.map((t) => `
          <div class="card ticket-card mb-3 border-start border-${ticketStatusColor(t.status)} border-3">
            <div class="card-body">
              <div class="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <h6 class="mb-1">
                    <a href="/pages/support/tickets.html?id=${t.id}">#${t.id} — ${t.subject}</a>
                  </h6>
                  <div class="d-flex gap-3 flex-wrap">
                    <span class="badge bg-${ticketStatusColor(t.status)}">${t.status}</span>
                    <span class="badge bg-${ticketPriorityColor(t.priority)}">${t.priority || 'Normal'}</span>
                    <span class="badge bg-light text-dark">${t.category || 'General'}</span>
                  </div>
                </div>
                <div class="text-end">
                  <small class="text-muted d-block">${new Date(t.created_at).toLocaleDateString()}</small>
                  ${t.last_reply ? `<small class="text-muted">Last reply: ${new Date(t.last_reply).toLocaleDateString()}</small>` : ''}
                </div>
              </div>
              ${t.last_message ? `<p class="text-muted small mt-2 mb-0 text-truncate">${t.last_message}</p>` : ''}
            </div>
          </div>`).join('')
      : '<p class="text-muted text-center py-5">No support tickets.</p>';
  };

  const applyFilters = () => {
    let list   = [...tickets];
    const stat = statusFilter?.value;
    const q    = searchInput?.value.trim().toLowerCase();
    if (stat && stat !== 'all') list = list.filter((t) => t.status === stat);
    if (q) list = list.filter((t) => t.subject.toLowerCase().includes(q) || String(t.id).includes(q));
    render(list);
  };

  statusFilter?.addEventListener('change', applyFilters);
  searchInput?.addEventListener('input', applyFilters);

  try {
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    const data = await SupportAPI.get('/tickets');
    tickets = data.data || data || [];
    applyFilters();
  } catch (_) {
    container.innerHTML = '<p class="text-danger">Failed to load tickets.</p>';
  }
}

function ticketStatusColor(s) {
  const m = { open: 'primary', 'in-progress': 'info', resolved: 'success', closed: 'secondary', pending: 'warning' };
  return m[(s || '').toLowerCase()] || 'secondary';
}
function ticketPriorityColor(p) {
  const m = { low: 'success', normal: 'secondary', high: 'warning', urgent: 'danger', critical: 'danger' };
  return m[(p || '').toLowerCase()] || 'secondary';
}

/* ─────────────────────────────────────────────
   TICKET DETAIL / REPLIES
───────────────────────────────────────────── */
async function initTicketDetail() {
  const section  = document.querySelector('.ticket-detail, [data-ticket-detail]');
  const replyForm = document.querySelector('#replyForm, [data-reply-form]');
  if (!section) return;

  const ticketId = new URLSearchParams(window.location.search).get('id');
  if (!ticketId) return;

  try {
    const data   = await SupportAPI.get(`/tickets/${ticketId}`);
    const ticket = data.data || data;

    const set = (sel, val) => { const el = section.querySelector(sel); if (el) el.textContent = val; };
    set('[data-ticket-subject]', ticket.subject || '');
    set('[data-ticket-status]',  ticket.status  || '');
    set('[data-ticket-priority]', ticket.priority || 'Normal');
    set('[data-ticket-date]',    ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '');

    const messagesEl = section.querySelector('.ticket-messages, [data-ticket-messages]');
    if (messagesEl && Array.isArray(ticket.messages)) {
      const currentUser = JSON.parse(localStorage.getItem('globexUser') || '{}');
      messagesEl.innerHTML = ticket.messages.map((m) => {
        const isSelf = String(m.user_id || m.sender_id) === String(currentUser?.id);
        return `
          <div class="ticket-msg ${isSelf ? 'ms-auto' : ''} mb-4" style="max-width:80%">
            <div class="d-flex align-items-center gap-2 mb-1 ${isSelf ? 'flex-row-reverse' : ''}">
              <strong>${m.user_name || (isSelf ? 'You' : 'Support')}</strong>
              <small class="text-muted">${new Date(m.created_at).toLocaleString()}</small>
              ${m.is_staff ? '<span class="badge bg-info">Staff</span>' : ''}
            </div>
            <div class="card">
              <div class="card-body p-3" style="background:${isSelf ? '#e8f0fe' : '#f8f9fa'}">
                ${m.message}
              </div>
            </div>
          </div>`;
      }).join('');
    }
  } catch (_) {}

  if (replyForm) {
    replyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = replyForm.querySelector('[name="message"]')?.value.trim();
      if (!msg) return;
      const btn  = replyForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      try {
        await SupportAPI.post(`/tickets/${ticketId}/reply`, { message: msg });
        if (typeof showToast === 'function') showToast('Reply sent.', 'success');
        replyForm.reset();
        window.location.reload();
      } catch (_) {
        if (typeof showToast === 'function') showToast('Failed to send reply.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }
}

/* ─────────────────────────────────────────────
   SUPPORT CHATBOT
───────────────────────────────────────────── */
function initSupportChatbot() {
  const chatWidget = document.querySelector('.support-chatbot, [data-support-chatbot]');
  if (!chatWidget) return;

  const messagesEl = chatWidget.querySelector('.chatbot-messages, [data-chatbot-messages]');
  const form       = chatWidget.querySelector('#chatbotForm, [data-chatbot-form]');
  const input      = form?.querySelector('[name="message"], #chatbotInput');
  const toggleBtn  = document.querySelector('[data-chatbot-toggle], #chatbotToggle');

  // Toggle chatbot open/close
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      chatWidget.classList.toggle('open');
      if (chatWidget.classList.contains('open')) {
        input?.focus();
      }
    });
  }

  const faq = [
    { q: 'track order',   a: 'To track your order, go to Account → Orders and click on your order, or use the tracking page at /pages/shipment/tracking.html' },
    { q: 'return',        a: 'To request a return, go to Account → Orders → Order Detail and click "Return/Refund Request".' },
    { q: 'payment',       a: 'We accept bKash, Nagad, credit/debit cards, and Cash on Delivery. Visit /pages/payment for more info.' },
    { q: 'contact',       a: 'You can reach our support team at support@globexsky.com or call +880-XX-XXXXXXX.' },
    { q: 'refund',        a: 'Refunds are processed within 3-7 business days after approval. Check Account → Refunds for status.' },
    { q: 'shipping',      a: 'Standard shipping takes 3-7 days. Express shipping takes 1-2 days. Free shipping on orders over $100.' },
  ];

  const appendMsg = (text, isBot) => {
    if (!messagesEl) return;
    const div = document.createElement('div');
    div.className = `chatbot-msg d-flex gap-2 mb-2 ${isBot ? '' : 'flex-row-reverse'}`;
    div.innerHTML = `
      <div class="chatbot-avatar rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
        style="width:30px;height:30px;background:${isBot ? '#0d6efd' : '#6c757d'};color:#fff;font-size:.7rem">
        <i class="fas fa-${isBot ? 'robot' : 'user'}"></i>
      </div>
      <div class="chatbot-bubble px-2 py-1 rounded small" style="max-width:80%;background:${isBot ? '#e8f0fe' : '#e9ecef'}">
        ${text}
      </div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const getBotResponse = (message) => {
    const lc = message.toLowerCase();
    for (const item of faq) {
      if (lc.includes(item.q)) return item.a;
    }
    if (lc.includes('hello') || lc.includes('hi') || lc.includes('hey')) {
      return 'Hello! How can I help you today?';
    }
    return 'I\'m not sure about that. Please <a href="/pages/support/tickets.html">submit a ticket</a> or email support@globexsky.com and our team will assist you.';
  };

  // Welcome message
  appendMsg('Hi! I\'m the GlobexSky support bot. Ask me anything or <a href="/pages/support/tickets.html">create a ticket</a>.', true);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input?.value.trim();
      if (!message) return;
      appendMsg(message, false);
      if (input) input.value = '';

      // Show typing indicator
      const typing = document.createElement('div');
      typing.className = 'chatbot-typing text-muted small ms-5 mb-2';
      typing.textContent = 'Typing…';
      messagesEl?.appendChild(typing);

      // Try API first, fall back to local FAQ
      try {
        const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
        const res = await fetch('/api/v1/support/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();
        typing.remove();
        appendMsg(data.reply || data.message || getBotResponse(message), true);
      } catch (_) {
        setTimeout(() => {
          typing.remove();
          appendMsg(getBotResponse(message), true);
        }, 800);
      }
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
    });
  }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    field.classList.remove('is-invalid');
    if (!field.value.trim()) { field.classList.add('is-invalid'); valid = false; }
  });
  if (!valid && typeof showToast === 'function') showToast('Please fill in all required fields.', 'error');
  return valid;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTicketForm();
  initTicketsList();
  initTicketDetail();
  initSupportChatbot();
});
