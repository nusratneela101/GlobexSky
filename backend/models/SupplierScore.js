import BaseModel from './BaseModel.js';

/**
 * SupplierScore model
 *
 * Table: supplier_scores
 * Fields: id, supplier_id, reviewer_id, quality_score, delivery_score,
 *         communication_score, price_score, overall_score, review_text,
 *         order_id, created_at, updated_at
 */
export default class SupplierScore extends BaseModel {
  static get tableName() {
    return 'supplier_scores';
  }

  static async findBySupplier(supplierId, page = 1, limit = 20) {
    return this.findAll({ page, limit, filters: { supplier_id: supplierId }, orderBy: 'created_at' });
  }

  static async getAggregateScore(supplierId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('quality_score, delivery_score, communication_score, price_score, overall_score')
      .eq('supplier_id', supplierId);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const avg = (key) => data.reduce((sum, r) => sum + (r[key] || 0), 0) / data.length;
    return {
      quality: avg('quality_score'),
      delivery: avg('delivery_score'),
      communication: avg('communication_score'),
      price: avg('price_score'),
      overall: avg('overall_score'),
      count: data.length,
    };
  }
}
