import BaseModel from './BaseModel.js';

/**
 * Warehouse model
 *
 * Table: warehouses
 * Fields: id, name, code, address, city, country, capacity, current_stock,
 *         manager_id, status, created_at
 */
export default class Warehouse extends BaseModel {
  static get tableName() {
    return 'warehouses';
  }

  /**
   * Find all warehouses with an active status.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find all warehouses in a given country.
   * @param {string} country
   * @returns {Promise<object[]>}
   */
  static async findByCountry(country) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('country', country)
      .order('name', { ascending: true });
    return this._handle(result);
  }
}
