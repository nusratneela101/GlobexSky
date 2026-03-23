/**
 * LiveStreamViewer – GlobexSky
 * Agora Web SDK 4.x viewer (audience) module.
 *
 * Usage:
 *   const viewer = new LiveStreamViewer('video-container');
 *   await viewer.init(channelName, token);
 *   viewer.setupChat(streamId);
 */

class LiveStreamViewer {
  /**
   * @param {string} videoContainerId  ID of the element to render remote video into
   */
  constructor(videoContainerId = 'video-container') {
    this._containerId   = videoContainerId;
    this._client        = null;
    this._joined        = false;
    this._ws            = null;
    this._streamId      = null;
    this._chatCallbacks = [];
    this._productCallbacks = [];
    this._giftCallbacks = [];
    this._viewerCount   = 0;
    this._likeCount     = 0;
  }

  /* ─────────────────────────────────────────────────────────────────────
     Core – join as audience
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Initialise the Agora client and join the channel as an audience member.
   * @param {string} channelName
   * @param {string|null} token
   * @param {number} [uid=0]
   */
  async init(channelName, token = null, uid = 0) {
    const AgoraRTC = this._getSDK();
    if (!AgoraRTC) {
      this._showFallback('Agora SDK not loaded. Please include the Agora Web SDK script.');
      return;
    }

    const appId = window.AGORA_APP_ID || '';
    if (!appId) {
      this._showFallback('Agora App ID not configured (window.AGORA_APP_ID).');
      return;
    }

    this._client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
    this._client.setClientRole('audience');

    this._client.on('user-published', async (user, mediaType) => {
      await this._client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        user.videoTrack.play(this._containerId);
      }
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
    });

    this._client.on('user-unpublished', (user) => {
      this._log(`Host ${user.uid} stopped streaming.`);
    });

    this._client.on('user-left', (user) => {
      this._log(`User ${user.uid} left the channel.`);
    });

    try {
      await this._client.join(appId, channelName, token, uid);
      this._joined = true;
      this._log(`Joined channel: ${channelName}`);
    } catch (err) {
      this._showFallback(`Could not join stream: ${err.message}`);
    }
  }

  /**
   * Leave the channel and clean up.
   */
  async leave() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    if (this._client && this._joined) {
      await this._client.leave();
      this._joined = false;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     Chat – WebSocket integration
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Open a WebSocket connection for live chat.
   * @param {string} streamId
   */
  setupChat(streamId) {
    this._streamId = streamId;
    const wsBase = (window.location.protocol === 'https:' ? 'wss' : 'ws') +
      '://' + window.location.host;
    const url = `${wsBase}/ws/livestream/${streamId}/chat`;

    const connect = () => {
      this._ws = new WebSocket(url);

      this._ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'chat') {
            this._chatCallbacks.forEach(cb => cb(payload.data));
            this._renderChatMessage(payload.data);
          } else if (payload.type === 'product_pin') {
            this._productCallbacks.forEach(cb => cb(payload.data));
            this._renderPinnedProduct(payload.data);
          } else if (payload.type === 'gift') {
            this._giftCallbacks.forEach(cb => cb(payload.data));
            this._renderGiftAnimation(payload.data);
          } else if (payload.type === 'viewer_count') {
            this._viewerCount = payload.count;
            this._updateViewerCount(payload.count);
          } else if (payload.type === 'coupon') {
            this._renderCouponOverlay(payload.data);
          }
        } catch (_) { /* ignore malformed frames */ }
      };

      this._ws.onclose = () => {
        // Auto-reconnect after 3 seconds if still watching
        if (this._joined) setTimeout(connect, 3000);
      };
    };

    connect();
  }

  /**
   * Send a chat message via the REST API.
   * @param {string} message
   * @param {string} authToken  JWT bearer token
   */
  async sendChatMessage(message, authToken) {
    if (!this._streamId) return;
    const res = await fetch(`/api/v1/livestream/${this._streamId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to send chat message');
    return res.json();
  }

  /* ─────────────────────────────────────────────────────────────────────
     Reactions & gifts
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Send an emoji reaction.
   * @param {string} emoji
   */
  sendReaction(emoji) {
    this._floatEmoji(emoji);
  }

  /**
   * Send a virtual gift.
   * @param {string} giftType  e.g. 'heart', 'star', 'fireworks'
   * @param {string} authToken
   */
  async sendGift(giftType, authToken) {
    if (!this._streamId) return;
    const res = await fetch(`/api/v1/livestream/${this._streamId}/gift`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ gift_type: giftType, amount: 1 }),
    });
    if (!res.ok) throw new Error('Failed to send gift');
    this._renderGiftAnimation({ gift_type: giftType });
    return res.json();
  }

  /* ─────────────────────────────────────────────────────────────────────
     Product showcase
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Register a callback that fires whenever the host pins a product.
   * @param {function} callback
   */
  onProductPinned(callback) {
    this._productCallbacks.push(callback);
  }

  /**
   * Quick add-to-cart from the live stream without leaving the page.
   * @param {string} productId
   * @param {string} authToken
   */
  async addToCartFromStream(productId, authToken) {
    const res = await fetch('/api/v1/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ product_id: productId, quantity: 1 }),
    });
    if (!res.ok) throw new Error('Could not add to cart');
    this._showToast('Added to cart!', 'cart-shopping');
    return res.json();
  }

  /* ─────────────────────────────────────────────────────────────────────
     Private UI helpers
  ───────────────────────────────────────────────────────────────────── */

  _getSDK() {
    return typeof AgoraRTC !== 'undefined' ? AgoraRTC : null;
  }

  _log(msg) {
    console.info('[LiveStreamViewer]', msg);
  }

  _showFallback(msg) {
    const container = document.getElementById(this._containerId);
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100%;background:#0d1117;color:#8b949e;text-align:center;padding:24px;gap:12px">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#ef4444"></i>
        <p style="font-size:.9rem;max-width:400px">${msg}</p>
        <p style="font-size:.8rem">Try refreshing the page or use a modern browser (Chrome, Firefox, Edge).</p>
      </div>`;
  }

  _renderChatMessage(msg) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `
      <span class="chat-author">${this._esc(msg.user?.full_name || 'Guest')}</span>
      <span class="chat-text">${this._esc(msg.message)}</span>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  _renderPinnedProduct(product) {
    const carousel = document.getElementById('featured-products');
    if (!carousel) return;
    const card = document.createElement('div');
    card.className = 'stream-product-card pinned';
    card.dataset.productId = product.id;
    card.innerHTML = `
      <div class="pin-badge"><i class="fas fa-thumbtack"></i> Featured</div>
      <img src="${this._esc(product.images?.[0] || '')}" alt="${this._esc(product.name)}"
           onerror="this.src='../../assets/images/placeholder.png'"/>
      <div class="sp-name">${this._esc(product.name)}</div>
      <div class="sp-price">$${parseFloat(product.price || 0).toFixed(2)}</div>
      <button class="btn btn-buy-now" data-product-id="${this._esc(product.id)}">
        <i class="fas fa-bolt"></i> Buy Now
      </button>`;
    carousel.prepend(card);
  }

  _renderGiftAnimation(gift) {
    const emojis = { heart: '❤️', star: '⭐', fireworks: '🎆', diamond: '💎', crown: '👑' };
    const emoji = emojis[gift.gift_type] || '🎁';
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this._floatEmoji(emoji), i * 120);
    }
  }

  _floatEmoji(emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    const left = 10 + Math.random() * 80;
    el.style.cssText = `
      position:fixed;bottom:80px;left:${left}%;font-size:2rem;
      pointer-events:none;z-index:9999;animation:floatUp 2s ease-out forwards`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  _renderCouponOverlay(coupon) {
    const overlay = document.createElement('div');
    overlay.id = 'coupon-overlay';
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:linear-gradient(135deg,#0052CC,#7c3aed);color:#fff;
      padding:28px 40px;border-radius:16px;text-align:center;z-index:9999;
      box-shadow:0 20px 60px rgba(0,0,0,.5)`;
    const seconds = coupon.expiry_seconds || 30;
    overlay.innerHTML = `
      <div style="font-size:1rem;opacity:.8;margin-bottom:6px">🎉 Limited-Time Offer</div>
      <div style="font-family:'Poppins',sans-serif;font-size:2rem;font-weight:700;letter-spacing:4px;
                  margin:8px 0">${this._esc(coupon.code)}</div>
      <div style="font-size:1.3rem;font-weight:700">${parseFloat(coupon.discount) || 0}% OFF</div>
      <div id="coupon-timer" style="margin-top:12px;font-size:1.5rem;font-weight:700;color:#fde68a">
        ${seconds}s
      </div>
      <button onclick="document.getElementById('coupon-overlay').remove()"
              style="margin-top:12px;background:rgba(255,255,255,.2);border:none;color:#fff;
                     padding:8px 20px;border-radius:20px;cursor:pointer;font-size:.85rem">
        Dismiss
      </button>`;
    document.body.appendChild(overlay);
    let remaining = seconds;
    const tick = setInterval(() => {
      remaining--;
      const timerEl = document.getElementById('coupon-timer');
      if (timerEl) timerEl.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(tick);
        overlay.remove();
      }
    }, 1000);
  }

  _updateViewerCount(count) {
    const el = document.getElementById('viewer-count');
    if (el) el.textContent = count.toLocaleString();
  }

  _showToast(msg, icon = 'check') {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#22c55e;color:#fff;padding:10px 24px;border-radius:20px;
      font-weight:600;font-size:.85rem;z-index:9999;animation:fadeIn .3s`;
    t.innerHTML = `<i class="fas fa-${icon}" style="margin-right:8px"></i>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

/* Inject float-up keyframes once */
(function () {
  if (document.getElementById('_gs-float-keyframes')) return;
  const style = document.createElement('style');
  style.id = '_gs-float-keyframes';
  style.textContent = `
    @keyframes floatUp {
      0%   { opacity:1; transform:translateY(0) scale(1); }
      100% { opacity:0; transform:translateY(-120px) scale(1.4); }
    }
    @keyframes fadeIn {
      from { opacity:0; transform:translate(-50%,8px); }
      to   { opacity:1; transform:translateX(-50%); }
    }`;
  document.head.appendChild(style);
})();

window.LiveStreamViewer = LiveStreamViewer;
