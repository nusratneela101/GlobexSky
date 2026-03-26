import BaseModel from './BaseModel.js';

/**
 * IntegrationConfig model
 *
 * Reuses the platform_settings table to manage third-party integration
 * credentials and configuration values.
 *
 * Table: platform_settings
 * Fields: id, category, key, test_value, live_value, is_secret, mode,
 *         created_at, updated_at
 */
export default class IntegrationConfig extends BaseModel {
  static get tableName() {
    return 'platform_settings';
  }

  /**
   * Find all settings belonging to a category.
   * @param {string} category - e.g. 'stripe', 'sendgrid', 'agora'
   * @returns {Promise<object[]>}
   */
  static async findByCategory(category) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('category', category)
      .order('key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Retrieve all integration settings.
   * @returns {Promise<object[]>}
   */
  static async getAll() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .order('category', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a setting value. Creates the row if it does not exist.
   * @param {string} category
   * @param {string} key
   * @param {'test'|'live'} mode - which value column to write
   * @param {string} value
   * @returns {Promise<object>}
   */
  static async save(category, key, mode, value) {
    const column = mode === 'live' ? 'live_value' : 'test_value';
    const result = await this.db
      .from(this.tableName)
      .upsert(
        {
          category,
          key,
          [column]: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'category,key' }
      )
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Retrieve the current global mode (test or live) from settings.
   * Looks for category='global', key='mode'.
   * @returns {Promise<'test'|'live'>}
   */
  static async getMode() {
    const result = await this.db
      .from(this.tableName)
      .select('live_value, test_value')
      .eq('category', 'global')
      .eq('key', 'mode')
      .maybeSingle();
    const row = this._handle(result);
    return row?.live_value ?? row?.test_value ?? 'test';
  }
}
