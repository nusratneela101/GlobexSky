import BaseModel from './BaseModel.js';

/**
 * Commission model
 *
 * Table: commissions
 * Fields: id, name, type, category_id, min_order_value, max_order_value,
 *         rate_percent, min_cap, max_cap, is_active, created_at, updated_at
 */
export default class Commission extends BaseModel {
  static get tableName() {
    return 'commissions';
  }

  /**
   * Find all commission rules for a specific category.
   * @param {string} categoryId
   * @returns {Promise<object[]>}
   */
  static async findByCategory(categoryId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('min_order_value', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find the best-matching active commission rule for a category and order value.
   * @param {string} categoryId
   * @param {number} orderValue
   * @returns {Promise<object|null>}
   */
  static async findActiveByCategoryAndValue(categoryId, orderValue) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .lte('min_order_value', orderValue)
      .order('min_order_value', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Calculate commission amount for a given order value using a commission rule.
   * @param {string} commissionId
   * @param {number} orderValue
   * @returns {Promise<number>} commission amount
   */
  static async calculateCommission(commissionId, orderValue) {
    const rule = await this.findById(commissionId);
    if (!rule) throw new Error(`Commission rule ${commissionId} not found`);

    let amount = (orderValue * rule.rate_percent) / 100;

    if (rule.min_cap !== null && amount < rule.min_cap) amount = rule.min_cap;
    if (rule.max_cap !== null && amount > rule.max_cap) amount = rule.max_cap;

    return Math.round(amount * 100) / 100;
  }
}
