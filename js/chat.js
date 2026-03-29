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
    }
  };

  global.GlobexChat = GlobexChat;

}(typeof window !== 'undefined' ? window : this));
