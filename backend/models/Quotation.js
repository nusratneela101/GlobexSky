import BaseModel from './BaseModel.js';

/**
 * Quotation model
 *
 * Table: quotations
 * Fields: id, rfq_id, supplier_id, unit_price, total_price, currency,
 *         min_order_qty, lead_time_days, validity_days, notes, attachments,
 *         status, created_at, updated_at
 */
export default class Quotation extends BaseModel {
  static get tableName() {
    return 'quotations';
  }

  /**
   * Find all quotations for a specific RFQ.
   * @param {string} rfqId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByRFQ(rfqId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, rfq_id: rfqId } });
  }

  /**
   * Find all quotations submitted by a supplier.
   * @param {string} supplierId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Accept a quotation.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async accept(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Reject a quotation.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async reject(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Compare all quotations for a given RFQ, sorted by unit_price ascending.
   * @param {string} rfqId
   * @returns {Promise<object[]>}
   */
  static async compare(rfqId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('rfq_id', rfqId)
      .order('unit_price', { ascending: true });
    return this._handle(result);
  }
}
