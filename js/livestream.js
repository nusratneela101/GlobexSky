/**
 * js/livestream.js — Free WebRTC live streaming with Supabase Realtime signaling.
 *
 * 100% FREE:
 *   - WebRTC built into every browser
 *   - Google free STUN: stun:stun.l.google.com:19302
 *   - Supabase Realtime for SDP/ICE signaling (free tier)
 *
 * Usage:
 *   GlobexLivestream.startStream(streamId, videoEl)
 *   GlobexLivestream.watchStream(streamId, videoEl)
 *   GlobexLivestream.stopStream()
 *   GlobexLivestream.createStreamRecord(title, description, productIds)
 *   GlobexLivestream.getActiveStreams()
 */
(function (global) {
  'use strict';

  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var GlobexLivestream = {
    _pc: null,
    _localStream: null,
    _channel: null,
    _streamId: null,
    _viewerCount: 0,

    // ── Host: create a stream record in DB ──────────────────────────────────

    createStreamRecord: async function (title, description, productIds) {
      var sb = _sb();
      var user = await sb.auth.getUser();
      if (!user.data.user) throw new Error('Login required');

      var result = await sb.from('live_streams').insert({
        host_id: user.data.user.id,
        title: title,
        description: description || '',
        product_ids: productIds || [],
        status: 'offline'
      }).select().single();
      if (result.error) throw result.error;
      return result.data;
    },

    // ── Host: start broadcasting ─────────────────────────────────────────────

    startStream: async function (streamId, videoEl) {
      var sb = _sb();
      this._streamId = streamId;

      // Get local media
      this._localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      if (videoEl) {
        videoEl.srcObject = this._localStream;
        videoEl.muted = true;
        videoEl.play();
      }

      // Update stream status
      await sb.from('live_streams').update({ status: 'live' }).eq('id', streamId);

      // Subscribe to signaling channel for viewer join requests
      var self = this;
      this._channel = sb.channel('stream:' + streamId)
        .on('broadcast', { event: 'viewer-join' }, async function (msg) {
          await self._handleViewerJoin(streamId, msg.payload.viewerId);
        })
        .on('broadcast', { event: 'ice-candidate' }, async function (msg) {
          if (self._pc && msg.payload.to === 'host') {
            try { await self._pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate)); } catch (e) {}
          }
        })
        .on('broadcast', { event: 'answer' }, async function (msg) {
          if (self._pc && msg.payload.to === 'host') {
            try { await self._pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp)); } catch (e) {}
          }
        })
        .subscribe();

      return this._localStream;
    },

    _handleViewerJoin: async function (streamId, viewerId) {
      var sb = _sb();
      var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this._pc = pc;

      this._localStream.getTracks().forEach(function (track) {
        pc.addTrack(track, GlobexLivestream._localStream);
      });

      pc.onicecandidate = function (e) {
        if (e.candidate) {
          sb.channel('stream:' + streamId).send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { to: viewerId, candidate: e.candidate }
          });
        }
      };

      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sb.channel('stream:' + streamId).send({
        type: 'broadcast',
        event: 'offer',
        payload: { to: viewerId, sdp: pc.localDescription }
      });
    },

    // ── Viewer: watch a stream ───────────────────────────────────────────────

    watchStream: async function (streamId, videoEl) {
      var sb = _sb();
      var user = await sb.auth.getUser();
      var viewerId = user.data.user ? user.data.user.id : ('anon-' + Math.random().toString(36).substr(2, 8));

      var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      this._pc = pc;
      this._streamId = streamId;

      pc.ontrack = function (e) {
        if (videoEl) {
          videoEl.srcObject = e.streams[0];
          videoEl.play();
        }
      };

      var self = this;
      this._channel = sb.channel('stream:' + streamId)
        .on('broadcast', { event: 'offer' }, async function (msg) {
          if (msg.payload.to !== viewerId) return;
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
          var answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sb.channel('stream:' + streamId).send({
            type: 'broadcast',
            event: 'answer',
            payload: { to: 'host', sdp: pc.localDescription }
          });
        })
        .on('broadcast', { event: 'ice-candidate' }, async function (msg) {
          if (msg.payload.to === viewerId) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate)); } catch (e) {}
          }
        })
        .subscribe(function () {
          // Notify host we joined
          sb.channel('stream:' + streamId).send({
            type: 'broadcast',
            event: 'viewer-join',
            payload: { viewerId: viewerId }
          });
        });

      pc.onicecandidate = function (e) {
        if (e.candidate) {
          sb.channel('stream:' + streamId).send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { to: 'host', candidate: e.candidate }
          });
        }
      };
    },

    // ── Stop stream ──────────────────────────────────────────────────────────

    stopStream: async function () {
      var sb = _sb();
      if (this._localStream) {
        this._localStream.getTracks().forEach(function (t) { t.stop(); });
        this._localStream = null;
      }
      if (this._pc) { this._pc.close(); this._pc = null; }
      if (this._channel) { sb.removeChannel(this._channel); this._channel = null; }
      if (this._streamId) {
        await sb.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', this._streamId);
        this._streamId = null;
      }
    },

    // ── Get active streams ───────────────────────────────────────────────────

    getActiveStreams: async function () {
      var sb = _sb();
      var result = await sb.from('live_streams')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false });
      return result.data || [];
    },

    // ── Subscribe to viewer count changes ────────────────────────────────────

    subscribeViewerCount: function (streamId, callback) {
      var sb = _sb();
      return sb.channel('stream-meta:' + streamId)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_streams',
          filter: 'id=eq.' + streamId
        }, function (payload) {
          if (typeof callback === 'function') callback(payload.new.viewer_count || 0);
        })
        .subscribe();
    }
  };

  global.GlobexLivestream = GlobexLivestream;

}(typeof window !== 'undefined' ? window : this));
