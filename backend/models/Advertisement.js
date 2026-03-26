import BaseModel from './BaseModel.js';

/**
 * Advertisement model
 *
 * Table: advertisements
 * Fields: id, seller_id, title, type, target_url, image_url, placement,
 *         budget, spent, impressions, clicks, status, start_date, end_date,
 *         created_at
 */
export default class Advertisement extends BaseModel {
  static get tableName() {
    return 'advertisements';
  }

  /**
   * Find all currently active advertisements.
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
   * Find all advertisements created by a seller.
   * @param {string} sellerId
   * @returns {Promise<object[]>}
   */
  static async findBySeller(sellerId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Increment the impression counter for an advertisement.
   * @param {string} id
   * @returns {Promise<null>}
   */
  static async recordImpression(id) {
    const result = await this.db.rpc('increment_ad_impressions', { ad_id: id });
    return this._handle(result);
  }

  /**
   * Increment the click counter for an advertisement.
   * @param {string} id
   * @returns {Promise<null>}
   */
  static async recordClick(id) {
    const result = await this.db.rpc('increment_ad_clicks', { ad_id: id });
    return this._handle(result);
  }
}
