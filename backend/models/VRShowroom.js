import BaseModel from './BaseModel.js';

/**
 * VRShowroom model
 *
 * Table: vr_showrooms
 * Fields: id, seller_id, name, description, model_urls, thumbnail_url,
 *         product_ids, status, views, created_at
 */
export default class VRShowroom extends BaseModel {
  static get tableName() {
    return 'vr_showrooms';
  }

  /**
   * Find all active VR showrooms.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'active')
      .order('views', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all VR showrooms belonging to a seller.
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
}
