/**
 * js/chat.js — Real-time chat using Supabase Realtime.
 *
 * Requires:
 *   - Supabase CDN loaded
 *   - js/config.js (window.supabaseClient)
 *
 * Usage:
 *   GlobexChat.openRoom(buyerId, supplierId, productId).then(room => ...)
 *   GlobexChat.sendMessage(roomId, 'Hello!')
 *   GlobexChat.subscribeToRoom(roomId, callback)
 *   GlobexChat.getMessages(roomId)
 */
(function (global) {
  'use strict';

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var GlobexChat = {

    // ── Create or retrieve a chat room ──────────────────────────────────────

    openRoom: async function (buyerId, supplierId, productId) {
      var sb = _sb();
      if (!sb) throw new Error('Supabase not initialised');

      // Try to find existing room
      var q = sb.from('chat_rooms')
        .select('*')
        .eq('buyer_id', buyerId)
        .eq('supplier_id', supplierId);
      if (productId) q = q.eq('product_id', productId);
      var existing = await q.maybeSingle();
      if (existing.data) return existing.data;

      // Create new room
      var payload = { buyer_id: buyerId, supplier_id: supplierId };
      if (productId) payload.product_id = productId;
      var created = await sb.from('chat_rooms').insert(payload).select().single();
      if (created.error) throw created.error;
      return created.data;
    },

    // ── List rooms for the current user ─────────────────────────────────────

    listRooms: async function () {
      var sb = _sb();
      var user = await sb.auth.getUser();
      if (!user.data.user) return [];
      var uid = user.data.user.id;
      var result = await sb
        .from('chat_rooms')
        .select('*')
        .or('buyer_id.eq.' + uid + ',supplier_id.eq.' + uid)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      return result.data || [];
    },

    // ── Send a message ───────────────────────────────────────────────────────

    sendMessage: async function (roomId, message) {
      var sb = _sb();
      var user = await sb.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      var result = await sb.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.data.user.id,
        message: message.trim()
      });
      if (result.error) throw result.error;

      // Update room's last_message
      await sb.from('chat_rooms')
        .update({ last_message: message.trim(), last_message_at: new Date().toISOString() })
        .eq('id', roomId);

      return result;
    },

    // ── Load messages for a room ─────────────────────────────────────────────

    getMessages: async function (roomId, limit) {
      var sb = _sb();
      var result = await sb
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(limit || 100);
      if (result.error) throw result.error;
      return result.data || [];
    },

    // ── Subscribe to new messages (Supabase Realtime) ────────────────────────

    subscribeToRoom: function (roomId, callback) {
      var sb = _sb();
      var channel = sb
        .channel('room:' + roomId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'room_id=eq.' + roomId
        }, function (payload) {
          if (typeof callback === 'function') callback(payload.new);
        })
        .subscribe();
      return channel;
    },

    // ── Unsubscribe ──────────────────────────────────────────────────────────

    unsubscribe: function (channel) {
      var sb = _sb();
      if (channel && sb) sb.removeChannel(channel);
    },

    // ── Mark messages as read ────────────────────────────────────────────────

    markRead: async function (roomId) {
      var sb = _sb();
      var user = await sb.auth.getUser();
      if (!user.data.user) return;
      await sb.from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', user.data.user.id)
        .eq('is_read', false);
    },

    // ── Init: start auth listener and update online presence ─────────────────

    init: async function () {
      var sb = _sb();
      if (!sb) return;
      var self = this;
      var userResult = await sb.auth.getUser();
      if (userResult.data && userResult.data.user) {
        await self.updateOnlineStatus(true);
        global.addEventListener('beforeunload', function () {
          self.updateOnlineStatus(false);
        });
      }
      sb.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' && session) {
          self.updateOnlineStatus(true);
        } else if (event === 'SIGNED_OUT') {
          self.updateOnlineStatus(false);
        }
      });
    },

    // ── Render a single message bubble ───────────────────────────────────────

    renderMessage: function (msg, currentUserId) {
      var isOwn = msg.sender_id === currentUserId;
      var text  = String(msg.message || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var time  = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      var attachmentHtml = '';
      if (msg.attachment_url) {
        var url = String(msg.attachment_url).replace(/"/g, '&quot;');
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
          attachmentHtml = '<img src="' + url + '" alt="attachment" style="max-width:200px;border-radius:8px;margin-top:4px;display:block">';
        } else {
          attachmentHtml = '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="color:#0052CC;font-size:.8rem">📎 Attachment</a>';
        }
      }

      return '<div class="chat-message ' + (isOwn ? 'own' : 'other') + '" ' +
        'style="display:flex;flex-direction:column;align-items:' + (isOwn ? 'flex-end' : 'flex-start') + ';margin-bottom:12px">' +
        '<div style="max-width:70%;padding:10px 14px;border-radius:' + (isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + ';' +
          'background:' + (isOwn ? '#0052CC' : '#f1f5f9') + ';color:' + (isOwn ? '#fff' : '#1e293b') + ';font-size:.9rem">' +
          text + attachmentHtml +
        '</div>' +
        '<span style="font-size:.72rem;color:#94a3b8;margin-top:2px">' + time + '</span>' +
      '</div>';
    },

    // ── Render room list sidebar ──────────────────────────────────────────────

    renderRoomList: function (rooms, currentUserId, onRoomClick) {
      if (!rooms || rooms.length === 0) {
        return '<p style="text-align:center;color:#94a3b8;padding:24px">No conversations yet.</p>';
      }
      return rooms.map(function (room) {
        var id      = String(room.id || '').replace(/"/g, '&quot;');
        var lastMsg = String(room.last_message || 'No messages yet').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var time    = room.last_message_at
          ? new Date(room.last_message_at).toLocaleDateString()
          : '';
        var otherId = room.buyer_id === currentUserId ? room.supplier_id : room.buyer_id;
        var initials = otherId ? otherId.substring(0, 2).toUpperCase() : '??';
        return '<div class="chat-room-item" data-room-id="' + id + '" ' +
          'style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .15s" ' +
          'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">' +
          '<div style="width:44px;height:44px;border-radius:50%;background:#0052CC;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">' +
            initials +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:.9rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Chat #' + id.substring(0, 8) + '</div>' +
            '<div style="font-size:.8rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + lastMsg + '</div>' +
          '</div>' +
          '<span style="font-size:.72rem;color:#94a3b8;flex-shrink:0">' + time + '</span>' +
        '</div>';
      }).join('');
    },

    // ── Upload attachment to Supabase Storage ────────────────────────────────

    uploadAttachment: async function (file) {
      var sb = _sb();
      if (!sb) throw new Error('Supabase not initialised');
      if (!file) throw new Error('No file provided');

      var ext  = file.name.split('.').pop().toLowerCase();
      var name = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + '.' + ext;
      var path = 'chat-attachments/' + name;

      var result = await sb.storage.from('chat').upload(path, file, { cacheControl: '3600', upsert: false });
      if (result.error) throw result.error;

      var urlResult = sb.storage.from('chat').getPublicUrl(path);
      return urlResult.data && urlResult.data.publicUrl ? urlResult.data.publicUrl : null;
    },

    // ── Update user online presence ───────────────────────────────────────────

    updateOnlineStatus: async function (isOnline) {
      var sb = _sb();
      if (!sb) return;
      var userResult = await sb.auth.getUser();
      if (!userResult.data || !userResult.data.user) return;
      var uid = userResult.data.user.id;
      await sb.from('users')
        .update({ is_online: isOnline, last_seen: new Date().toISOString() })
        .eq('id', uid);
    }
  };

  global.GlobexChat = GlobexChat;

}(typeof window !== 'undefined' ? window : this));
