import BaseModel from './BaseModel.js';

/**
 * TradeFinance model
 *
 * Table: trade_finance_applications
 * Fields: id, applicant_id, type (escrow/lc/insurance), amount, currency,
 *         status, counterparty_id, terms, documents, approved_at, created_at
 */
export default class TradeFinance extends BaseModel {
  static get tableName() {
    return 'trade_finance_applications';
  }

  /**
   * Find all trade finance applications submitted by an applicant.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByApplicant(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find trade finance applications filtered by status.
   * @param {string} status - e.g. 'pending', 'approved', 'rejected', 'active', 'closed'
   * @returns {Promise<object[]>}
   */
  static async findByStatus(status) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }
}
