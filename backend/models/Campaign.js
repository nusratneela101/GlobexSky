import BaseModel from './BaseModel.js';

/**
 * Campaign model
 *
 * Table: campaigns
 * Fields: id, name, type, description, discount_type, discount_value,
 *         min_order, target_audience, product_ids, status, start_date,
 *         end_date, created_at
 */
export default class Campaign extends BaseModel {
  static get tableName() {
    return 'campaigns';
  }

  /**
   * Find all currently active campaigns.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const now = new Date().toISOString();
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find campaigns filtered by status.
   * @param {string} status - e.g. 'active', 'scheduled', 'ended', 'draft'
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
