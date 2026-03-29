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
    },

    // ── Increment viewer count ───────────────────────────────────────────────

    incrementViewerCount: async function (streamId) {
      var sb = _sb();
      var result = await sb.rpc('increment_viewer_count', { stream_id: streamId });
      if (result && result.error) throw result.error;
      return (result && result.data != null) ? result.data : null;
    },

    // ── Decrement viewer count ───────────────────────────────────────────────

    decrementViewerCount: async function (streamId) {
      var sb = _sb();
      var result = await sb.rpc('decrement_viewer_count', { stream_id: streamId });
      if (result && result.error) throw result.error;
      return (result && result.data != null) ? result.data : null;
    },

    // ── Render stream card ───────────────────────────────────────────────────

    renderStreamCard: function (stream) {
      var id          = String(stream.id || '').replace(/"/g, '&quot;');
      var title       = String(stream.title || 'Live Stream').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var desc        = String(stream.description || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var viewers     = stream.viewer_count || 0;
      var thumbnail   = stream.thumbnail_url ? String(stream.thumbnail_url).replace(/"/g,'&quot;') : '/assets/images/livestream-placeholder.jpg';
      var startedAt   = stream.created_at ? new Date(stream.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return '<div class="stream-card" data-stream-id="' + id + '" ' +
        'style="border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer" ' +
        'onclick="location.href=\'/pages/livestream/watch.html?id=' + id + '\'">' +
        '<div style="position:relative">' +
          '<img src="' + thumbnail + '" alt="' + title + '" ' +
            'onerror="this.src=\'/assets/images/livestream-placeholder.jpg\'" ' +
            'style="width:100%;height:180px;object-fit:cover">' +
          '<span style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:4px">● LIVE</span>' +
          '<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;font-size:.78rem;padding:3px 8px;border-radius:4px">' +
            '👁 ' + viewers +
          '</span>' +
        '</div>' +
        '<div style="padding:12px">' +
          '<h3 style="font-size:.95rem;font-weight:600;color:#1e293b;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + title + '</h3>' +
          (desc ? '<p style="font-size:.8rem;color:#64748b;margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + desc + '</p>' : '') +
          '<div style="font-size:.75rem;color:#94a3b8">Started at ' + startedAt + '</div>' +
        '</div>' +
      '</div>';
    }
  };

  global.GlobexLivestream = GlobexLivestream;

}(typeof window !== 'undefined' ? window : this));
