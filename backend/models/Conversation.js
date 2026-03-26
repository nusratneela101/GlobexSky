import BaseModel from './BaseModel.js';

/**
 * Conversation model
 *
 * Table: conversations
 * Fields: id, buyer_id, supplier_id, participant_ids (array), type,
 *         last_message_id, last_activity, created_at
 */
export default class Conversation extends BaseModel {
  static get tableName() {
    return 'conversations';
  }

  /**
   * Find all conversations where userId is a participant.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByParticipant(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*, last_message:messages(content, type, created_at, sender_id)')
      .contains('participant_ids', [userId])
      .order('last_activity', { ascending: false, nullsFirst: false });
    return this._handle(result);
  }

  /**
   * Find an existing conversation between two users.
   * @param {string} userA
   * @param {string} userB
   * @returns {Promise<object|null>}
   */
  static async findBetween(userA, userB) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .contains('participant_ids', [userA, userB])
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Create a new conversation between two participants.
   * @param {string} userA
   * @param {string} userB
   * @param {string} [type='buyer_supplier']
   * @returns {Promise<object>}
   */
  static async createBetween(userA, userB, type = 'buyer_supplier') {
    const result = await this.db
      .from(this.tableName)
      .insert([{
        participant_ids: [userA, userB],
        type,
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Update the last_activity and last_message_id for a conversation.
   * @param {string} conversationId
   * @param {string} [lastMessageId]
   * @returns {Promise<object>}
   */
  static async touchActivity(conversationId, lastMessageId = null) {
    const update = { last_activity: new Date().toISOString() };
    if (lastMessageId) update.last_message_id = lastMessageId;
    const result = await this.db
      .from(this.tableName)
      .update(update)
      .eq('id', conversationId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Verify that a user is a participant in a conversation.
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async isParticipant(conversationId, userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('id')
      .eq('id', conversationId)
      .contains('participant_ids', [userId])
      .maybeSingle();
    return !error && !!data;
  }
}
