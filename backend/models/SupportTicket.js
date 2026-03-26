import BaseModel from './BaseModel.js';

/**
 * SupportTicket model
 *
 * Table: support_tickets
 * Fields: id, user_id, subject, category, priority, status, assigned_to,
 *         created_at, updated_at
 */
export default class SupportTicket extends BaseModel {
  static get tableName() {
    return 'support_tickets';
  }

  /**
   * Find all support tickets submitted by a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all open support tickets (status not resolved or closed).
   * @returns {Promise<object[]>}
   */
  static async findOpen() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find all support tickets with a given priority.
   * @param {string} priority - e.g. 'low', 'medium', 'high', 'urgent'
   * @returns {Promise<object[]>}
   */
  static async findByPriority(priority) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('priority', priority)
      .order('created_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find a support ticket by its id.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  static async findById(id) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return this._handle(result);
  }
}
