/**
 * Globex Sky – Livestream Module (Agora Web SDK 4.x)
 *
 * Supports host mode (publish) and viewer mode (subscribe).
 * Exposes window.LiveStream for use by page scripts.
 *
 * Usage:
 *   await LiveStream.init({ appId, channel, token, uid, role: 'host'|'audience' });
 *   LiveStream.setQuality('720p');
 *   LiveStream.toggleMic();
 *   LiveStream.toggleCamera();
 *   LiveStream.shareScreen();
 *   LiveStream.startRecording();
 *   await LiveStream.leave();
 */

(function () {
  'use strict';

  /* ── WebRTC capability check ─────────────────────────────────────────── */
  const WEBRTC_SUPPORTED =
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined';

  /* ── Agora SDK availability check ────────────────────────────────────── */
  function getAgoraSDK() {
    if (typeof AgoraRTC !== 'undefined') return AgoraRTC;
    return null;
  }

  /* ── Quality presets ─────────────────────────────────────────────────── */
  const QUALITY_PRESETS = {
    '360p':  { width: 640,  height: 360,  frameRate: 15, bitrate: 400 },
    '480p':  { width: 854,  height: 480,  frameRate: 24, bitrate: 600 },
    '720p':  { width: 1280, height: 720,  frameRate: 30, bitrate: 1500 },
    '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 3000 },
  };

  /* ── State ───────────────────────────────────────────────────────────── */
  let _client       = null;
  let _localAudio   = null;
  let _localVideo   = null;
  let _screenTrack  = null;
  let _isHost       = false;
  let _joined       = false;
  let _micEnabled   = true;
  let _camEnabled   = true;
  let _quality      = '720p';
  let _healthTimer  = null;
  let _recordingActive = false;
  let _onRemoteUser = null;
  let _onUserLeft   = null;
  let _onHealthUpdate = null;

  /* ── Internal helpers ────────────────────────────────────────────────── */
  function _log(msg) { console.info('[LiveStream]', msg); }
  function _warn(msg) { console.warn('[LiveStream]', msg); }

  function _showNoWebRTCUI() {
    const containers = document.querySelectorAll('[data-livestream-player]');
    containers.forEach(el => {
      el.innerHTML = `
        <div class="no-webrtc-notice">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Live Streaming Not Supported</h3>
          <p>Your browser does not support WebRTC required for live streaming.<br>
          Please use a modern browser such as Chrome, Firefox, or Edge.</p>
        </div>`;
    });
  }

  function _updateQualityBadge(level) {
    const badge = document.getElementById('streamQualityBadge');
    if (!badge) return;
    const dot = badge.querySelector('.quality-dot');
    if (dot) {
      dot.className = 'quality-dot' + (level === 'good' ? '' : level === 'warn' ? ' warn' : ' poor');
    }
  }

  /* ── Health monitoring ───────────────────────────────────────────────── */
  async function _collectHealthStats() {
    if (!_client || !_joined) return;
    try {
      const stats = _client.getRTCStats ? _client.getRTCStats() : {};
      const bitrate   = stats.OutgoingAvailableBandwidth || 0;
      const rtt       = stats.RTT || 0;
      const packLoss  = stats.OutgoingPacketLossRate || 0;

      // Update UI elements
      const elBitrate  = document.getElementById('healthBitrate');
      const elLatency  = document.getElementById('healthLatency');
      const elPktLoss  = document.getElementById('healthPacketLoss');
      if (elBitrate)  elBitrate.textContent  = bitrate ? `${Math.round(bitrate)} kbps` : '—';
      if (elLatency)  elLatency.textContent  = rtt     ? `${rtt} ms`                  : '—';
      if (elPktLoss)  elPktLoss.textContent  = packLoss ? `${(packLoss*100).toFixed(1)}%` : '0%';

      const level = packLoss > 0.05 ? 'poor' : rtt > 200 ? 'warn' : 'good';
      _updateQualityBadge(level);

      if (typeof _onHealthUpdate === 'function') {
        _onHealthUpdate({ bitrate, rtt, packLoss, level });
      }
    } catch (e) { /* stats not always available */ }
  }

  /* ── Remote user handling ────────────────────────────────────────────── */
  function _bindClientEvents() {
    if (!_client) return;

    _client.on('user-published', async (user, mediaType) => {
      await _client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        const container = document.getElementById('remoteVideo') || document.querySelector('[data-livestream-player]');
        if (container) {
          user.videoTrack.play(container);
        }
      }
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
      if (typeof _onRemoteUser === 'function') {
        _onRemoteUser(user, mediaType);
      }
    });

    _client.on('user-unpublished', (user, mediaType) => {
      _log(`Remote user ${user.uid} unpublished ${mediaType}`);
    });

    _client.on('user-left', (user) => {
      _log(`Remote user ${user.uid} left`);
      if (typeof _onUserLeft === 'function') _onUserLeft(user);
    });

    _client.on('network-quality', (stats) => {
      const level = stats.downlinkNetworkQuality <= 2 ? 'good' :
                    stats.downlinkNetworkQuality <= 4 ? 'warn' : 'poor';
      _updateQualityBadge(level);
    });

    _client.on('exception', (event) => {
      _warn(`Exception: ${event.code} – ${event.msg}`);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════════ */

  const LiveStream = {

    /**
     * Check if the current browser supports WebRTC.
     */
    isSupported() { return WEBRTC_SUPPORTED; },

    /**
     * Initialize Agora client and optionally join a channel.
     *
     * @param {Object} opts
     * @param {string}  opts.appId     – Agora App ID (required)
     * @param {string}  opts.channel   – Channel name (required)
     * @param {string}  opts.token     – Agora RTC token (null for testing)
     * @param {number}  [opts.uid]     – User ID (0 = auto-assign)
     * @param {string}  [opts.role]    – 'host' | 'audience'
     * @param {string}  [opts.quality] – '360p' | '480p' | '720p' | '1080p'
     * @param {Function} [opts.onRemoteUser]
     * @param {Function} [opts.onUserLeft]
     * @param {Function} [opts.onHealthUpdate]
     */
    async init(opts = {}) {
      if (!WEBRTC_SUPPORTED) {
        _showNoWebRTCUI();
        throw new Error('WebRTC not supported in this browser');
      }

      const AgoraRTC = getAgoraSDK();
      if (!AgoraRTC) {
        _warn('Agora Web SDK not loaded. Make sure the CDN script is included.');
        throw new Error('Agora SDK not available');
      }

      const {
        appId,
        channel,
        token = null,
        uid   = 0,
        role  = 'audience',
        quality = '720p',
        onRemoteUser,
        onUserLeft,
        onHealthUpdate,
      } = opts;

      if (!appId)   throw new Error('appId is required');
      if (!channel) throw new Error('channel is required');

      _isHost   = (role === 'host');
      _quality  = quality in QUALITY_PRESETS ? quality : '720p';
      _onRemoteUser   = onRemoteUser   || null;
      _onUserLeft     = onUserLeft     || null;
      _onHealthUpdate = onHealthUpdate || null;

      AgoraRTC.setLogLevel(2); // warn level

      _client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      await _client.setClientRole(_isHost ? 'host' : 'audience');

      _bindClientEvents();

      await _client.join(appId, channel, token, uid);
      _joined = true;
      _log(`Joined channel "${channel}" as ${role}`);

      if (_isHost) {
        await this._publishLocalTracks();
      }

      // Start health monitoring
      _healthTimer = setInterval(_collectHealthStats, 3000);

      return _client;
    },

    /** Publish local audio + video (host only). */
    async _publishLocalTracks() {
      const AgoraRTC = getAgoraSDK();
      if (!AgoraRTC || !_isHost) return;

      const preset = QUALITY_PRESETS[_quality];

      _localAudio = await AgoraRTC.createMicrophoneAudioTrack();
      _localVideo = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width:     preset.width,
          height:    preset.height,
          frameRate: preset.frameRate,
          bitrateMax: preset.bitrate,
        },
      });

      // Play preview in local element
      const previewEl = document.getElementById('localVideo') ||
                        document.querySelector('[data-local-video]');
      if (previewEl) {
        _localVideo.play(previewEl.id || previewEl);
      }

      await _client.publish([_localAudio, _localVideo]);
      _log('Local tracks published');
    },

    /* ── Controls ──────────────────────────────────────────────────────── */

    /** Toggle local microphone on/off. Returns new state. */
    toggleMic() {
      if (!_localAudio) return false;
      _micEnabled = !_micEnabled;
      _localAudio.setEnabled(_micEnabled);
      const btn = document.getElementById('btnMic');
      if (btn) {
        btn.className = 'media-btn ' + (_micEnabled ? 'active' : 'inactive');
        btn.innerHTML = `<i class="fas fa-microphone${_micEnabled ? '' : '-slash'}"></i>`;
      }
      _log(`Mic ${_micEnabled ? 'enabled' : 'muted'}`);
      return _micEnabled;
    },

    /** Toggle local camera on/off. Returns new state. */
    toggleCamera() {
      if (!_localVideo) return false;
      _camEnabled = !_camEnabled;
      _localVideo.setEnabled(_camEnabled);
      const btn = document.getElementById('btnCam');
      if (btn) {
        btn.className = 'media-btn ' + (_camEnabled ? 'active' : 'inactive');
        btn.innerHTML = `<i class="fas fa-video${_camEnabled ? '' : '-slash'}"></i>`;
      }
      _log(`Camera ${_camEnabled ? 'enabled' : 'disabled'}`);
      return _camEnabled;
    },

    /**
     * Switch stream quality preset.
     * @param {'360p'|'480p'|'720p'|'1080p'} preset
     */
    async setQuality(preset) {
      if (!(preset in QUALITY_PRESETS)) return;
      _quality = preset;
      if (_localVideo) {
        const cfg = QUALITY_PRESETS[preset];
        await _localVideo.setEncoderConfiguration({
          width:     cfg.width,
          height:    cfg.height,
          frameRate: cfg.frameRate,
          bitrateMax: cfg.bitrate,
        });
        _log(`Quality set to ${preset}`);
      }
    },

    /**
     * Start screen sharing.
     * Replaces camera video with screen capture track.
     * Call stopScreenShare() to revert.
     */
    async shareScreen() {
      const AgoraRTC = getAgoraSDK();
      if (!AgoraRTC || !_isHost || !_joined) return;
      try {
        _screenTrack = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '1080p' });

        if (_localVideo) {
          await _client.unpublish(_localVideo);
          _localVideo.stop();
          _localVideo.close();
        }

        await _client.publish(_screenTrack);

        const previewEl = document.getElementById('localVideo') ||
                          document.querySelector('[data-local-video]');
        if (previewEl) _screenTrack.play(previewEl.id || previewEl);

        _screenTrack.on('track-ended', () => this.stopScreenShare());
        _log('Screen sharing started');
      } catch (e) {
        _warn('Screen share cancelled or denied: ' + e.message);
      }
    },

    /** Stop screen sharing and restore camera. */
    async stopScreenShare() {
      const AgoraRTC = getAgoraSDK();
      if (!_screenTrack || !AgoraRTC) return;
      try {
        await _client.unpublish(_screenTrack);
        _screenTrack.stop();
        _screenTrack.close();
        _screenTrack = null;

        // Restore camera
        const preset = QUALITY_PRESETS[_quality];
        _localVideo = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width:     preset.width,
            height:    preset.height,
            frameRate: preset.frameRate,
            bitrateMax: preset.bitrate,
          },
        });

        const previewEl = document.getElementById('localVideo') ||
                          document.querySelector('[data-local-video]');
        if (previewEl) _localVideo.play(previewEl.id || previewEl);

        await _client.publish(_localVideo);
        _log('Screen sharing stopped, camera restored');
      } catch (e) {
        _warn('stopScreenShare error: ' + e.message);
      }
    },

    /* ── Recording helpers (server-side recording via API) ─────────────── */

    /**
     * Toggle cloud recording for the stream.
     * Calls backend API endpoints.
     *
     * @param {string} streamId – livestream record ID
     * @param {string} authToken – JWT bearer token
     */
    async toggleRecording(streamId, authToken) {
      const endpoint = _recordingActive
        ? `/api/v1/livestreams/${streamId}/recording/stop`
        : `/api/v1/livestreams/${streamId}/recording/start`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();

      if (json.success) {
        _recordingActive = !_recordingActive;
        _log(`Recording ${_recordingActive ? 'started' : 'stopped'}`);

        const btn = document.getElementById('btnRecord');
        if (btn) {
          btn.style.background = _recordingActive ? '#ef4444' : '';
          btn.title = _recordingActive ? 'Stop Recording' : 'Start Recording';
        }
      }
      return json;
    },

    isRecording() { return _recordingActive; },

    /* ── Cleanup ────────────────────────────────────────────────────────── */

    /**
     * Leave the channel and release all local resources.
     */
    async leave() {
      if (_healthTimer) { clearInterval(_healthTimer); _healthTimer = null; }

      if (_screenTrack) { _screenTrack.stop(); _screenTrack.close(); _screenTrack = null; }
      if (_localAudio)  { _localAudio.stop();  _localAudio.close();  _localAudio  = null; }
      if (_localVideo)  { _localVideo.stop();  _localVideo.close();  _localVideo  = null; }

      if (_client && _joined) {
        await _client.leave();
        _log('Left channel');
      }
      _client  = null;
      _joined  = false;
      _isHost  = false;
    },

    /* ── Getters ────────────────────────────────────────────────────────── */
    get isHost()     { return _isHost; },
    get isJoined()   { return _joined; },
    get micEnabled() { return _micEnabled; },
    get camEnabled() { return _camEnabled; },
    get quality()    { return _quality; },
  };

  /* ── Fetch Agora token from backend ─────────────────────────────────── */
  LiveStream.fetchToken = async function (channel, uid, role, authToken) {
    const res = await fetch(
      `/api/v1/livestreams/agora-token?channel=${encodeURIComponent(channel)}&uid=${uid}&role=${role}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Token fetch failed');
    return json.data.token;
  };

  /* ── Browser cleanup ────────────────────────────────────────────────── */
  window.addEventListener('beforeunload', () => {
    if (_joined) LiveStream.leave();
  });

  window.LiveStream = LiveStream;
}());
