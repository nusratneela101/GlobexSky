import BaseModel from './BaseModel.js';

/**
 * Inspection model
 *
 * Table: inspections
 * Fields: id, request_number, buyer_id, supplier_id, product_id, order_id,
 *         type, status, inspector_id, scheduled_date, location, pricing,
 *         rush_fee, total_cost, report, photos, result, notes,
 *         created_at, updated_at
 */
export default class Inspection extends BaseModel {
  static get tableName() {
    return 'inspections';
  }

  /**
   * Find all inspection requests made by a buyer.
   * @param {string} buyerId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Find all inspection requests for a supplier.
   * @param {string} supplierId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Find all inspections assigned to an inspector.
   * @param {string} inspectorId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByInspector(inspectorId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, inspector_id: inspectorId } });
  }

  /**
   * Schedule an inspection by setting scheduled_date, inspector_id and updating status.
   * @param {string} id
   * @param {object} scheduleData
   * @param {string} scheduleData.scheduled_date
   * @param {string} scheduleData.inspector_id
   * @param {string} [scheduleData.location]
   * @returns {Promise<object>}
   */
  static async schedule(id, scheduleData) {
    const result = await this.db
      .from(this.tableName)
      .update({
        ...scheduleData,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Complete an inspection with its report and result.
   * @param {string} id
   * @param {object} completionData
   * @param {object} completionData.report
   * @param {string} completionData.result - pass/fail/conditional
   * @param {object[]} [completionData.photos]
   * @returns {Promise<object>}
   */
  static async complete(id, completionData) {
    const result = await this.db
      .from(this.tableName)
      .update({
        ...completionData,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Generate (return) the inspection report for a given inspection.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  static async generateReport(id) {
    const result = await this.db
      .from(this.tableName)
      .select('report, result, photos, notes, scheduled_date, inspector_id')
      .eq('id', id)
      .maybeSingle();
    return this._handle(result);
  }
}
