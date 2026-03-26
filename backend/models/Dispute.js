import BaseModel from './BaseModel.js';

/**
 * Dispute model
 *
 * Table: disputes
 * Fields: id, order_id, buyer_id, seller_id, type, status, description,
 *         evidence_urls, resolution, resolved_at, created_at
 */
export default class Dispute extends BaseModel {
  static get tableName() {
    return 'disputes';
  }

  /**
   * Find all disputes linked to an order.
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
   * Find all disputes where the user is either the buyer or the seller.
   * @param {string} userId - must be a valid UUID
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    this._assertUUID(userId);
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Validate that a value is a UUID; throw if not.
   * @param {string} value
   */
  static _assertUUID(value) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error(`Invalid UUID: ${value}`);
    }
  }

  /**
   * Find disputes filtered by status.
   * @param {string} status - e.g. 'open', 'under_review', 'resolved', 'closed'
   * @returns {Promise<object[]>}
   */
  static async findByStatus(status) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }
}
