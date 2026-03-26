/**
 * Chat Model — Globex Sky
 *
 * High-level aggregate model that combines Conversation and Message operations.
 * Provides the single-import entry-point required by chatController.js and
 * any code that needs to work with buyer-supplier chat data.
 *
 * Re-exports:
 *   - Conversation  — conversations table operations
 *   - Message       — messages table operations
 *
 * Additional helpers defined here cover cross-table operations such as
 * creating a conversation and its first message in one call, or fetching
 * a full chat thread (conversation + messages + unread count).
 */

import Conversation from './Conversation.js';
import Message from './Message.js';

export { Conversation, Message };

/**
 * Chat — aggregate model for buyer-supplier messaging.
 *
 * All methods are static; no instantiation required.
 */
export default class Chat {
  // ── Conversation helpers ─────────────────────────────────────────────────

  /**
   * List all conversations for a user, ordered by most recent activity.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async getConversations(userId) {
    return Conversation.findByParticipant(userId);
  }

  /**
   * Get or create a buyer-supplier conversation between two users.
   * Returns the existing conversation when one already exists.
   * @param {string} userA
   * @param {string} userB
   * @returns {Promise<{ conversation: object, created: boolean }>}
   */
  static async getOrCreateConversation(userA, userB) {
    const existing = await Conversation.findBetween(userA, userB);
    if (existing) return { conversation: existing, created: false };
    const conversation = await Conversation.createBetween(userA, userB, 'buyer_supplier');
    return { conversation, created: true };
  }

  // ── Message helpers ──────────────────────────────────────────────────────

  /**
   * Fetch paginated messages for a conversation.
   * @param {string} conversationId
   * @param {{ limit?: number, before?: string }} [options]
   * @returns {Promise<object[]>}
   */
  static async getMessages(conversationId, options = {}) {
    return Message.findByConversation(conversationId, options);
  }

  /**
   * Send a message and update conversation activity.
   * @param {object} fields
   * @param {string} fields.conversationId
   * @param {string} fields.senderId
   * @param {string} fields.content
   * @param {string} [fields.type='text']  'text' | 'image' | 'file' | 'voice'
   * @param {string} [fields.fileUrl]
   * @param {string} [fields.fileName]
   * @param {string} [fields.fileMimeType]
   * @returns {Promise<object>}
   */
  static async sendMessage({ conversationId, senderId, content, type = 'text', fileUrl, fileName, fileMimeType }) {
    const message = await Message.create({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      type,
      ...(fileUrl && { file_url: fileUrl, file_name: fileName, file_mime_type: fileMimeType }),
    });
    await Conversation.touchActivity(conversationId, message.id);
    return message;
  }

  /**
   * Mark all unread messages in a conversation as read (for the given reader).
   * @param {string} conversationId
   * @param {string} userId  The reader's user ID.
   * @returns {Promise<object[]>}
   */
  static async markRead(conversationId, userId) {
    return Message.markRead(conversationId, userId);
  }

  /**
   * Count unread messages in a conversation for a user.
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async countUnread(conversationId, userId) {
    return Message.countUnread(conversationId, userId);
  }

  /**
   * Search messages within a conversation.
   * @param {string} conversationId
   * @param {string} query
   * @returns {Promise<object[]>}
   */
  static async searchMessages(conversationId, query) {
    return Message.search(conversationId, query);
  }

  // ── Cross-table helpers ──────────────────────────────────────────────────

  /**
   * Fetch a full chat thread: conversation metadata + recent messages + unread count.
   * @param {string} conversationId
   * @param {string} userId  The requesting user's ID (for unread count and access check).
   * @param {{ limit?: number }} [options]
   * @returns {Promise<{ conversation: object, messages: object[], unreadCount: number } | null>}
   */
  static async getThread(conversationId, userId, options = {}) {
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) return null;

    const [conversation, messages, unreadCount] = await Promise.all([
      Conversation.findById(conversationId),
      Message.findByConversation(conversationId, options),
      Message.countUnread(conversationId, userId),
    ]);

    return { conversation, messages, unreadCount };
  }
}
