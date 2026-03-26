/**
 * Chat Controller
 * Handles conversations, messages, file uploads, message search, and online-user queries.
 * Complements chat.controller.js with additional endpoints.
 */

import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { getOnlineUserIds, isUserOnline } from '../services/chatService.js';

// ── Conversations ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/conversations
 * List all conversations for the authenticated user.
 */
export async function getConversations(req, res, next) {
  try {
    const data = await Conversation.findByParticipant(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/chat/conversations
 * Create or return an existing conversation with another user.
 */
export async function createConversation(req, res, next) {
  try {
    const { participant_id } = req.body;
    const existing = await Conversation.findBetween(req.user.id, participant_id);
    if (existing) return res.json({ success: true, data: existing });
    const data = await Conversation.createBetween(req.user.id, participant_id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/conversations/:id/messages
 * Retrieve messages for a conversation (paginated).
 */
export async function getMessages(req, res, next) {
  try {
    const allowed = await Conversation.isParticipant(req.params.id, req.user.id);
    if (!allowed) return res.status(403).json({ success: false, error: 'Access denied.' });
    const { before, limit } = req.query;
    const data = await Message.findByConversation(req.params.id, { before, limit: Number(limit) || 50 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/chat/conversations/:id/messages
 * Send a text message in a conversation.
 */
export async function sendMessage(req, res, next) {
  try {
    const allowed = await Conversation.isParticipant(req.params.id, req.user.id);
    if (!allowed) return res.status(403).json({ success: false, error: 'Access denied.' });
    const { content, type = 'text' } = req.body;
    const message = await Message.create({
      conversation_id: req.params.id,
      sender_id: req.user.id,
      content,
      type,
    });
    await Conversation.touchActivity(req.params.id, message.id);
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/v1/chat/conversations/:id/read
 * Mark messages in a conversation as read.
 */
export async function markAsRead(req, res, next) {
  try {
    const allowed = await Conversation.isParticipant(req.params.id, req.user.id);
    if (!allowed) return res.status(403).json({ success: false, error: 'Access denied.' });
    await Message.markRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Messages marked as read.' });
  } catch (err) { next(err); }
}

// ── File Upload ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/chat/conversations/:id/upload
 * Upload a file/image and send it as a message in the conversation.
 * Uses multer + Cloudinary (uploadGeneral middleware applied in route).
 */
export async function uploadFile(req, res, next) {
  try {
    const allowed = await Conversation.isParticipant(req.params.id, req.user.id);
    if (!allowed) return res.status(403).json({ success: false, error: 'Access denied.' });

    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
    const message = await Message.create({
      conversation_id: req.params.id,
      sender_id: req.user.id,
      content: req.file.originalname || 'attachment',
      type: isImage ? 'image' : 'file',
      file_url: req.file.path,
      file_name: req.file.originalname || req.file.filename,
      file_mime_type: req.file.mimetype,
    });
    await Conversation.touchActivity(req.params.id, message.id);
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/conversations/:id/search?q=...
 * Search messages within a conversation.
 */
export async function searchMessages(req, res, next) {
  try {
    const allowed = await Conversation.isParticipant(req.params.id, req.user.id);
    if (!allowed) return res.status(403).json({ success: false, error: 'Access denied.' });

    const { q } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ success: false, error: 'Query parameter q is required.' });

    const data = await Message.search(req.params.id, q.trim());
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Online Users ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/online
 * Return a list of currently online user IDs.
 */
export async function getOnlineUsers(req, res, next) {
  try {
    const userIds = getOnlineUserIds();
    res.json({ success: true, data: userIds });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/chat/online/:userId
 * Check whether a specific user is currently online.
 */
export async function getUserOnlineStatus(req, res, next) {
  try {
    const online = isUserOnline(req.params.userId);
    res.json({ success: true, data: { userId: req.params.userId, online } });
  } catch (err) { next(err); }
}
