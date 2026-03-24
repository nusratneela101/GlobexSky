import BaseModel from './BaseModel.js';

/**
 * CarrierProduct model
 *
 * Table: carrier_products
 * Fields: id, name, category, rate_per_kg, min_weight, max_weight,
 *         bonus_rate, surge_multiplier, platform_fee_percent,
 *         is_active, created_at, updated_at
 */
export default class CarrierProduct extends BaseModel {
  static get tableName() {
    return 'carrier_products';
  }

  /**
   * Find all carrier products belonging to a category.
   * @param {string} category
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByCategory(category, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, category } });
  }

  /**
   * Calculate the shipping price for a given weight using a carrier product.
   * @param {string} id
   * @param {number} weightKg
   * @returns {Promise<number>} calculated price
   */
  static async calculatePrice(id, weightKg) {
    const product = await this.findById(id);
    if (!product) throw new Error(`CarrierProduct ${id} not found`);

    if (product.min_weight !== null && weightKg < product.min_weight) {
      throw new Error(`Weight ${weightKg}kg is below minimum ${product.min_weight}kg`);
    }
    if (product.max_weight !== null && weightKg > product.max_weight) {
      throw new Error(`Weight ${weightKg}kg exceeds maximum ${product.max_weight}kg`);
    }

    const base = weightKg * product.rate_per_kg;
    const withBonus = base + (product.bonus_rate || 0);
    const withSurge = withBonus * (product.surge_multiplier || 1);
    const fee = withSurge * (product.platform_fee_percent || 0) / 100;
    const total = withSurge + fee;

    return Math.round(total * 100) / 100;
  }
}
