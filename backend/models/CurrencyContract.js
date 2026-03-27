import BaseModel from './BaseModel.js';

/**
 * CurrencyContract model
 *
 * Table: currency_contracts
 * Fields: id, user_id, contract_type (forward|option|swap), base_currency,
 *         quote_currency, notional_amount, contract_rate, spot_rate,
 *         settlement_date, status, hedging_ratio, pnl, metadata,
 *         created_at, updated_at
 */
export default class CurrencyContract extends BaseModel {
  static get tableName() {
    return 'currency_contracts';
  }

  static async findByUser(userId, page = 1, limit = 20) {
    return this.findAll({ page, limit, filters: { user_id: userId }, orderBy: 'created_at' });
  }

  static async findActive(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .order('settlement_date', { ascending: true });
    return this._handle(result);
  }

  static async closeContract(id, pnl) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'closed', pnl, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}
