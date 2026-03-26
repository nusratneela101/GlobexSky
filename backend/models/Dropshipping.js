import BaseModel from './BaseModel.js';

/**
 * Dropshipping model
 *
 * Table: dropshipping_products
 * Fields: id, supplier_id, original_product_id, seller_id, markup_percent,
 *         selling_price, status, imported_at, created_at
 */
export default class Dropshipping extends BaseModel {
  static get tableName() {
    return 'dropshipping_products';
  }

  /**
   * Find all dropshipping products imported by a seller.
   * @param {string} sellerId
   * @returns {Promise<object[]>}
   */
  static async findBySeller(sellerId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('seller_id', sellerId)
      .order('imported_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all dropshipping products sourced from a supplier.
   * @param {string} supplierId
   * @returns {Promise<object[]>}
   */
  static async findBySupplier(supplierId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }
}
