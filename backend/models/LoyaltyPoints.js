import BaseModel from './BaseModel.js';

/**
 * LoyaltyPoints model
 *
 * Table: loyalty_points
 * Fields: id, user_id, points, type (earn/redeem), source, reference_id,
 *         description, expires_at, created_at
 */
export default class LoyaltyPoints extends BaseModel {
  static get tableName() {
    return 'loyalty_points';
  }

  /**
   * Find all loyalty point transactions for a user.
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
   * Calculate the current points balance for a user.
   * Earned points are added, redeemed points are subtracted.
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async getBalance(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('points, type')
      .eq('user_id', userId);
    const rows = this._handle(result) ?? [];
    return rows.reduce((balance, row) => {
      return row.type === 'earn' ? balance + row.points : balance - row.points;
    }, 0);
  }

  /**
   * Add earned points for a user.
   * @param {string} userId
   * @param {number} points
   * @param {string} source - e.g. 'purchase', 'referral', 'promotion'
   * @param {string} description
   * @returns {Promise<object>}
   */
  static async addPoints(userId, points, source, description) {
    const result = await this.db
      .from(this.tableName)
      .insert({ user_id: userId, points, type: 'earn', source, description })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Redeem points for a user.
   * @param {string} userId
   * @param {number} points
   * @param {string} description
   * @returns {Promise<object>}
   */
  static async redeemPoints(userId, points, description) {
    const balance = await this.getBalance(userId);
    if (balance < points) throw new Error('Insufficient loyalty points balance.');

    const result = await this.db
      .from(this.tableName)
      .insert({ user_id: userId, points, type: 'redeem', source: 'redemption', description })
      .select()
      .single();
    return this._handle(result);
  }
}
