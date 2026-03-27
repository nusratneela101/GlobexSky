import BaseModel from './BaseModel.js';

/**
 * SystemConfig model
 *
 * Table: system_configs
 * Fields: id, config_key (unique), config_value (JSON), config_group,
 *         is_secret, is_live, test_value, live_value,
 *         last_tested_at, test_status, created_at, updated_at
 */
export default class SystemConfig extends BaseModel {
  static get tableName() {
    return 'system_configs';
  }

  /**
   * Find a config entry by its unique key.
   * @param {string} key
   * @returns {Promise<object|null>}
   */
  static async findByKey(key) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('config_key', key)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Find all config entries in a given group.
   * @param {string} group - e.g. 'payment', 'email', 'sms', 'shipping'
   * @returns {Promise<object[]>}
   */
  static async findByGroup(group) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('config_group', group)
      .order('config_key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a config entry by key.
   * @param {string} key
   * @param {object} data - fields to set/update
   * @returns {Promise<object>}
   */
  static async upsertByKey(key, data) {
    const { data: result, error } = await this.db
      .from(this.tableName)
      .upsert(
        { config_key: key, ...data, updated_at: new Date().toISOString() },
        { onConflict: 'config_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return result;
  }

  /**
   * Get all config entries, optionally filtered by group.
   * Secret values are masked in the returned data.
   * @param {object} [options]
   * @param {string} [options.group]
   * @returns {Promise<object[]>}
   */
  static async findAllMasked({ group } = {}) {
    let query = this.db
      .from(this.tableName)
      .select('*')
      .order('config_group', { ascending: true })
      .order('config_key', { ascending: true });

    if (group) query = query.eq('config_group', group);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => ({
      ...row,
      config_value: row.is_secret ? '••••••••' : row.config_value,
      test_value: row.is_secret ? '••••••••' : row.test_value,
      live_value: row.is_secret ? '••••••••' : row.live_value,
    }));
  }

  /**
   * Delete a config entry by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  static async deleteByKey(key) {
    const { error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('config_key', key);
    if (error) throw error;
  }
}
