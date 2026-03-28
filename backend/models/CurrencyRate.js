import BaseModel from './BaseModel.js';

/**
 * CurrencyRate model
 *
 * Table: currency_rates
 * Fields: id, base_currency, target_currency, rate, source, updated_at
 */
export default class CurrencyRate extends BaseModel {
  static get tableName() {
    return 'currency_rates';
  }

  /**
   * Find an exchange rate by base and target currency.
   * @param {string} baseCurrency
   * @param {string} targetCurrency
   * @returns {Promise<object|null>}
   */
  static async findByPair(baseCurrency, targetCurrency) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('base_currency', baseCurrency.toUpperCase())
      .eq('target_currency', targetCurrency.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Get all rates for a given base currency.
   * @param {string} baseCurrency
   * @returns {Promise<object[]>}
   */
  static async findByBase(baseCurrency) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('base_currency', baseCurrency.toUpperCase())
      .order('target_currency', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Upsert a rate (insert or update on base+target conflict).
   * @param {string} baseCurrency
   * @param {string} targetCurrency
   * @param {number} rate
   * @param {string} [source='manual']
   * @returns {Promise<object>}
   */
  static async upsertRate(baseCurrency, targetCurrency, rate, source = 'manual') {
    const { data, error } = await this.db
      .from(this.tableName)
      .upsert(
        {
          base_currency: baseCurrency.toUpperCase(),
          target_currency: targetCurrency.toUpperCase(),
          rate,
          source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'base_currency,target_currency' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Bulk upsert a map of rates for a given base currency.
   * @param {string} baseCurrency
   * @param {Record<string, number>} rates  target → rate
   * @param {string} [source='api']
   * @returns {Promise<object[]>}
   */
  static async bulkUpsert(baseCurrency, rates, source = 'api') {
    const rows = Object.entries(rates).map(([target, rate]) => ({
      base_currency: baseCurrency.toUpperCase(),
      target_currency: target.toUpperCase(),
      rate,
      source,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await this.db
      .from(this.tableName)
      .upsert(rows, { onConflict: 'base_currency,target_currency' })
      .select();
    if (error) throw error;
    return data ?? [];
  }
}
