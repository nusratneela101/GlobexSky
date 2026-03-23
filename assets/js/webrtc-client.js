/**
 * Globex Sky — webrtc-client.js
 * Frontend WebRTC client for video calls, screen sharing, and signaling
 * via the WebSocket (window.GlobexSky.ws).
 *
 * Exports: window.GlobexSky.webrtc
 */

(function (global) {
  'use strict';

  if (!global.GlobexSky) global.GlobexSky = {};

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN servers should be added from environment config in production
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
  ];

  let _pc = null;           // RTCPeerConnection
  let _localStream = null;
  let _remoteStream = null;
  let _callerId = null;
  let _isMuted = false;
  let _isVideoOff = false;
  let _screenShareStream = null;

  // ─── UI Elements ──────────────────────────────────────────────────────────

  function _createCallUI() {
    if (document.getElementById('gs-webrtc-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'gs-webrtc-overlay';
    overlay.style.cssText = [
      'position:fixed;bottom:24px;right:24px;z-index:10000',
      'background:#0f172a;color:#fff;border-radius:16px',
      'padding:16px;display:none;flex-direction:column;gap:12px',
      'box-shadow:0 8px 32px rgba(0,0,0,.5);width:320px',
    ].join(';');

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:.85rem;opacity:.7">In Call</span>
        <button id="gs-webrtc-fullscreen" title="Fullscreen"
          style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.1rem">⛶</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#1e293b;aspect-ratio:16/9">
        <video id="gs-webrtc-remote" autoplay playsinline
          style="width:100%;height:100%;object-fit:cover"></video>
        <video id="gs-webrtc-local" autoplay playsinline muted
          style="position:absolute;bottom:8px;right:8px;width:80px;height:60px;border-radius:6px;object-fit:cover;border:2px solid #334155"></video>
      </div>
      <div style="display:flex;justify-content:center;gap:12px">
        <button id="gs-webrtc-mute" title="Mute"
          style="width:44px;height:44px;border-radius:50%;background:#334155;border:none;color:#fff;cursor:pointer;font-size:1.1rem">🎤</button>
        <button id="gs-webrtc-video" title="Toggle video"
          style="width:44px;height:44px;border-radius:50%;background:#334155;border:none;color:#fff;cursor:pointer;font-size:1.1rem">📷</button>
        <button id="gs-webrtc-screen" title="Share screen"
          style="width:44px;height:44px;border-radius:50%;background:#334155;border:none;color:#fff;cursor:pointer;font-size:1rem">🖥</button>
        <button id="gs-webrtc-hangup" title="Hang up"
          style="width:44px;height:44px;border-radius:50%;background:#dc2626;border:none;color:#fff;cursor:pointer;font-size:1.1rem">📵</button>
      </div>`;

    document.body.appendChild(overlay);
    _attachCallUIHandlers(overlay);
  }

  function _attachCallUIHandlers(overlay) {
    overlay.querySelector('#gs-webrtc-mute').addEventListener('click', () => {
      toggleMute();
      overlay.querySelector('#gs-webrtc-mute').textContent = _isMuted ? '🔇' : '🎤';
    });
    overlay.querySelector('#gs-webrtc-video').addEventListener('click', () => {
      toggleVideo();
      overlay.querySelector('#gs-webrtc-video').textContent = _isVideoOff ? '🚫' : '📷';
    });
    overlay.querySelector('#gs-webrtc-screen').addEventListener('click', () => {
      startScreenShare().catch((err) => console.warn('[WebRTC] Screen share error:', err));
    });
    overlay.querySelector('#gs-webrtc-hangup').addEventListener('click', () => endCall());
    overlay.querySelector('#gs-webrtc-fullscreen').addEventListener('click', () => {
      const el = overlay.querySelector('#gs-webrtc-remote');
      if (el.requestFullscreen) el.requestFullscreen();
    });
  }

  function _showCallUI() {
    const el = document.getElementById('gs-webrtc-overlay');
    if (el) el.style.display = 'flex';
  }

  function _hideCallUI() {
    const el = document.getElementById('gs-webrtc-overlay');
    if (el) el.style.display = 'none';
  }

  function _setLocalVideo(stream) {
    const el = document.getElementById('gs-webrtc-local');
    if (el) el.srcObject = stream;
  }

  function _setRemoteVideo(stream) {
    const el = document.getElementById('gs-webrtc-remote');
    if (el) el.srcObject = stream;
  }

  // ─── PeerConnection ────────────────────────────────────────────────────────

  function _createPeerConnection(targetUserId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate && global.GlobexSky.ws) {
        global.GlobexSky.ws.emit('webrtc_ice_candidate', {
          targetUserId,
          candidate: event.candidate,
        });
      }
    });

    pc.addEventListener('track', (event) => {
      _remoteStream = event.streams[0] || new MediaStream([event.track]);
      _setRemoteVideo(_remoteStream);
    });

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    });

    return pc;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async function startVideoCall(targetUserId) {
    try {
      _createCallUI();
      _localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      _setLocalVideo(_localStream);
      _pc = _createPeerConnection(targetUserId);
      _localStream.getTracks().forEach((track) => _pc.addTrack(track, _localStream));

      const offer = await _pc.createOffer();
      await _pc.setLocalDescription(offer);

      if (global.GlobexSky.ws) {
        global.GlobexSky.ws.emit('webrtc_offer', { targetUserId, offer });
      }

      _showCallUI();
    } catch (err) {
      console.error('[WebRTC] startVideoCall error:', err);
      throw err;
    }
  }

  async function answerCall(offer, callerId) {
    try {
      _callerId = callerId;
      _createCallUI();
      _localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      _setLocalVideo(_localStream);
      _pc = _createPeerConnection(callerId);
      _localStream.getTracks().forEach((track) => _pc.addTrack(track, _localStream));

      await _pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await _pc.createAnswer();
      await _pc.setLocalDescription(answer);

      if (global.GlobexSky.ws) {
        global.GlobexSky.ws.emit('webrtc_answer', { targetUserId: callerId, answer });
      }

      _showCallUI();
    } catch (err) {
      console.error('[WebRTC] answerCall error:', err);
      throw err;
    }
  }

  async function handleAnswer(answer) {
    if (!_pc) return;
    await _pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function addIceCandidate(candidate) {
    if (!_pc) return;
    try {
      await _pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] addIceCandidate error:', err);
    }
  }

  function endCall() {
    if (_localStream) {
      _localStream.getTracks().forEach((t) => t.stop());
      _localStream = null;
    }
    if (_screenShareStream) {
      _screenShareStream.getTracks().forEach((t) => t.stop());
      _screenShareStream = null;
    }
    if (_pc) {
      _pc.close();
      _pc = null;
    }
    _remoteStream = null;
    _isMuted = false;
    _isVideoOff = false;
    _hideCallUI();

    if (global.GlobexSky.ws && _callerId) {
      global.GlobexSky.ws.emit('webrtc_hangup', { targetUserId: _callerId });
    }
    _callerId = null;
  }

  async function startScreenShare() {
    if (!_pc) throw new Error('No active call');
    _screenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = _screenShareStream.getVideoTracks()[0];

    const sender = _pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }

    const localVideo = document.getElementById('gs-webrtc-local');
    if (localVideo) localVideo.srcObject = _screenShareStream;

    screenTrack.addEventListener('ended', () => {
      // Switch back to camera on screen share end
      if (_localStream) {
        const camTrack = _localStream.getVideoTracks()[0];
        if (sender && camTrack) sender.replaceTrack(camTrack);
        if (localVideo) localVideo.srcObject = _localStream;
      }
    });
  }

  function toggleMute() {
    if (!_localStream) return;
    _localStream.getAudioTracks().forEach((t) => { t.enabled = _isMuted; });
    _isMuted = !_isMuted;
  }

  function toggleVideo() {
    if (!_localStream) return;
    _localStream.getVideoTracks().forEach((t) => { t.enabled = _isVideoOff; });
    _isVideoOff = !_isVideoOff;
  }

  // ─── Wire up incoming WebSocket signaling messages ────────────────────────

  function _setupSignaling() {
    if (!global.GlobexSky.ws) return;

    global.GlobexSky.ws.on('webrtc_offer', async ({ offer, callerId }) => {
      // Show incoming call prompt
      if (confirm(`Incoming video call from ${callerId}. Accept?`)) {
        await answerCall(offer, callerId);
      } else if (global.GlobexSky.ws) {
        global.GlobexSky.ws.emit('webrtc_hangup', { targetUserId: callerId });
      }
    });

    global.GlobexSky.ws.on('webrtc_answer', ({ answer }) => {
      handleAnswer(answer);
    });

    global.GlobexSky.ws.on('webrtc_ice_candidate', ({ candidate }) => {
      addIceCandidate(candidate);
    });

    global.GlobexSky.ws.on('webrtc_hangup', () => {
      endCall();
    });
  }

  function init() {
    _createCallUI();
    // Set up signaling once WS is connected
    if (global.GlobexSky.ws) {
      if (global.GlobexSky.ws.isConnected()) {
        _setupSignaling();
      } else {
        global.GlobexSky.ws.on('connected', _setupSignaling);
      }
    }
  }

  // ─── Exports ──────────────────────────────────────────────────────────────

  global.GlobexSky.webrtc = {
    init,
    startVideoCall,
    answerCall,
    handleAnswer,
    addIceCandidate,
    endCall,
    startScreenShare,
    toggleMute,
    toggleVideo,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
