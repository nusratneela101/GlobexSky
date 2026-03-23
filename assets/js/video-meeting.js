/**
 * Globex Sky – Video Meeting Module (Agora Web SDK 4.x)
 *
 * Features:
 *   - One-on-one and small-group video calls
 *   - Meeting scheduling
 *   - Screen sharing & document sharing
 *   - Recording toggle (requires backend support)
 *   - Waiting room logic
 *   - Meeting notes & action items
 *
 * Exposes window.VideoMeeting.
 *
 * Usage:
 *   await VideoMeeting.init({ appId, channel, token, uid, meetingId, authToken });
 *   VideoMeeting.toggleMic();
 *   VideoMeeting.toggleCamera();
 *   VideoMeeting.shareScreen();
 *   await VideoMeeting.leave();
 */

(function () {
  'use strict';

  /* ── WebRTC check ────────────────────────────────────────────────── */
  const WEBRTC_SUPPORTED =
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined';

  function getAgoraSDK() {
    return (typeof AgoraRTC !== 'undefined') ? AgoraRTC : null;
  }

  /* ── State ───────────────────────────────────────────────────────── */
  let _client      = null;
  let _localAudio  = null;
  let _localVideo  = null;
  let _screenTrack = null;
  let _meetingId   = null;
  let _authToken   = null;
  let _joined      = false;
  let _micOn       = true;
  let _camOn       = true;
  let _recording   = false;
  let _waitingRoom = false;
  let _startTime   = null;
  let _timerInterval = null;
  let _participants  = new Map(); // uid → { uid, name, audioTrack, videoTrack }
  let _notes         = [];
  let _actionItems   = [];

  /* ── DOM helpers ─────────────────────────────────────────────────── */
  function qs(id)  { return document.getElementById(id); }

  function _showNoWebRTCUI() {
    const wrap = qs('meetingLayout') || document.querySelector('.meeting-layout');
    if (wrap) {
      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;flex:1;padding:40px">
          <div class="no-webrtc-notice">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Video Meetings Not Supported</h3>
            <p>Your browser does not support WebRTC required for video meetings.<br>
            Please use Chrome, Firefox, or Edge.</p>
          </div>
        </div>`;
    }
  }

  /* ── Timer ────────────────────────────────────────────────────────── */
  function _startTimer() {
    _startTime = Date.now();
    _timerInterval = setInterval(() => {
      const secs  = Math.floor((Date.now() - _startTime) / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const el = qs('meetingTimer');
      if (el) {
        el.textContent = [h, m, s]
          .map(n => String(n).padStart(2, '0'))
          .join(':');
      }
    }, 1000);
  }

  /* ── Video tile management ────────────────────────────────────────── */
  function _createVideoTile(uid, label, isLocal) {
    const tile = document.createElement('div');
    tile.className = 'video-tile' + (isLocal ? ' local-tile' : '');
    tile.id = `tile-${uid}`;
    tile.innerHTML = `
      <video id="video-${uid}" autoplay ${isLocal ? 'muted' : ''} playsinline></video>
      <div class="video-tile-label">
        <span>${label || uid}</span>
        <i class="fas fa-microphone-slash mic-off-icon" id="mic-icon-${uid}" style="display:none"></i>
      </div>`;
    const grid = qs('videoGrid');
    if (grid) grid.appendChild(tile);
    return tile;
  }

  function _removeTile(uid) {
    const tile = qs(`tile-${uid}`);
    if (tile) tile.remove();
    _updateParticipantCount();
  }

  function _updateParticipantCount() {
    const el = qs('participantCount');
    if (el) el.textContent = _participants.size + 1; // +1 for local
  }

  /* ── Participant list render ──────────────────────────────────────── */
  function _addParticipantItem(uid, name) {
    const list = qs('participantsList') || qs('participantsPanel');
    if (!list) return;

    const existing = qs(`participant-${uid}`);
    if (existing) return;

    const item = document.createElement('div');
    item.className = 'participant-item';
    item.id = `participant-${uid}`;
    const initial = (name || String(uid))[0].toUpperCase();
    item.innerHTML = `
      <div class="participant-avatar">${initial}</div>
      <div class="participant-name">${name || 'Participant ' + uid}</div>
      <div class="participant-badges">
        <i class="fas fa-microphone p-badge" id="p-mic-${uid}" title="Mic on"></i>
      </div>`;
    list.appendChild(item);
    _updateParticipantCount();
  }

  function _removeParticipantItem(uid) {
    const item = qs(`participant-${uid}`);
    if (item) item.remove();
    _updateParticipantCount();
  }

  /* ── Agora client events ──────────────────────────────────────────── */
  function _bindClientEvents() {
    if (!_client) return;

    _client.on('user-published', async (user, mediaType) => {
      await _client.subscribe(user, mediaType);

      if (!_participants.has(user.uid)) {
        _participants.set(user.uid, { uid: user.uid });
        _createVideoTile(user.uid, 'Participant ' + user.uid, false);
        _addParticipantItem(user.uid, 'Participant ' + user.uid);
      }

      const entry = _participants.get(user.uid);

      if (mediaType === 'video') {
        entry.videoTrack = user.videoTrack;
        const videoEl = qs(`video-${user.uid}`);
        if (videoEl) user.videoTrack.play(videoEl);
      }
      if (mediaType === 'audio') {
        entry.audioTrack = user.audioTrack;
        user.audioTrack.play();
      }
    });

    _client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') {
        const micIcon = qs(`mic-icon-${user.uid}`);
        if (micIcon) micIcon.style.display = '';
        const pMic = qs(`p-mic-${user.uid}`);
        if (pMic) { pMic.className = 'fas fa-microphone-slash p-badge'; pMic.style.color = '#ef4444'; }
      }
    });

    _client.on('user-left', (user) => {
      _participants.delete(user.uid);
      _removeTile(user.uid);
      _removeParticipantItem(user.uid);
    });

    _client.on('network-quality', (stats) => {
      const el = qs('networkQuality');
      if (!el) return;
      const level = stats.uplinkNetworkQuality;
      el.textContent = level <= 2 ? '🟢 Good' : level <= 4 ? '🟡 Fair' : '🔴 Poor';
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════════ */

  const VideoMeeting = {

    isSupported() { return WEBRTC_SUPPORTED; },

    /**
     * Initialize and join a meeting channel.
     * @param {Object} opts
     * @param {string}  opts.appId
     * @param {string}  opts.channel
     * @param {string}  [opts.token]    – Agora RTC token (null for test mode)
     * @param {number}  [opts.uid]
     * @param {string}  [opts.meetingId]
     * @param {string}  [opts.authToken]
     * @param {boolean} [opts.waitingRoom] – show waiting room first
     */
    async init(opts = {}) {
      if (!WEBRTC_SUPPORTED) {
        _showNoWebRTCUI();
        throw new Error('WebRTC not supported');
      }

      const AgoraRTC = getAgoraSDK();
      if (!AgoraRTC) throw new Error('Agora SDK not loaded');

      const {
        appId,
        channel,
        token     = null,
        uid       = 0,
        meetingId,
        authToken,
        waitingRoom = false,
      } = opts;

      if (!appId)   throw new Error('appId required');
      if (!channel) throw new Error('channel required');

      _meetingId  = meetingId  || null;
      _authToken  = authToken  || null;
      _waitingRoom = waitingRoom;
      _participants.clear();
      _notes       = [];
      _actionItems = [];

      if (waitingRoom) {
        this._showWaitingRoom();
        return;
      }

      AgoraRTC.setLogLevel(2);
      _client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
      _bindClientEvents();

      await _client.join(appId, channel, token, uid);
      _joined = true;

      // Publish local tracks
      _localAudio = await AgoraRTC.createMicrophoneAudioTrack();
      _localVideo = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p' });

      const localVideoEl = qs('localVideo');
      if (localVideoEl) _localVideo.play(localVideoEl);

      await _client.publish([_localAudio, _localVideo]);

      _startTimer();

      // Set local participant avatar
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const avatarEl = qs('localAvatar');
      if (avatarEl && user.name) avatarEl.textContent = user.name[0].toUpperCase();

      console.info('[VideoMeeting] Joined channel', channel);
    },

    /* ── Waiting room ─────────────────────────────────────────────────── */

    _showWaitingRoom() {
      const layout = qs('meetingLayout') || document.querySelector('.meeting-layout');
      if (!layout) return;

      const wrap = document.createElement('div');
      wrap.id = 'waitingRoomOverlay';
      Object.assign(wrap.style, {
        position: 'absolute', inset: '0', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '100', flexDirection: 'column', gap: '20px',
      });
      wrap.innerHTML = `
        <i class="fas fa-clock" style="font-size:3rem;color:#0052CC"></i>
        <h2 style="font-family:'Poppins',sans-serif;color:#e6edf3">Waiting Room</h2>
        <p style="color:#8b949e;text-align:center;max-width:340px">
          Please wait. The host will let you in shortly.
        </p>
        <div style="width:48px;height:48px;border:4px solid #0052CC;border-top-color:transparent;
                    border-radius:50%;animation:ls-spin 1s linear infinite"></div>
        <style>@keyframes ls-spin{to{transform:rotate(360deg)}}</style>`;
      document.body.appendChild(wrap);
    },

    admitFromWaitingRoom() {
      const overlay = qs('waitingRoomOverlay');
      if (overlay) overlay.remove();
    },

    /* ── Controls ─────────────────────────────────────────────────────── */

    toggleMic() {
      if (!_localAudio) return false;
      _micOn = !_micOn;
      _localAudio.setEnabled(_micOn);

      const btn = qs('ctrlMic');
      if (btn) {
        btn.className = 'ctrl-btn ' + (_micOn ? 'active' : 'muted');
        btn.innerHTML = `<i class="fas fa-microphone${_micOn ? '' : '-slash'}"></i>`;
      }

      const label = qs('ctrlMicLabel');
      if (label) label.textContent = _micOn ? 'Mute' : 'Unmute';

      // Update local mic icon in tile
      const micIcon = qs('localMicIcon');
      if (micIcon) micIcon.style.display = _micOn ? 'none' : '';

      return _micOn;
    },

    toggleCamera() {
      if (!_localVideo) return false;
      _camOn = !_camOn;
      _localVideo.setEnabled(_camOn);

      const btn = qs('ctrlCam');
      if (btn) {
        btn.className = 'ctrl-btn ' + (_camOn ? 'active' : 'muted');
        btn.innerHTML = `<i class="fas fa-video${_camOn ? '' : '-slash'}"></i>`;
      }
      const label = qs('ctrlCamLabel');
      if (label) label.textContent = _camOn ? 'Stop Video' : 'Start Video';

      return _camOn;
    },

    async shareScreen() {
      const AgoraRTC = getAgoraSDK();
      if (!AgoraRTC || !_joined) return;
      try {
        _screenTrack = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '1080p' });

        if (_localVideo) {
          await _client.unpublish(_localVideo);
          _localVideo.stop();
          _localVideo.close();
        }

        await _client.publish(_screenTrack);

        const localVideoEl = qs('localVideo');
        if (localVideoEl) _screenTrack.play(localVideoEl);

        const btn = qs('ctrlScreen');
        if (btn) {
          btn.className = 'ctrl-btn muted';
          btn.title = 'Stop Screen Share';
        }

        _screenTrack.on('track-ended', () => this.stopScreenShare());
      } catch (e) {
        if (e.name !== 'NotAllowedError') console.warn('[VideoMeeting] shareScreen:', e.message);
      }
    },

    async stopScreenShare() {
      const AgoraRTC = getAgoraSDK();
      if (!_screenTrack || !AgoraRTC) return;
      try {
        await _client.unpublish(_screenTrack);
        _screenTrack.stop();
        _screenTrack.close();
        _screenTrack = null;

        _localVideo = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p' });
        const localVideoEl = qs('localVideo');
        if (localVideoEl) _localVideo.play(localVideoEl);
        await _client.publish(_localVideo);

        const btn = qs('ctrlScreen');
        if (btn) { btn.className = 'ctrl-btn active'; btn.title = 'Share Screen'; }
      } catch (e) {
        console.warn('[VideoMeeting] stopScreenShare:', e.message);
      }
    },

    /* ── Recording ────────────────────────────────────────────────────── */

    async toggleRecording() {
      if (!_authToken || !_meetingId) return;

      const endpoint = _recording
        ? `/api/v1/meetings/${_meetingId}/recording/stop`
        : `/api/v1/meetings/${_meetingId}/recording/start`;

      const res  = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${_authToken}` } });
      const json = await res.json();

      if (json.success) {
        _recording = !_recording;
        const btn = qs('ctrlRecord');
        if (btn) {
          btn.className = 'ctrl-btn ' + (_recording ? 'muted' : 'active');
          btn.title     = _recording ? 'Stop Recording' : 'Record Meeting';
          btn.innerHTML = `<i class="fas fa-${_recording ? 'stop-circle' : 'circle'}" style="color:${_recording ? '#ef4444' : ''}"></i>`;
        }
      }
      return json;
    },

    isRecording() { return _recording; },

    /* ── Notes & action items ─────────────────────────────────────────── */

    addNote(text) {
      if (!text) return;
      _notes.push({ text, timestamp: new Date().toISOString() });
      this._renderNotes();
    },

    addActionItem(text, assignee) {
      if (!text) return;
      _actionItems.push({ text, assignee: assignee || '', done: false, timestamp: new Date().toISOString() });
      this._renderActionItems();
    },

    toggleActionItem(index) {
      if (_actionItems[index]) {
        _actionItems[index].done = !_actionItems[index].done;
        this._renderActionItems();
      }
    },

    _renderNotes() {
      const container = qs('meetingNotes');
      if (!container) return;
      container.innerHTML = _notes.map((n, i) =>
        `<div style="padding:6px 0;border-bottom:1px solid #30363d;font-size:.83rem;color:#c9d1d9">${i + 1}. ${n.text}</div>`
      ).join('') || '<div style="color:#8b949e;font-size:.82rem">No notes yet</div>';
    },

    _renderActionItems() {
      const container = qs('meetingActionItems');
      if (!container) return;
      container.innerHTML = _actionItems.map((a, i) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #30363d">
          <input type="checkbox" ${a.done ? 'checked' : ''} onchange="VideoMeeting.toggleActionItem(${i})"
                 style="accent-color:#0052CC;width:16px;height:16px;cursor:pointer"/>
          <span style="font-size:.83rem;color:${a.done ? '#8b949e' : '#c9d1d9'};${a.done ? 'text-decoration:line-through' : ''}">${a.text}</span>
          ${a.assignee ? `<span style="font-size:.73rem;color:#8b949e;margin-left:auto">@${a.assignee}</span>` : ''}
        </div>`
      ).join('') || '<div style="color:#8b949e;font-size:.82rem">No action items</div>';
    },

    getNotes()       { return [..._notes]; },
    getActionItems() { return [..._actionItems]; },

    /* ── Scheduling helpers ───────────────────────────────────────────── */

    async scheduleMeeting(data) {
      if (!_authToken) throw new Error('authToken required');
      const res = await fetch('/api/v1/meetings/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${_authToken}`,
        },
        body: JSON.stringify(data),
      });
      return res.json();
    },

    /* ── Fetch Agora token from backend ────────────────────────────────── */
    async fetchToken(channel, uid) {
      if (!_authToken) throw new Error('authToken required');
      const res = await fetch(
        `/api/v1/meetings/agora-token?channel=${encodeURIComponent(channel)}&uid=${uid}`,
        { headers: { Authorization: `Bearer ${_authToken}` } },
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Token fetch failed');
      return json.data.token;
    },

    /* ── Leave ────────────────────────────────────────────────────────── */

    async leave() {
      if (_timerInterval) clearInterval(_timerInterval);

      if (_screenTrack) { _screenTrack.stop(); _screenTrack.close(); _screenTrack = null; }
      if (_localAudio)  { _localAudio.stop();  _localAudio.close();  _localAudio  = null; }
      if (_localVideo)  { _localVideo.stop();  _localVideo.close();  _localVideo  = null; }

      if (_client && _joined) {
        if (_meetingId && _authToken) {
          await fetch(`/api/v1/meetings/${_meetingId}/end`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${_authToken}` },
          }).catch(() => {});
        }
        await _client.leave();
        console.info('[VideoMeeting] Left channel');
      }
      _client  = null;
      _joined  = false;
      _participants.clear();
    },

    /* ── Getters ──────────────────────────────────────────────────────── */
    get isJoined()      { return _joined; },
    get micEnabled()    { return _micOn; },
    get camEnabled()    { return _camOn; },
    get participantCount() { return _participants.size + 1; },
  };

  window.addEventListener('beforeunload', () => {
    if (_joined) VideoMeeting.leave();
  });

  window.VideoMeeting = VideoMeeting;
}());
