/**
 * Globex Sky - communication.js
 * Chat interface (real-time or polling) and video meeting room placeholder.
 */

/* ─────────────────────────────────────────────
   CHAT
───────────────────────────────────────────── */
function initChat() {
  const chatEl      = document.querySelector('.chat-interface, [data-chat-interface]');
  if (!chatEl) return;

  const messagesEl  = chatEl.querySelector('.chat-messages, [data-chat-messages]');
  const form        = chatEl.querySelector('#chatForm, [data-chat-form]');
  const input       = form?.querySelector('[name="message"], #chatInput');
  const conversationId = chatEl.dataset.conversationId || new URLSearchParams(window.location.search).get('conversation');

  let pollingInterval = null;
  let lastMessageId   = 0;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const token = () => localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
  const headers = (json = true) => {
    const h = token() ? { Authorization: `Bearer ${token()}` } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };

  function appendMessage(msg, isSelf = false) {
    const div = document.createElement('div');
    div.className = `chat-msg d-flex gap-2 mb-3 ${isSelf ? 'flex-row-reverse' : ''}`;
    div.dataset.msgId = msg.id;
    div.innerHTML = `
      <img src="${msg.avatar || '/assets/images/avatar-placeholder.png'}"
        alt="${msg.sender || 'User'}" width="36" height="36"
        style="border-radius:50%;object-fit:cover;flex-shrink:0">
      <div>
        ${!isSelf ? `<div class="fw-bold small mb-1">${msg.sender || 'Unknown'}</div>` : ''}
        <div class="chat-bubble px-3 py-2 rounded-3"
          style="background:${isSelf ? '#0d6efd' : '#f0f4ff'};color:${isSelf ? '#fff' : '#212529'};max-width:380px">
          ${escapeHtml(msg.body || msg.message || '')}
        </div>
        <div class="text-muted" style="font-size:.7rem;margin-top:3px;${isSelf ? 'text-align:right' : ''}">
          ${new Date(msg.created_at || msg.timestamp || Date.now()).toLocaleTimeString()}
          ${isSelf ? (msg.read ? ' ✓✓' : ' ✓') : ''}
        </div>
      </div>`;
    if (messagesEl) {
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    lastMessageId = Math.max(lastMessageId, msg.id || 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Load history ─────────────────────────────────────────────────────────
  async function loadHistory() {
    if (!conversationId) return;
    try {
      const res  = await fetch(`/api/v1/conversations/${conversationId}/messages`, { headers: headers(false) });
      const data = await res.json();
      const msgs = data.data || data || [];
      const currentUser = JSON.parse(localStorage.getItem('globexUser') || 'null');
      msgs.forEach((m) => appendMessage(m, String(m.sender_id) === String(currentUser?.id)));
    } catch (_) {}
  }

  // ─── Polling for new messages ─────────────────────────────────────────────
  async function poll() {
    if (!conversationId) return;
    try {
      const res  = await fetch(`/api/v1/conversations/${conversationId}/messages?after=${lastMessageId}`, { headers: headers(false) });
      const data = await res.json();
      const msgs = data.data || data || [];
      const currentUser = JSON.parse(localStorage.getItem('globexUser') || 'null');
      msgs.forEach((m) => appendMessage(m, String(m.sender_id) === String(currentUser?.id)));
    } catch (_) {}
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input?.value.trim();
      if (!message || !conversationId) return;
      if (input) input.value = '';

      const currentUser = JSON.parse(localStorage.getItem('globexUser') || '{}');
      const optimistic = { id: Date.now(), sender_id: currentUser?.id, sender: 'You', body: message, created_at: new Date().toISOString() };
      appendMessage(optimistic, true);

      try {
        await fetch(`/api/v1/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ message }),
        });
      } catch (_) {}
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
    });
  }

  // ─── Conversation list ────────────────────────────────────────────────────
  const convList = document.querySelector('.conversations-list, [data-conversations-list]');
  if (convList) {
    (async () => {
      try {
        const res   = await fetch('/api/v1/conversations', { headers: headers(false) });
        const data  = await res.json();
        const convs = data.data || data || [];
        convList.innerHTML = convs.length
          ? convs.map((c) => `
            <a href="/pages/communication/chat.html?conversation=${c.id}"
              class="conversation-item d-flex gap-3 p-3 text-decoration-none text-dark border-bottom ${c.id == conversationId ? 'bg-light' : ''} ${c.unread ? 'fw-bold' : ''}">
              <img src="${c.other_user?.avatar || '/assets/images/avatar-placeholder.png'}" alt="${c.other_user?.name}" width="42" height="42" style="border-radius:50%;object-fit:cover">
              <div class="flex-grow-1 overflow-hidden">
                <div class="d-flex justify-content-between">
                  <span>${c.other_user?.name || 'User'}</span>
                  <small class="text-muted">${new Date(c.updated_at || c.last_message_at).toLocaleDateString()}</small>
                </div>
                <div class="text-truncate small text-muted">${c.last_message || ''}</div>
              </div>
              ${c.unread ? `<span class="badge bg-primary rounded-pill align-self-center">${c.unread}</span>` : ''}
            </a>`).join('')
          : '<p class="text-muted text-center py-4">No conversations yet.</p>';
      } catch (_) {}
    })();
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  loadHistory();
  pollingInterval = setInterval(poll, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(pollingInterval);
    else pollingInterval = setInterval(poll, 5000);
  });
}

/* ─────────────────────────────────────────────
   NEW CONVERSATION
───────────────────────────────────────────── */
function initNewConversation() {
  const form = document.querySelector('#newConversationForm, [data-new-conversation]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

    try {
      const token = localStorage.getItem('globexToken') || localStorage.getItem('auth_token');
      const res  = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      const id   = json.data?.id || json.id;
      if (id) window.location.href = `/pages/communication/chat.html?conversation=${id}`;
    } catch (_) {
      if (typeof showToast === 'function') showToast('Failed to create conversation.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
  });
}

/* ─────────────────────────────────────────────
   VIDEO MEETING ROOM
───────────────────────────────────────────── */
function initMeetingRoom() {
  const roomEl = document.querySelector('.meeting-room, [data-meeting-room]');
  if (!roomEl) return;

  const params   = new URLSearchParams(window.location.search);
  const roomId   = params.get('room') || roomEl.dataset.roomId;
  const userName = JSON.parse(localStorage.getItem('globexUser') || '{}')?.name || 'Guest';

  // Try Jitsi Meet integration
  if (typeof JitsiMeetExternalAPI !== 'undefined' && roomId) {
    const domain  = 'meet.jit.si';
    const options = {
      roomName: `globexsky-${roomId}`,
      parentNode: roomEl,
      userInfo: { displayName: userName },
      configOverwrite: { startWithAudioMuted: true, startWithVideoMuted: false },
      interfaceConfigOverwrite: { TOOLBAR_BUTTONS: ['microphone', 'camera', 'chat', 'hangup', 'fullscreen'] },
    };
    try {
      const api = new JitsiMeetExternalAPI(domain, options);
      api.addEventListener('readyToClose', () => {
        window.location.href = '/pages/meetings/index.html';
      });
    } catch (_) {
      showFallbackMeeting(roomEl, roomId);
    }
  } else {
    showFallbackMeeting(roomEl, roomId);
  }
}

function showFallbackMeeting(container, roomId) {
  container.innerHTML = `
    <div class="text-center py-5">
      <div class="mb-4">
        <i class="fas fa-video text-primary" style="font-size:4rem"></i>
      </div>
      <h4>Meeting Room</h4>
      <p class="text-muted">Room ID: <code>${roomId || 'N/A'}</code></p>
      <p class="text-muted">Video meeting integration requires the Jitsi Meet or Agora SDK to be loaded.</p>
      <a href="https://meet.jit.si/globexsky-${roomId || 'room'}" target="_blank" rel="noopener" class="btn btn-primary me-2">
        <i class="fas fa-external-link-alt me-2"></i>Open in Jitsi Meet
      </a>
      <a href="/pages/meetings/index.html" class="btn btn-outline-secondary">Back to Meetings</a>
    </div>`;
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initChat();
  initNewConversation();
  initMeetingRoom();
});
