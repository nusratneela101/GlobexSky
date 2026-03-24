import BaseModel from './BaseModel.js';

/**
 * RFQ (Request for Quotation) model
 *
 * Table: rfqs
 * Fields: id, rfq_number, buyer_id, title, description, category_id,
 *         quantity, unit, target_price, currency, specifications,
 *         attachments, status, deadline, quotations_count,
 *         awarded_supplier_id, created_at, updated_at
 */
export default class RFQ extends BaseModel {
  static get tableName() {
    return 'rfqs';
  }

  /**
   * Find all RFQs created by a buyer.
   * @param {string} buyerId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Find all open RFQs (status = 'open').
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findOpen(options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, status: 'open' } });
  }

  /**
   * Close an RFQ.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async close(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Award an RFQ to a supplier.
   * @param {string} id
   * @param {string} supplierId
   * @returns {Promise<object>}
   */
  static async award(id, supplierId) {
    const result = await this.db
      .from(this.tableName)
      .update({
        status: 'awarded',
        awarded_supplier_id: supplierId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}
