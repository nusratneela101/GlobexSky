import BaseModel from './BaseModel.js';
import { randomBytes } from 'crypto';

/**
 * ProductComparison model
 *
 * Table: product_comparisons
 * Fields: id, user_id (nullable), products (JSONB array of product_ids),
 *         name, is_public, share_token, created_at, updated_at
 *
 * Related tables: comparison_attributes, product_comparison_config
 */
export default class ProductComparison extends BaseModel {
  static get tableName() {
    return 'product_comparisons';
  }

  /**
   * Create a new comparison.
   * @param {object} data - { user_id?, products?, name?, is_public? }
   * @returns {Promise<object>}
   */
  static async createComparison({ user_id = null, products = [], name = null, is_public = false }) {
    const share_token = is_public ? randomBytes(16).toString('hex') : null;
    return this.create({ user_id, products, name, is_public, share_token });
  }

  /**
   * Add a product_id to an existing comparison.
   * Respects the max_products config value.
   * @param {string} id - comparison UUID
   * @param {string} product_id - product UUID to add
   * @param {number} maxProducts - max allowed products
   * @returns {Promise<object>}
   */
  static async addProduct(id, product_id, maxProducts = 5) {
    const comparison = await this.findById(id);
    if (!comparison) throw Object.assign(new Error('Comparison not found'), { status: 404 });

    const existing = Array.isArray(comparison.products) ? comparison.products : [];
    if (existing.includes(product_id)) {
      throw Object.assign(new Error('Product already in comparison'), { status: 409 });
    }
    if (existing.length >= maxProducts) {
      throw Object.assign(new Error(`Maximum of ${maxProducts} products allowed per comparison`), { status: 422 });
    }

    return this.update(id, { products: [...existing, product_id] });
  }

  /**
   * Remove a product_id from an existing comparison.
   * @param {string} id - comparison UUID
   * @param {string} product_id - product UUID to remove
   * @returns {Promise<object>}
   */
  static async removeProduct(id, product_id) {
    const comparison = await this.findById(id);
    if (!comparison) throw Object.assign(new Error('Comparison not found'), { status: 404 });

    const existing = Array.isArray(comparison.products) ? comparison.products : [];
    const updated = existing.filter(pid => pid !== product_id);
    return this.update(id, { products: updated });
  }

  /**
   * Get a comparison with full product data joined in.
   * @param {string} id - comparison UUID
   * @returns {Promise<object|null>}
   */
  static async getComparison(id) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Get all comparisons belonging to a user, paginated.
   * @param {string} user_id
   * @param {object} options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async getByUser(user_id, { page = 1, limit = 20 } = {}) {
    return this.findAll({ page, limit, filters: { user_id }, orderBy: 'created_at', ascending: false });
  }

  /**
   * Get a public comparison by its share token.
   * @param {string} token
   * @returns {Promise<object|null>}
   */
  static async getByShareToken(token) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('share_token', token)
      .eq('is_public', true)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Get active comparison attributes for a category.
   * @param {string} category_id
   * @returns {Promise<object[]>}
   */
  static async getComparisonAttributes(category_id) {
    const result = await this.db
      .from('comparison_attributes')
      .select('*')
      .eq('category_id', category_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return this._handle(result) ?? [];
  }

  /**
   * Get all comparison config values as a key→value map.
   * @returns {Promise<object>}
   */
  static async getConfig() {
    const result = await this.db
      .from('product_comparison_config')
      .select('key, value');
    const rows = this._handle(result) ?? [];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  /**
   * Update one or more config keys.
   * @param {object} updates - { key: value, ... }
   * @param {string} updated_by - admin user UUID
   * @returns {Promise<object[]>}
   */
  static async updateConfig(updates, updated_by) {
    const now = new Date().toISOString();
    const upserts = Object.entries(updates).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: now,
      updated_by,
    }));
    const result = await this.db
      .from('product_comparison_config')
      .upsert(upserts, { onConflict: 'key' })
      .select();
    return this._handle(result);
  }
}
