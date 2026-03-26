import BaseModel from './BaseModel.js';

/**
 * SavedSearch model
 *
 * Table: saved_searches
 * Fields:
 *   id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id      UUID NOT NULL REFERENCES auth.users(id)
 *   query        TEXT NOT NULL
 *   filters      JSONB DEFAULT '{}'
 *   name         TEXT
 *   alert_enabled BOOLEAN DEFAULT false
 *   created_at   TIMESTAMPTZ DEFAULT now()
 *   updated_at   TIMESTAMPTZ DEFAULT now()
 */
export default class SavedSearch extends BaseModel {
  static get tableName() {
    return 'saved_searches';
  }

  /**
   * Get all saved searches for a user, ordered by creation date (newest first).
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find a saved search by id, ensuring it belongs to the user.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  static async findByIdAndUser(id, userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Count saved searches for a user.
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async countByUser(userId) {
    const { count, error } = await this.db
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Create a saved search for a user.
   * @param {string} userId
   * @param {object} data - { query, filters, name, alertEnabled }
   * @returns {Promise<object>}
   */
  static async createForUser(userId, { query, filters = {}, name, alertEnabled = false }) {
    return this.create({
      user_id: userId,
      query,
      filters,
      name: name || query,
      alert_enabled: alertEnabled,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Update the name of a saved search (user-scoped).
   * @param {string} id
   * @param {string} userId
   * @param {string} name
   * @returns {Promise<object>}
   */
  static async updateName(id, userId, name) {
    const result = await this.db
      .from(this.tableName)
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Toggle the alert flag for a saved search.
   * @param {string} id
   * @param {string} userId
   * @param {boolean} enabled
   * @returns {Promise<object>}
   */
  static async setAlert(id, userId, enabled) {
    const result = await this.db
      .from(this.tableName)
      .update({ alert_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Delete a saved search (user-scoped).
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<null>}
   */
  static async deleteByIdAndUser(id, userId) {
    const result = await this.db
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    return this._handle(result);
  }

  /**
   * Get all saved searches with alerts enabled (for notification processing).
   * @returns {Promise<object[]>}
   */
  static async findAllWithAlerts() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('alert_enabled', true)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }
}
