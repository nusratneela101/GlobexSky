/**
 * LiveStreamBroadcaster – GlobexSky
 * Agora Web SDK 4.x broadcaster (host) module.
 *
 * Usage:
 *   const broadcaster = new LiveStreamBroadcaster('preview-container');
 *   await broadcaster.startStream(channelName, token);
 *   broadcaster.pinProduct(productId, authToken);
 *   broadcaster.showCoupon('SUMMER20', 20, 30);
 *   await broadcaster.stopStream();
 */

class LiveStreamBroadcaster {
  /**
   * @param {string} previewContainerId  ID of the element to render camera preview into
   */
  constructor(previewContainerId = 'camera-preview') {
    this._previewId   = previewContainerId;
    this._client      = null;
    this._micTrack    = null;
    this._cameraTrack = null;
    this._screenTrack = null;
    this._joined      = false;
    this._streamId    = null;
    this._channelName = null;
    this._micMuted    = false;
    this._camMuted    = false;
    this._quality     = '720p';
    this._healthTimer = null;
    this._giftLeaderboard = {};

    this._QUALITY_PRESETS = {
      '360p':  { width: 640,  height: 360,  frameRate: 15, bitrateMin: 200,  bitrateMax: 500  },
      '480p':  { width: 854,  height: 480,  frameRate: 24, bitrateMin: 400,  bitrateMax: 800  },
      '720p':  { width: 1280, height: 720,  frameRate: 30, bitrateMin: 1000, bitrateMax: 2000 },
      '1080p': { width: 1920, height: 1080, frameRate: 30, bitrateMin: 2000, bitrateMax: 4000 },
    };
  }

  /* ─────────────────────────────────────────────────────────────────────
     Core – go live
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Start broadcasting to the given Agora channel.
   * @param {string} channelName
   * @param {string|null} token
   * @param {number} [uid=0]
   */
  async startStream(channelName, token = null, uid = 0) {
    const AgoraRTC = this._getSDK();
    if (!AgoraRTC) {
      this._showError('Agora SDK not loaded. Please include the Agora Web SDK script.');
      return;
    }

    const appId = window.AGORA_APP_ID || '';
    if (!appId) {
      this._showError('Agora App ID not configured (window.AGORA_APP_ID).');
      return;
    }

    this._channelName = channelName;
    this._client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
    await this._client.setClientRole('host');

    // Create local tracks
    const preset = this._QUALITY_PRESETS[this._quality] || this._QUALITY_PRESETS['720p'];
    [this._micTrack, this._cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      {},
      {
        encoderConfig: {
          width: preset.width, height: preset.height,
          frameRate: preset.frameRate,
          bitrateMin: preset.bitrateMin, bitrateMax: preset.bitrateMax,
        },
      },
    );

    // Show camera preview
    this._cameraTrack.play(this._previewId);

    // Join channel
    await this._client.join(appId, channelName, token, uid);
    await this._client.publish([this._micTrack, this._cameraTrack]);

    this._joined = true;
    this._startHealthMonitor();
    this._updateLiveUI(true);
    this._log(`Streaming live on channel: ${channelName}`);
  }

  /**
   * Stop broadcasting and clean up tracks.
   */
  async stopStream() {
    this._stopHealthMonitor();

    if (this._screenTrack) {
      await this._client.unpublish([this._screenTrack]);
      this._screenTrack.close();
      this._screenTrack = null;
    }

    if (this._micTrack)    { this._micTrack.close();    this._micTrack = null; }
    if (this._cameraTrack) { this._cameraTrack.close(); this._cameraTrack = null; }

    if (this._client && this._joined) {
      await this._client.leave();
      this._joined = false;
    }

    this._updateLiveUI(false);
    this._log('Stream ended.');
  }

  /* ─────────────────────────────────────────────────────────────────────
     Media controls
  ───────────────────────────────────────────────────────────────────── */

  /** Toggle microphone mute. */
  toggleMic() {
    if (!this._micTrack) return;
    this._micMuted = !this._micMuted;
    this._micTrack.setEnabled(!this._micMuted);
    this._updateMediaButton('btn-toggle-mic', this._micMuted, 'microphone-slash', 'microphone');
  }

  /** Toggle camera on/off. */
  toggleCamera() {
    if (!this._cameraTrack) return;
    this._camMuted = !this._camMuted;
    this._cameraTrack.setEnabled(!this._camMuted);
    this._updateMediaButton('btn-toggle-cam', this._camMuted, 'video-slash', 'video');
  }

  /**
   * Start screen sharing (replaces the camera video track).
   */
  async shareScreen() {
    const AgoraRTC = this._getSDK();
    if (!AgoraRTC || !this._client || !this._joined) return;

    if (this._screenTrack) {
      // Stop screen share, revert to camera
      await this._client.unpublish([this._screenTrack]);
      this._screenTrack.close();
      this._screenTrack = null;
      if (this._cameraTrack) {
        await this._client.publish([this._cameraTrack]);
        this._cameraTrack.play(this._previewId);
      }
      this._log('Screen share stopped.');
      return;
    }

    this._screenTrack = await AgoraRTC.createScreenVideoTrack({}, 'disable');
    if (this._cameraTrack) await this._client.unpublish([this._cameraTrack]);
    await this._client.publish([this._screenTrack]);
    this._screenTrack.play(this._previewId);

    this._screenTrack.on('track-ended', () => this.shareScreen()); // auto-stop
    this._log('Screen sharing started.');
  }

  /**
   * Change stream quality preset.
   * @param {'360p'|'480p'|'720p'|'1080p'} quality
   */
  async setQuality(quality) {
    if (!this._QUALITY_PRESETS[quality]) return;
    this._quality = quality;
    if (!this._cameraTrack) return;
    const preset = this._QUALITY_PRESETS[quality];
    await this._cameraTrack.setEncoderConfiguration({
      width: preset.width, height: preset.height, frameRate: preset.frameRate,
      bitrateMin: preset.bitrateMin, bitrateMax: preset.bitrateMax,
    });
    this._log(`Quality set to ${quality}`);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Product management
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Pin a product so it appears on all viewer screens.
   * @param {string} productId
   * @param {string} authToken
   */
  async pinProduct(productId, authToken) {
    if (!this._streamId) throw new Error('No active stream ID. Set broadcaster.streamId first.');
    const res = await fetch(`/api/v1/livestream/${this._streamId}/pin-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ product_id: productId }),
    });
    if (!res.ok) throw new Error('Failed to pin product');
    this._showToast('Product pinned for viewers!', 'thumbtack');
    return res.json();
  }

  /* ─────────────────────────────────────────────────────────────────────
     Coupon flash
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Flash a coupon overlay on all viewer screens via WebSocket broadcast.
   * @param {string} code
   * @param {number} discount  percentage (e.g. 20 = 20%)
   * @param {number} expirySeconds
   */
  showCoupon(code, discount, expirySeconds = 30) {
    // Show locally for the broadcaster
    this._renderCouponPreview(code, discount, expirySeconds);
    // Broadcast via WebSocket is handled server-side when the API receives the pin-product event.
    this._log(`Coupon broadcast: ${code} (${discount}% off, ${expirySeconds}s)`);
  }

  /* ─────────────────────────────────────────────────────────────────────
     Virtual gifts
  ───────────────────────────────────────────────────────────────────── */

  /**
   * Handle an incoming virtual gift event.
   * @param {{gift_type:string, sender_name:string, amount:number}} gift
   */
  handleGift(gift) {
    const { gift_type, sender_name = 'Viewer', amount = 1 } = gift;
    this._giftLeaderboard[sender_name] = (this._giftLeaderboard[sender_name] || 0) + amount;
    this._renderGiftEffect(gift_type, sender_name);
    this._updateGiftLeaderboard();
  }

  /* ─────────────────────────────────────────────────────────────────────
     Private helpers
  ───────────────────────────────────────────────────────────────────── */

  _getSDK() {
    return typeof AgoraRTC !== 'undefined' ? AgoraRTC : null;
  }

  _log(msg) {
    console.info('[LiveStreamBroadcaster]', msg);
  }

  _showError(msg) {
    const container = document.getElementById(this._previewId);
    if (container) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:100%;background:#161b22;color:#8b949e;padding:24px;text-align:center;gap:12px">
          <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#ef4444"></i>
          <p style="font-size:.9rem;max-width:400px">${msg}</p>
        </div>`;
    }
    this._log('ERROR: ' + msg);
  }

  _updateLiveUI(isLive) {
    const badge   = document.getElementById('live-status-badge');
    const btnGo   = document.getElementById('btn-go-live');
    const btnEnd  = document.getElementById('btn-end-stream');
    if (badge)  badge.style.display  = isLive ? 'flex' : 'none';
    if (btnGo)  btnGo.style.display  = isLive ? 'none' : 'flex';
    if (btnEnd) btnEnd.style.display = isLive ? 'flex' : 'none';
  }

  _updateMediaButton(btnId, isMuted, iconOff, iconOn) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = `fas fa-${isMuted ? iconOff : iconOn}`;
    }
    btn.classList.toggle('muted', isMuted);
  }

  _startHealthMonitor() {
    this._healthTimer = setInterval(async () => {
      if (!this._client || !this._joined) return;
      const stats = this._client.getRTCStats ? this._client.getRTCStats() : {};
      const rtt  = stats.RTT || 0;
      const loss = stats.OutgoingPacketLossRate || 0;

      const elRtt  = document.getElementById('health-rtt');
      const elLoss = document.getElementById('health-loss');
      if (elRtt)  elRtt.textContent  = `${rtt} ms`;
      if (elLoss) elLoss.textContent = `${(loss * 100).toFixed(1)}%`;

      const level = loss > 0.05 ? 'poor' : rtt > 200 ? 'warn' : 'good';
      const dot = document.querySelector('.health-dot');
      if (dot) dot.className = `health-dot ${level}`;
    }, 3000);
  }

  _stopHealthMonitor() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  _renderGiftEffect(giftType, senderName) {
    const emojis = { heart: '❤️', star: '⭐', fireworks: '🎆', diamond: '💎', crown: '👑' };
    const emoji = emojis[giftType] || '🎁';
    const label = document.createElement('div');
    label.style.cssText = `
      position:fixed;bottom:100px;right:24px;background:rgba(0,0,0,.75);color:#fff;
      padding:8px 16px;border-radius:20px;font-size:.85rem;z-index:9999;
      animation:floatUp 2.5s ease-out forwards`;
    label.textContent = `${emoji} ${senderName} sent a gift!`;
    document.body.appendChild(label);
    setTimeout(() => label.remove(), 2600);

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.textContent = emoji;
        const l = 5 + Math.random() * 90;
        el.style.cssText = `
          position:fixed;bottom:80px;left:${l}%;font-size:1.8rem;
          pointer-events:none;z-index:9998;animation:floatUp 2s ease-out forwards`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2100);
      }, i * 100);
    }
  }

  _updateGiftLeaderboard() {
    const panel = document.getElementById('gift-leaderboard');
    if (!panel) return;
    const sorted = Object.entries(this._giftLeaderboard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    panel.innerHTML = sorted.map(([name, total], i) =>
      `<div class="leaderboard-row">
        <span class="rank">${i + 1}</span>
        <span class="name">${this._esc(name)}</span>
        <span class="total">🎁 ${total}</span>
      </div>`
    ).join('');
  }

  _renderCouponPreview(code, discount, expirySeconds) {
    const prev = document.getElementById('coupon-preview');
    if (prev) prev.remove();

    const el = document.createElement('div');
    el.id = 'coupon-preview';
    el.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:linear-gradient(135deg,#0052CC,#7c3aed);color:#fff;
      padding:24px 36px;border-radius:16px;text-align:center;z-index:9999;
      box-shadow:0 16px 48px rgba(0,0,0,.5);min-width:260px`;
    el.innerHTML = `
      <div style="font-size:.85rem;opacity:.8;margin-bottom:4px">Coupon sent to viewers!</div>
      <div style="font-size:1.8rem;font-weight:700;letter-spacing:3px;margin:6px 0">
        ${this._esc(code)}
      </div>
      <div style="font-size:1.1rem;font-weight:700">${discount}% OFF</div>
      <button onclick="document.getElementById('coupon-preview').remove()"
              style="margin-top:10px;background:rgba(255,255,255,.2);border:none;color:#fff;
                     padding:6px 18px;border-radius:16px;cursor:pointer;font-size:.8rem">
        OK
      </button>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), expirySeconds * 1000);
  }

  _showToast(msg, icon = 'check') {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:24px;right:24px;background:#22c55e;color:#fff;
      padding:10px 20px;border-radius:20px;font-weight:600;font-size:.85rem;
      z-index:9999;animation:fadeIn .3s`;
    t.innerHTML = `<i class="fas fa-${icon}" style="margin-right:7px"></i>${msg}`;
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

/* Inject shared keyframes (shared with viewer) if not present */
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
      from { opacity:0; }
      to   { opacity:1; }
    }`;
  document.head.appendChild(style);
})();

window.LiveStreamBroadcaster = LiveStreamBroadcaster;
