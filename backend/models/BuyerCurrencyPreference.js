import BaseModel from './BaseModel.js';

/**
 * BuyerCurrencyPreference model
 *
 * Table: buyer_currency_preferences
 * Fields: id, user_id, preferred_currency, auto_detect, created_at, updated_at
 */
export default class BuyerCurrencyPreference extends BaseModel {
  static get tableName() {
    return 'buyer_currency_preferences';
  }

  /**
   * Find the preference row for a given user.
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  static async findByUser(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Upsert the preference for a user (one row per user).
   * @param {string} userId
   * @param {string} preferredCurrency  ISO 4217 code, e.g. 'USD'
   * @param {boolean} [autoDetect=false]
   * @returns {Promise<object>}
   */
  static async setPreference(userId, preferredCurrency, autoDetect = false) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.tableName)
      .upsert(
        {
          user_id: userId,
          preferred_currency: preferredCurrency.toUpperCase(),
          auto_detect: autoDetect,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
