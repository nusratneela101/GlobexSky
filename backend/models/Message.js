import BaseModel from './BaseModel.js';

/**
 * Message model
 *
 * Table: messages
 * Fields: id, conversation_id, sender_id, content, type (text|image|file),
 *         file_url, file_name, file_mime_type, sent_at, delivered_at, read_at, created_at
 */
export default class Message extends BaseModel {
  static get tableName() {
    return 'messages';
  }

  /**
   * Fetch paginated messages for a conversation.
   * @param {string} conversationId
   * @param {object} [options]
   * @returns {Promise<object[]>}
   */
  static async findByConversation(conversationId, options = {}) {
    const { limit = 50, before } = options;
    let query = this.db
      .from(this.tableName)
      .select('*, sender:profiles!sender_id(full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    return this._handle(await query);
  }

  /**
   * Insert a new message record.
   * @param {object} fields
   * @returns {Promise<object>}
   */
  static async create(fields) {
    const result = await this.db
      .from(this.tableName)
      .insert([{ ...fields, created_at: new Date().toISOString() }])
      .select('*, sender:profiles!sender_id(full_name, avatar_url)')
      .single();
    return this._handle(result);
  }

  /**
   * Mark messages in a conversation as read (for messages not sent by userId).
   * @param {string} conversationId
   * @param {string} userId  The reader's user ID.
   * @returns {Promise<object[]>}
   */
  static async markRead(conversationId, userId) {
    const result = await this.db
      .from(this.tableName)
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null)
      .select();
    return this._handle(result);
  }

  /**
   * Mark messages as delivered.
   * @param {string} conversationId
   * @param {string} userId  The recipient's user ID.
   * @returns {Promise<object[]>}
   */
  static async markDelivered(conversationId, userId) {
    const result = await this.db
      .from(this.tableName)
      .update({ delivered_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('delivered_at', null)
      .select();
    return this._handle(result);
  }

  /**
   * Full-text search within a conversation's messages.
   * @param {string} conversationId
   * @param {string} query
   * @returns {Promise<object[]>}
   */
  static async search(conversationId, query) {
    const result = await this.db
      .from(this.tableName)
      .select('*, sender:profiles!sender_id(full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    return this._handle(result);
  }

  /**
   * Count unread messages in a conversation for a given user.
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async countUnread(conversationId, userId) {
    const result = await this.db
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null);
    const { count, error } = result;
    if (error) throw error;
    return count ?? 0;
  }
}
