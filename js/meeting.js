/**
 * js/meeting.js — P2P video meetings using PeerJS (FREE CDN).
 *
 * CDN: https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js
 * No paid server needed — uses PeerJS free STUN/TURN.
 * Works on Namecheap shared hosting (static files only).
 *
 * Usage:
 *   GlobexMeeting.createMeeting()   → { peerId, shareUrl }
 *   GlobexMeeting.joinMeeting(peerId, videoGrid)
 *   GlobexMeeting.toggleMute()
 *   GlobexMeeting.toggleCamera()
 *   GlobexMeeting.shareScreen()
 *   GlobexMeeting.endMeeting()
 */
(function (global) {
  'use strict';

  var GlobexMeeting = {
    _peer: null,
    _localStream: null,
    _calls: {},
    _isMuted: false,
    _isCameraOff: false,

    // ── Create a new meeting (host) ──────────────────────────────────────────

    createMeeting: async function () {
      var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this._localStream = stream;

      return new Promise(function (resolve, reject) {
        var peer = new Peer({ debug: 0 });
        GlobexMeeting._peer = peer;

        peer.on('open', function (id) {
          var url = location.origin + '/pages/meetings/?room=' + id;
          resolve({ peerId: id, shareUrl: url });
        });

        peer.on('error', function (err) {
          reject(err);
        });

        // Accept incoming calls
        peer.on('call', function (call) {
          call.answer(stream);
          GlobexMeeting._handleCall(call);
        });
      });
    },

    // ── Join an existing meeting ─────────────────────────────────────────────

    joinMeeting: async function (hostPeerId, videoGrid) {
      var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this._localStream = stream;

      // Add local video
      if (videoGrid) this._addVideoEl(videoGrid, stream, true);

      return new Promise(function (resolve, reject) {
        var peer = new Peer({ debug: 0 });
        GlobexMeeting._peer = peer;

        peer.on('open', function () {
          var call = peer.call(hostPeerId, stream);
          if (!call) { reject(new Error('Could not reach host')); return; }
          GlobexMeeting._handleCall(call, videoGrid);
          resolve(call);
        });

        peer.on('error', function (err) { reject(err); });

        // Accept additional peers calling us
        peer.on('call', function (call) {
          call.answer(stream);
          GlobexMeeting._handleCall(call, videoGrid);
        });
      });
    },

    _handleCall: function (call, videoGrid) {
      this._calls[call.peer] = call;
      var self = this;
      call.on('stream', function (remoteStream) {
        if (videoGrid) self._addVideoEl(videoGrid, remoteStream, false, call.peer);
      });
      call.on('close', function () {
        delete self._calls[call.peer];
        var el = document.getElementById('video-' + call.peer);
        if (el) el.parentNode && el.parentNode.removeChild(el.parentNode);
      });
    },

    _addVideoEl: function (grid, stream, muted, peerId) {
      var wrap = document.createElement('div');
      wrap.className = 'video-tile';
      if (peerId) wrap.id = 'video-' + peerId;

      var video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = !!muted;
      video.srcObject = stream;

      var label = document.createElement('div');
      label.className = 'video-label';
      label.textContent = muted ? 'You' : ('Participant');

      wrap.appendChild(video);
      wrap.appendChild(label);
      grid.appendChild(wrap);
      return wrap;
    },

    // ── Controls ─────────────────────────────────────────────────────────────

    toggleMute: function () {
      if (!this._localStream) return;
      this._isMuted = !this._isMuted;
      this._localStream.getAudioTracks().forEach(function (t) {
        t.enabled = !GlobexMeeting._isMuted;
      });
      return this._isMuted;
    },

    toggleCamera: function () {
      if (!this._localStream) return;
      this._isCameraOff = !this._isCameraOff;
      this._localStream.getVideoTracks().forEach(function (t) {
        t.enabled = !GlobexMeeting._isCameraOff;
      });
      return this._isCameraOff;
    },

    shareScreen: async function () {
      var screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      var videoTrack = screen.getVideoTracks()[0];

      // Replace video track in all active calls
      Object.values(this._calls).forEach(function (call) {
        var sender = call.peerConnection &&
          call.peerConnection.getSenders().find(function (s) {
            return s.track && s.track.kind === 'video';
          });
        if (sender) sender.replaceTrack(videoTrack);
      });

      var self = this;
      videoTrack.onended = function () {
        // Restore camera when screen share ends
        if (self._localStream) {
          var camTrack = self._localStream.getVideoTracks()[0];
          if (camTrack) {
            Object.values(self._calls).forEach(function (call) {
              var sender = call.peerConnection &&
                call.peerConnection.getSenders().find(function (s) {
                  return s.track && s.track.kind === 'video';
                });
              if (sender) sender.replaceTrack(camTrack);
            });
          }
        }
      };

      return screen;
    },

    endMeeting: function () {
      if (this._localStream) {
        this._localStream.getTracks().forEach(function (t) { t.stop(); });
        this._localStream = null;
      }
      Object.values(this._calls).forEach(function (call) { call.close(); });
      this._calls = {};
      if (this._peer) { this._peer.destroy(); this._peer = null; }
    },

    // ── Copy meeting link to clipboard ────────────────────────────────────────

    copyMeetingLink: function () {
      var peerId = this._peer && this._peer.id;
      var url = peerId
        ? global.location.origin + '/pages/meetings/?room=' + peerId
        : global.location.href;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(url).then(function () {
          if (global.GlobexUtils && global.GlobexUtils.showToast) {
            global.GlobexUtils.showToast('Meeting link copied to clipboard!', 'success');
          }
          return url;
        });
      }

      // Fallback for older browsers
      var textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (global.GlobexUtils && global.GlobexUtils.showToast) {
        global.GlobexUtils.showToast('Meeting link copied to clipboard!', 'success');
      }
      return Promise.resolve(url);
    }
  };

  global.GlobexMeeting = GlobexMeeting;

}(typeof window !== 'undefined' ? window : this));
