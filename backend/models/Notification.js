import BaseModel from './BaseModel.js';

/**
 * Notification model
 *
 * Table: notifications
 * Fields: id, user_id, type, title, message, data, is_read, read_at,
 *         channel, created_at
 */
export default class Notification extends BaseModel {
  static get tableName() {
    return 'notifications';
  }

  /**
   * Find all notifications for a user (paginated).
   * @param {string} userId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByUser(userId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, user_id: userId } });
  }

  /**
   * Find all unread notifications for a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findUnread(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Mark a single notification as read.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async markAsRead(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Mark all notifications for a user as read.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async markAllAsRead(userId) {
    const result = await this.db
      .from(this.tableName)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();
    return this._handle(result);
  }

  /**
   * Delete notifications older than a given number of days.
   * @param {number} [days=90]
   * @returns {Promise<null>}
   */
  static async deleteOld(days = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.db
      .from(this.tableName)
      .delete()
      .lt('created_at', cutoff);
    return this._handle(result);
  }
}
