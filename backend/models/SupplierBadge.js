import BaseModel from './BaseModel.js';

/**
 * SupplierBadge model
 *
 * Table: supplier_badges
 * Fields: id, supplier_id, badge_type, badge_name, awarded_at, expires_at,
 *         criteria_met, metadata, created_at, updated_at
 */
export default class SupplierBadge extends BaseModel {
  static get tableName() {
    return 'supplier_badges';
  }

  static async findBySupplier(supplierId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('supplier_id', supplierId)
      .order('awarded_at', { ascending: false });
    return this._handle(result);
  }

  static async award(supplierId, badgeType, badgeName, metadata = {}) {
    return this.create({
      supplier_id: supplierId,
      badge_type: badgeType,
      badge_name: badgeName,
      metadata,
    });
  }
}
