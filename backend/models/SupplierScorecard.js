import BaseModel from './BaseModel.js';

/**
 * SupplierScorecard model
 *
 * Table: supplier_scorecards
 * Fields: id, supplier_id (unique), overall_score, quality_score, delivery_score,
 *         communication_score, pricing_score, badges (JSONB array), review_count,
 *         last_evaluated_at, created_at, updated_at
 */
export default class SupplierScorecard extends BaseModel {
  static get tableName() {
    return 'supplier_scorecards';
  }

  /**
   * Find a scorecard by supplier_id.
   * @param {string} supplierId
   * @returns {Promise<object|null>}
   */
  static async findBySupplierId(supplierId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('supplier_id', supplierId)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Upsert a scorecard for a supplier (insert or update on supplier_id conflict).
   * @param {object} data - { supplier_id, overall_score, quality_score, delivery_score, communication_score, pricing_score, badges, review_count }
   * @returns {Promise<object>}
   */
  static async upsert(data) {
    const result = await this.db
      .from(this.tableName)
      .upsert(
        { ...data, last_evaluated_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'supplier_id' },
      )
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get top-rated suppliers by overall_score.
   * @param {number} limit
   * @returns {Promise<object[]>}
   */
  static async getTopRated(limit = 10) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*, suppliers(company_name, country, verification_status, plan_type)')
      .order('overall_score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Auto-calculate and assign badges based on score thresholds.
   * Returns the updated badges array.
   * @param {string} supplierId
   * @param {{ overall_score: number, quality_score: number, delivery_score: number, communication_score: number, pricing_score: number }} scores
   * @returns {string[]} badge tier identifiers
   */
  static calculateBadges(scores) {
    const badges = [];
    const { overall_score = 0, quality_score = 0, delivery_score = 0, communication_score = 0, pricing_score = 0 } = scores;

    if (overall_score >= 90) badges.push('platinum');
    else if (overall_score >= 80) badges.push('gold');
    else if (overall_score >= 65) badges.push('silver');
    else if (overall_score >= 50) badges.push('bronze');

    if (quality_score >= 90) badges.push('premium_quality');
    if (delivery_score >= 90) badges.push('fast_shipper');
    if (communication_score >= 90) badges.push('quick_responder');
    if (pricing_score >= 90) badges.push('best_value');

    return badges;
  }
}
