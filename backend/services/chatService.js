/**
 * Globex Sky — Chat Service
 * Manages WebSocket connections via Socket.IO, message broadcasting,
 * online presence tracking, push notification triggers for offline users,
 * and file upload helpers.
 *
 * This service re-exports the helpers from websocket.service.js and
 * adds higher-level chat-domain abstractions used by chatController.js
 * and chatRoutes.js.
 */

import supabase from '../config/supabase.js';
import websocketConfig from '../config/websocket.js';
import { getOnlineUserIds as _getOnlineUserIds, isUserOnline as _isUserOnline } from './websocket.service.js';

// ─── Online presence helpers (re-exported for chatController) ─────────────────

/**
 * Get the list of currently online user IDs.
 * @returns {string[]}
 */
export function getOnlineUserIds() {
  return _getOnlineUserIds();
}

/**
 * Check whether a specific user is online.
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  return _isUserOnline(userId);
}

// ─── Message broadcasting ─────────────────────────────────────────────────────

/**
 * Broadcast a new message to all sockets in a conversation room.
 * @param {import('socket.io').Server} io  The Socket.IO server instance.
 * @param {string} conversationId
 * @param {object} message  The persisted message record.
 */
export function broadcastMessage(io, conversationId, message) {
  const chatNs = io.of(websocketConfig.namespaces.chat);
  chatNs.to(`conversation:${conversationId}`).emit('message:new', message);
}

/**
 * Emit a typing indicator event to conversation participants.
 * @param {import('socket.io').Server} io
 * @param {string} conversationId
 * @param {string} userId  The typing user.
 * @param {boolean} isTyping
 */
export function broadcastTyping(io, conversationId, userId, isTyping) {
  const chatNs = io.of(websocketConfig.namespaces.chat);
  const event = isTyping ? 'typing:start' : 'typing:stop';
  chatNs.to(`conversation:${conversationId}`).emit(event, { userId, conversationId });
}

/**
 * Notify conversation participants that messages have been read.
 * @param {import('socket.io').Server} io
 * @param {string} conversationId
 * @param {string} readBy  The user who read the messages.
 */
export function broadcastReadReceipt(io, conversationId, readBy) {
  const chatNs = io.of(websocketConfig.namespaces.chat);
  chatNs.to(`conversation:${conversationId}`).emit('messages:read', {
    conversationId,
    readBy,
    readAt: new Date().toISOString(),
  });
}

// ─── Push notifications for offline users ────────────────────────────────────

/**
 * Trigger a push notification for a user who is offline.
 * Looks up the user's push subscriptions in Supabase and dispatches
 * a notification via the push_notification_queue table (processed by
 * pushNotification.service.js).
 *
 * @param {string} recipientId  UUID of the offline user.
 * @param {string} senderName   Display name of the message sender.
 * @param {string} content      Message preview (truncated to 100 chars).
 * @param {string} conversationId
 */
export async function notifyOfflineUser(recipientId, senderName, content, conversationId) {
  if (isUserOnline(recipientId)) return; // skip if online

  const preview = String(content || '').slice(0, 100);

  try {
    await supabase.from('push_notification_queue').insert([{
      user_id: recipientId,
      title: `New message from ${senderName}`,
      body: preview,
      data: { type: 'chat_message', conversationId },
      created_at: new Date().toISOString(),
    }]);
  } catch {
    // Non-critical — swallow errors so message delivery is unaffected
  }
}

// ─── File upload helpers ──────────────────────────────────────────────────────

/**
 * Validate that an uploaded file's MIME type is permitted for chat.
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isAllowedChatFile(mimeType) {
  return websocketConfig.message.allowedFileTypes.includes(mimeType);
}

/**
 * Validate that a file's size does not exceed the chat limit.
 * @param {number} bytes
 * @returns {boolean}
 */
export function isChatFileSizeOk(bytes) {
  return bytes <= websocketConfig.message.maxFileSize;
}
