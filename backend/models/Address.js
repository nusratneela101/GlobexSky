import BaseModel from './BaseModel.js';

/**
 * Address model
 *
 * Table: addresses
 * Fields: id, user_id, label, full_name, phone, address_line1, address_line2,
 *         city, state, country, postal_code, is_default, created_at, updated_at
 */
export default class Address extends BaseModel {
  static get tableName() {
    return 'addresses';
  }

  /**
   * Find all addresses belonging to a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    return this._handle(result);
  }

  /**
   * Set an address as the default for a user, clearing any previous default.
   * @param {string} id - address id to make default
   * @param {string} userId
   * @returns {Promise<object>}
   */
  static async setDefault(id, userId) {
    await this.db
      .from(this.tableName)
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    const result = await this.db
      .from(this.tableName)
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    return this._handle(result);
  }
}
