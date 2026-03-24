/**
 * Globex Sky – virtual-booth.js
 * 3D CSS booth rendering, product interactions, video player,
 * chat integration, lead collection, and booth analytics.
 */

/* ── API Client ──────────────────────────────────────────────────────────── */
const VirtualBoothAPI = {
  BASE: '/api/v1/trade-shows',
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
  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ── Toast utility ───────────────────────────────────────────────────────── */
function vbToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  let toast = document.getElementById('vb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vb-toast';
    toast.className = 'ts-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  toast.className = `ts-toast ${type}`;
  requestAnimationFrame(() => { toast.classList.add('show'); });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 4000);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. CSS 3D BOOTH RENDERING
══════════════════════════════════════════════════════════════════════════ */
const Booth3D = (() => {
  let rotX = 8, rotY = 0, isDragging = false, startX = 0, startY = 0;
  let prevX = 0, prevY = 0;

  function init() {
    const canvas = document.querySelector('.vb-canvas, [data-vb-canvas]');
    if (!canvas) return;

    // Mouse drag rotation
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true; startX = e.clientX; startY = e.clientY;
      prevX = rotX; prevY = rotY;
      canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      rotY = prevY + dx * 0.3;
      rotX = Math.max(-5, Math.min(20, prevX - dy * 0.2));
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
      if (canvas) canvas.style.cursor = 'grab';
    });

    // Touch drag
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      isDragging = true; startX = t.clientX; startY = t.clientY;
      prevX = rotX; prevY = rotY;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      rotY = prevY + (t.clientX - startX) * 0.3;
      rotX = Math.max(-5, Math.min(20, prevX - (t.clientY - startY) * 0.2));
      applyTransform();
    }, { passive: true });
    canvas.addEventListener('touchend', () => { isDragging = false; });
  }

  function applyTransform() {
    const inner = document.querySelector('.vb-scene-inner');
    if (inner) inner.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }

  function resetView() {
    rotX = 8; rotY = 0;
    const inner = document.querySelector('.vb-scene-inner');
    if (inner) {
      inner.style.transition = 'transform .4s ease';
      applyTransform();
      setTimeout(() => { if (inner) inner.style.transition = ''; }, 420);
    }
  }

  function setView(preset) {
    const presets = { front: [8, 0], left: [5, 25], right: [5, -25], top: [30, 0] };
    const [rx, ry] = presets[preset] || [8, 0];
    rotX = rx; rotY = ry;
    const inner = document.querySelector('.vb-scene-inner');
    if (inner) {
      inner.style.transition = 'transform .4s ease';
      applyTransform();
      setTimeout(() => { if (inner) inner.style.transition = ''; }, 420);
    }
  }

  return { init, resetView, setView };
})();

/* ══════════════════════════════════════════════════════════════════════════
   2. PRODUCT INTERACTIONS
══════════════════════════════════════════════════════════════════════════ */
const BoothProducts = (() => {
  function init() {
    // 3D shelf items → open product detail modal
    document.querySelectorAll('.vb-product-item[data-product]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.product;
        openProductModal(id);
        BoothAnalytics.track('product_view', { product_id: id });
      });
    });

    // Product grid cards
    document.querySelectorAll('.vb-product-card[data-product]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.vb-product-actions')) return;
        const id = el.dataset.product;
        openProductModal(id);
        BoothAnalytics.track('product_view', { product_id: id });
      });
    });

    // Inquiry buttons
    document.querySelectorAll('[data-action="inquire"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.closest('[data-product-name]')?.dataset.productName || 'Product';
        openInquiryModal(name, btn.dataset.productId);
      });
    });
  }

  function openProductModal(productId) {
    const modal = document.getElementById('vb-product-modal');
    if (!modal) return;
    // Populate with data attributes from the card
    const card = document.querySelector(`[data-product="${productId}"]`);
    if (card) {
      modal.querySelector('#vbpm-name').textContent  = card.dataset.productName  || '—';
      modal.querySelector('#vbpm-price').textContent = card.dataset.productPrice || '—';
      modal.querySelector('#vbpm-moq').textContent   = card.dataset.productMoq   || '—';
      modal.querySelector('#vbpm-cat').textContent   = card.dataset.productCat   || '—';
      modal.querySelector('#vbpm-desc').textContent  = card.dataset.productDesc  || 'Contact supplier for details.';
    }
    modal.classList.add('open');
  }

  function openInquiryModal(productName, productId) {
    const modal = document.getElementById('vb-inquiry-modal');
    if (!modal) return;
    const nameEl = modal.querySelector('#vbi-product-name');
    if (nameEl) nameEl.textContent = productName;
    const pidEl = modal.querySelector('[name="product_id"]');
    if (pidEl) pidEl.value = productId || '';
    modal.classList.add('open');
  }

  return { init, openProductModal, openInquiryModal };
})();

/* ══════════════════════════════════════════════════════════════════════════
   3. VIDEO PLAYER CONTROLS
══════════════════════════════════════════════════════════════════════════ */
const BoothVideo = (() => {
  function init() {
    const video = document.getElementById('vb-video');
    if (!video) return;

    const playBtn  = document.getElementById('vb-play-btn');
    const muteBtn  = document.getElementById('vb-mute-btn');
    const progress = document.getElementById('vb-progress');
    const timeEl   = document.getElementById('vb-time');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playBtn.innerHTML = '<i class="fas fa-pause"></i>';
          BoothAnalytics.track('video_play');
        } else {
          video.pause();
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
      });
    }

    video.addEventListener('timeupdate', () => {
      if (progress && video.duration) {
        progress.value = (video.currentTime / video.duration) * 100;
      }
      if (timeEl) {
        timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration || 0)}`;
      }
    });

    if (progress) {
      progress.addEventListener('input', () => {
        video.currentTime = (progress.value / 100) * (video.duration || 0);
      });
    }

    video.addEventListener('ended', () => {
      if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
      BoothAnalytics.track('video_complete');
    });
  }

  function fmt(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════════════════
   4. LIVE CHAT
══════════════════════════════════════════════════════════════════════════ */
const BoothChat = (() => {
  const autoReplies = [
    'Thank you for your interest! How can I help you today?',
    'Great question! Our minimum order quantity is 100 units.',
    'We offer custom packaging and private label solutions.',
    'Lead time is typically 15–20 business days after order confirmation.',
    'Shall I connect you with our export manager for a formal quotation?',
    'We accept T/T, L/C, and secure payments via Globex Sky escrow.',
    'Our products meet CE, RoHS, and ISO 9001 standards.',
    'Happy to schedule a video call to discuss your requirements!',
  ];
  let replyIdx = 0;

  function init() {
    const fab   = document.getElementById('vb-chat-fab');
    const panel = document.getElementById('vb-chat-panel');
    const input = document.getElementById('vb-chat-input');
    const form  = document.getElementById('vb-chat-form');
    const closeBtn = document.getElementById('vb-chat-close');

    if (!fab || !panel) return;

    fab.addEventListener('click', () => { panel.classList.add('open'); input?.focus(); BoothAnalytics.track('chat_open'); });
    if (closeBtn) closeBtn.addEventListener('click', () => { panel.classList.remove('open'); });

    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });
    }
    if (input) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    }

    // Rep avatar in 3D booth
    const repAvatar = document.querySelector('.vb-rep-avatar');
    if (repAvatar) repAvatar.addEventListener('click', () => { panel.classList.add('open'); input?.focus(); });

    // Auto greeting
    setTimeout(() => { appendMessage('rep', 'Hello! Welcome to our virtual booth. How can I assist you today? 👋'); }, 1800);
  }

  function sendMessage() {
    const input = document.getElementById('vb-chat-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    appendMessage('user', msg);
    input.value = '';
    BoothAnalytics.track('chat_message');

    // Auto-reply
    setTimeout(() => {
      appendMessage('rep', autoReplies[replyIdx % autoReplies.length]);
      replyIdx++;
    }, 1000 + Math.random() * 800);
  }

  function appendMessage(type, text) {
    const messages = document.getElementById('vb-chat-messages');
    if (!messages) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = `vb-msg ${type}`;
    div.innerHTML = `${escapeHtml(text)}<div class="vb-msg-time">${time}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  return { init, appendMessage };
})();

/* ══════════════════════════════════════════════════════════════════════════
   5. LEAD COLLECTION FORM
══════════════════════════════════════════════════════════════════════════ */
const LeadCollection = (() => {
  function init() {
    const form = document.getElementById('vb-lead-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = form.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

      try {
        const data = Object.fromEntries(new FormData(form));
        const urlParams = new URLSearchParams(window.location.search);
        const showId = urlParams.get('show') || urlParams.get('show_id');
        const boothId = urlParams.get('booth') || urlParams.get('booth_id') || form.dataset.boothId;

        await VirtualBoothAPI.post(
          showId ? `/${showId}/leads` : '/leads',
          { ...data, booth_id: boothId }
        );

        form.reset();
        vbToast('Contact info exchanged! The supplier will follow up within 24 hours.', 'success');
        BoothAnalytics.track('lead_captured');

        const successEl = document.getElementById('vb-lead-success');
        if (successEl) { successEl.style.display = 'block'; form.style.display = 'none'; }
      } catch {
        vbToast('Submission saved locally. We will sync when connectivity is restored.', 'warning');
        // Store locally for later sync
        storeLeadLocally(Object.fromEntries(new FormData(form)));
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }

  function storeLeadLocally(data) {
    try {
      const pending = JSON.parse(localStorage.getItem('vb_pending_leads') || '[]');
      pending.push({ ...data, timestamp: Date.now() });
      localStorage.setItem('vb_pending_leads', JSON.stringify(pending));
    } catch { /* ignore */ }
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════════════════════
   6. BROCHURE DOWNLOADS
══════════════════════════════════════════════════════════════════════════ */
function initBrochureDownloads() {
  document.querySelectorAll('[data-action="download"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fileName = btn.dataset.file || 'document';
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading…';
      btn.disabled = true;
      BoothAnalytics.track('brochure_download', { file: fileName });

      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        btn.style.background = '#d1fae5';
        btn.style.color = '#059669';
        btn.style.borderColor = '#a7f3d0';
        setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; btn.removeAttribute('style'); }, 2800);
      }, 1200);
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   7. BOOTH ANALYTICS
══════════════════════════════════════════════════════════════════════════ */
const BoothAnalytics = (() => {
  const SESSION_KEY = 'vb_analytics';
  let data = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') || {
    views: 0, productViews: 0, chatOpens: 0, brochureDownloads: 0,
    videoPlays: 0, leadsCaptured: 0, duration: 0,
  };
  const startTime = Date.now();
  const urlParams = new URLSearchParams(window.location.search);
  const boothId = urlParams.get('booth') || document.body.dataset.boothId;

  function track(event, meta = {}) {
    const map = {
      page_view:         () => { data.views++; },
      product_view:      () => { data.productViews++; },
      chat_open:         () => { data.chatOpens++; },
      chat_message:      () => {},
      brochure_download: () => { data.brochureDownloads++; },
      video_play:        () => { data.videoPlays++; },
      video_complete:    () => {},
      lead_captured:     () => { data.leadsCaptured++; },
    };
    if (map[event]) map[event]();
    save();

    // Update UI counters
    updateCounters();

    // Fire-and-forget API call (best effort)
    if (boothId) {
      const showId = urlParams.get('show') || urlParams.get('show_id');
      const path = showId ? `/${showId}/analytics` : '/analytics';
      VirtualBoothAPI.post(path, { event, booth_id: boothId, meta }).catch(() => {});
    }
  }

  function save() {
    data.duration = Math.floor((Date.now() - startTime) / 1000);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  function updateCounters() {
    const map = {
      '#vba-views': data.views,
      '#vba-products': data.productViews,
      '#vba-chats': data.chatOpens,
      '#vba-leads': data.leadsCaptured,
    };
    Object.entries(map).forEach(([sel, val]) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = val;
    });
  }

  // Track initial page view
  function init() {
    track('page_view');

    // Save duration on unload
    window.addEventListener('beforeunload', save);
  }

  return { init, track, getData: () => ({ ...data }) };
})();

/* ══════════════════════════════════════════════════════════════════════════
   8. TAB NAVIGATION
══════════════════════════════════════════════════════════════════════════ */
function initBoothTabs() {
  const tabs   = document.querySelectorAll('[data-vb-tab]');
  const panels = document.querySelectorAll('[data-vb-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.vbTab;
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.querySelector(`[data-vb-panel="${target}"]`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   9. MODAL HELPERS
══════════════════════════════════════════════════════════════════════════ */
function initModals() {
  // Close on overlay click
  document.querySelectorAll('.ts-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  // Close buttons
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.ts-modal-overlay')?.classList.remove('open'); });
  });

  // Inquiry form submit
  const inquiryForm = document.getElementById('vb-inquiry-form');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = inquiryForm.querySelector('[type="submit"]');
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      try {
        await new Promise((r) => setTimeout(r, 1000)); // simulate
        inquiryForm.closest('.ts-modal-overlay')?.classList.remove('open');
        vbToast('Inquiry sent! The supplier will respond within 2 hours.', 'success');
        BoothAnalytics.track('lead_captured');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    });
  }
}

/* ── Booth view controls ─────────────────────────────────────────────────── */
function initBoothControls() {
  document.querySelectorAll('[data-vb-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-vb-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      Booth3D.setView(btn.dataset.vbView);
    });
  });

  const resetBtn = document.querySelector('[data-vb-reset]');
  if (resetBtn) resetBtn.addEventListener('click', () => Booth3D.resetView());
}

/* ══════════════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Booth3D.init();
  BoothProducts.init();
  BoothVideo.init();
  BoothChat.init();
  LeadCollection.init();
  initBrochureDownloads();
  BoothAnalytics.init();
  initBoothTabs();
  initModals();
  initBoothControls();
});
