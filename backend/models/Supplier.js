import BaseModel from './BaseModel.js';

/**
 * Supplier model
 *
 * Table: suppliers
 * Fields: id, user_id, company_name, business_type, registration_number,
 *         country, city, address, verification_status, verification_documents,
 *         plan_type, plan_expires_at, score, badges, response_rate,
 *         on_time_delivery_rate, quality_score, total_transactions,
 *         created_at, updated_at
 */
export default class Supplier extends BaseModel {
  static get tableName() {
    return 'suppliers';
  }

  /**
   * Find a supplier profile by its associated user id.
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  static async findByUserId(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Mark a supplier as verified.
   * @param {string} id
   * @param {string} [status='verified']
   * @returns {Promise<object>}
   */
  static async verify(id, status = 'verified') {
    const result = await this.db
      .from(this.tableName)
      .update({ verification_status: status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Update the aggregate score fields for a supplier.
   * @param {string} id
   * @param {object} scores
   * @param {number} [scores.response_rate]
   * @param {number} [scores.on_time_delivery_rate]
   * @param {number} [scores.quality_score]
   * @param {number} [scores.score]
   * @returns {Promise<object>}
   */
  static async updateScore(id, scores) {
    const result = await this.db
      .from(this.tableName)
      .update({ ...scores, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Find all suppliers on a given subscription plan.
   * @param {string} planType
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByPlan(planType, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, plan_type: planType } });
  }

  /**
   * Return scorecard metrics for a supplier.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  static async getScorecard(id) {
    const result = await this.db
      .from(this.tableName)
      .select('score, response_rate, on_time_delivery_rate, quality_score, total_transactions, badges')
      .eq('id', id)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Append a badge to a supplier's badges array.
   * @param {string} id
   * @param {object} badge
   * @returns {Promise<object>}
   */
  static async addBadge(id, badge) {
    const supplier = await this.findById(id);
    if (!supplier) throw new Error(`Supplier ${id} not found`);

    const badges = Array.isArray(supplier.badges) ? supplier.badges : [];
    badges.push({ ...badge, awarded_at: new Date().toISOString() });

    const result = await this.db
      .from(this.tableName)
      .update({ badges, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}
