import BaseModel from './BaseModel.js';

/**
 * User model
 *
 * Table: users
 * Fields: id, email, password_hash, first_name, last_name, phone, role,
 *         avatar_url, is_verified, is_banned, ban_reason,
 *         two_factor_enabled, last_login, created_at, updated_at
 */
export default class User extends BaseModel {
  static get tableName() {
    return 'users';
  }

  /**
   * Find a user by email address.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  static async findByEmail(email) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Update the last_login timestamp for a user.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async updateLastLogin(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Ban a user.
   * @param {string} id
   * @param {string} reason
   * @returns {Promise<object>}
   */
  static async ban(id, reason) {
    const result = await this.db
      .from(this.tableName)
      .update({
        is_banned: true,
        ban_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Unban a user.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async unban(id) {
    const result = await this.db
      .from(this.tableName)
      .update({
        is_banned: false,
        ban_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Retrieve login history for a user.
   * @param {string} userId
   * @param {number} [limit=20]
   * @returns {Promise<object[]>}
   */
  static async getLoginHistory(userId, limit = 20) {
    const result = await this.db
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return this._handle(result);
  }
}
