/**
 * Globex Sky — WebSocket Service (Socket.io)
 * Real-time buyer-supplier chat with typing indicators, read receipts,
 * online/offline status, file sharing, and Supabase persistence.
 */

import supabase from '../config/supabase.js';
import websocketConfig from '../config/websocket.js';

// Track online users: userId → Set of socket IDs
const onlineUsers = new Map();

// Per-user message rate limit counters: userId → { count, resetAt }
const rateLimitCounters = new Map();

/**
 * Check if a user has exceeded the message rate limit.
 * @param {string} userId
 * @returns {boolean}
 */
function isRateLimited(userId) {
  const now = Date.now();
  const { message: limit } = websocketConfig.rateLimits;
  const counter = rateLimitCounters.get(userId);
  if (!counter || now > counter.resetAt) {
    rateLimitCounters.set(userId, { count: 1, resetAt: now + limit.windowMs });
    return false;
  }
  if (counter.count >= limit.max) return true;
  counter.count++;
  return false;
}

/**
 * Mark a user as online and notify their conversation partners.
 * @param {import('socket.io').Socket} socket
 * @param {string} userId
 */
function setUserOnline(socket, userId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);
  socket.broadcast.emit('user:online', { userId });
}

/**
 * Mark a user as offline (remove socket, broadcast if no more sockets).
 * @param {import('socket.io').Socket} socket
 * @param {string} userId
 */
function setUserOffline(socket, userId) {
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user:offline', { userId });
    }
  }
}

/**
 * Persist a message to Supabase and return the saved record.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function persistMessage({ conversationId, senderId, content, type = 'text', fileUrl = null, fileName = null, fileMimeType = null }) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      type,
      file_url: fileUrl,
      file_name: fileName,
      file_mime_type: fileMimeType,
      sent_at: new Date().toISOString(),
      read_at: null,
    }])
    .select('*, sender:profiles(full_name, avatar_url)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verify that a user is a participant in a conversation.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isConversationParticipant(conversationId, userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .or(`buyer_id.eq.${userId},supplier_id.eq.${userId}`)
    .single();
  return !error && !!data;
}

/**
 * Initialize all Socket.io event handlers on the chat namespace.
 * @param {import('socket.io').Server} io
 */
export function initializeWebSocket(io) {
  const chatNs = io.of(websocketConfig.namespaces.chat);

  chatNs.use(async (socket, next) => {
    // Authenticate via token passed in handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required.'));

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error('Invalid or expired token.'));

    socket.userId = user.id;
    next();
  });

  chatNs.on('connection', (socket) => {
    const { userId } = socket;

    // Mark user online
    setUserOnline(socket, userId);

    // ── Join a conversation room ────────────────────────────────────────────
    socket.on('conversation:join', async ({ conversationId }) => {
      try {
        const allowed = await isConversationParticipant(conversationId, userId);
        if (!allowed) {
          socket.emit('error', { message: 'Access denied to conversation.' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        socket.emit('conversation:joined', { conversationId });
      } catch {
        socket.emit('error', { message: 'Failed to join conversation.' });
      }
    });

    // ── Leave a conversation room ───────────────────────────────────────────
    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ── Send a message ──────────────────────────────────────────────────────
    socket.on('message:send', async (payload) => {
      try {
        const { conversationId, content, type = 'text', fileUrl, fileName, fileMimeType } = payload;

        if (!conversationId || (!content && type === 'text')) {
          socket.emit('error', { message: 'conversationId and content are required.' });
          return;
        }

        if (isRateLimited(userId)) {
          socket.emit('error', { message: 'Message rate limit exceeded. Please slow down.' });
          return;
        }

        const allowed = await isConversationParticipant(conversationId, userId);
        if (!allowed) {
          socket.emit('error', { message: 'Access denied to conversation.' });
          return;
        }

        if (type === 'text' && content.length > websocketConfig.message.maxLength) {
          socket.emit('error', { message: `Message exceeds maximum length of ${websocketConfig.message.maxLength} characters.` });
          return;
        }

        const message = await persistMessage({
          conversationId,
          senderId: userId,
          content: content || '',
          type,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileMimeType: fileMimeType || null,
        });

        // Broadcast to all participants in the conversation room
        chatNs.to(`conversation:${conversationId}`).emit('message:new', message);
      } catch {
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // ── Typing indicator ────────────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { userId, conversationId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId, conversationId });
    });

    // ── Read receipts ───────────────────────────────────────────────────────
    socket.on('messages:read', async ({ conversationId, upToMessageId }) => {
      try {
        const allowed = await isConversationParticipant(conversationId, userId);
        if (!allowed) return;

        const query = supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)
          .is('read_at', null);

        const finalQuery = upToMessageId ? query.lte('id', upToMessageId) : query;
        await finalQuery;

        socket.to(`conversation:${conversationId}`).emit('messages:read', {
          conversationId,
          readBy: userId,
          readAt: new Date().toISOString(),
        });
      } catch {
        // Silently ignore read receipt errors
      }
    });

    // ── Online status queries ───────────────────────────────────────────────
    socket.on('user:status', ({ userIds }) => {
      if (!Array.isArray(userIds)) return;
      const statuses = userIds.map((id) => ({
        userId: id,
        online: onlineUsers.has(id),
      }));
      socket.emit('user:statuses', statuses);
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      setUserOffline(socket, userId);
    });
  });

  return chatNs;
}

/**
 * Get a list of currently online user IDs.
 * @returns {string[]}
 */
export function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Check if a specific user is online.
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  return onlineUsers.has(userId);
}
