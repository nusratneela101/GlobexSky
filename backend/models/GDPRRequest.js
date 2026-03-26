import BaseModel from './BaseModel.js';

/**
 * GDPRRequest model
 *
 * Table: gdpr_requests
 * Fields: id, user_id, type (export/deletion/correction), status, data_url,
 *         requested_at, processed_at, notes
 */
export default class GDPRRequest extends BaseModel {
  static get tableName() {
    return 'gdpr_requests';
  }

  /**
   * Find all GDPR requests submitted by a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all GDPR requests that are pending processing.
   * @returns {Promise<object[]>}
   */
  static async findPending() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find a GDPR request by its id.
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
