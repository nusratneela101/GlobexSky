import BaseModel from './BaseModel.js';

/**
 * Refund model
 *
 * Table: refunds
 * Fields: id, order_id, user_id, amount, currency, reason, status,
 *         payment_method, transaction_id, processed_at, created_at
 */
export default class Refund extends BaseModel {
  static get tableName() {
    return 'refunds';
  }

  /**
   * Find all refunds associated with an order.
   * @param {string} orderId
   * @returns {Promise<object[]>}
   */
  static async findByOrder(orderId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all refunds for a user.
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
   * Find all refunds that are currently pending processing.
   * @returns {Promise<object[]>}
   */
  static async findPending() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    return this._handle(result);
  }
}
