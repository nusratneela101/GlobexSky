import BaseModel from './BaseModel.js';

/**
 * Product model
 *
 * Table: products
 * Fields: id, supplier_id, title, slug, description, category_id,
 *         subcategory_id, price, currency, min_order_qty, max_order_qty,
 *         unit, images, specifications, status, rejection_reason,
 *         is_featured, stock_quantity, sku, weight, dimensions,
 *         origin_country, hs_code, created_at, updated_at
 */
export default class Product extends BaseModel {
  static get tableName() {
    return 'products';
  }

  /**
   * Find a product by its URL slug.
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  static async findBySlug(slug) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Find all products belonging to a supplier.
   * @param {string} supplierId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Approve a product listing.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async approve(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Reject a product listing.
   * @param {string} id
   * @param {string} reason
   * @returns {Promise<object>}
   */
  static async reject(id, reason) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Bulk-update status for multiple products.
   * @param {string[]} ids
   * @param {string} status
   * @returns {Promise<object[]>}
   */
  static async bulkUpdateStatus(ids, status) {
    const result = await this.db
      .from(this.tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select();
    return this._handle(result);
  }

  /**
   * Full-text search across title and description.
   * Special ILIKE pattern characters (%, _, \) in the query are escaped so
   * that user input is treated as a literal string.
   * @param {string} query
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async search(query, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Escape backslash first, then ILIKE wildcards to prevent pattern injection
    const safe = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

    const { data, error, count } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      .range(from, to);

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }
}
