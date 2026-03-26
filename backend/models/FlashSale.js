import BaseModel from './BaseModel.js';

/**
 * FlashSale model
 *
 * Table: flash_sales
 * Fields: id, name, discount_percent, product_ids, start_time, end_time,
 *         max_quantity, sold_count, status, created_at
 */
export default class FlashSale extends BaseModel {
  static get tableName() {
    return 'flash_sales';
  }

  /**
   * Find all currently active flash sales.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const now = new Date().toISOString();
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'active')
      .lte('start_time', now)
      .gte('end_time', now)
      .order('end_time', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find flash sales that are scheduled to start in the future.
   * @returns {Promise<object[]>}
   */
  static async findUpcoming() {
    const now = new Date().toISOString();
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'scheduled')
      .gt('start_time', now)
      .order('start_time', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find a flash sale by its id.
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
