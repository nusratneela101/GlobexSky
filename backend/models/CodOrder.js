import BaseModel from './BaseModel.js';

/**
 * CodOrder model
 *
 * Table: cod_orders
 * Fields: id, order_id, buyer_id, carrier_id, supplier_id, amount, surcharge,
 *         status, delivery_address, phone_number, attempts, collected_at,
 *         remitted_at, delivery_agent_id, notes, fraud_score, is_flagged,
 *         fraud_reason, delivered_at, created_at, updated_at
 *
 * Status values: pending | delivered | collected | returned | flagged |
 *                undelivered | redelivery_scheduled
 */
export default class CodOrder extends BaseModel {
  static get tableName() {
    return 'cod_orders';
  }

  /**
   * Find all COD orders for a specific buyer.
   * @param {string} buyerId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Find all COD orders assigned to a carrier/delivery agent.
   * @param {string} carrierId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByCarrier(carrierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, carrier_id: carrierId } });
  }

  /**
   * Find all COD orders for a supplier.
   * @param {string} supplierId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Update the status of a COD order.
   * @param {string} id
   * @param {string} status
   * @param {object} [extra] - additional fields to update alongside status
   * @returns {Promise<object>}
   */
  static async updateStatus(id, status, extra = {}) {
    const result = await this.db
      .from(this.tableName)
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Bulk-update status for multiple COD orders at once.
   * @param {string[]} ids - array of COD order UUIDs
   * @param {string} status - target status
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
   * Mark a COD order as collected (cash received).
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async markCollected(id) {
    return this.updateStatus(id, 'collected', { collected_at: new Date().toISOString() });
  }

  /**
   * Mark a COD order as remitted (funds transferred to seller).
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async markRemitted(id) {
    const result = await this.db
      .from(this.tableName)
      .update({ remitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get COD orders with optional filters.
   * @param {object} filters - { status, is_flagged, start, end }
   * @param {object} pagination - { page, limit }
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async getFiltered({ status, is_flagged, start, end } = {}, { page = 1, limit = 20 } = {}) {
    let query = this.db
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (is_flagged !== undefined) query = query.eq('is_flagged', is_flagged);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  }

  /**
   * Get aggregated analytics for COD orders.
   * @param {object} [opts] - { start, end }
   * @returns {Promise<object>}
   */
  static async getAnalytics({ start, end } = {}) {
    let query = this.db
      .from(this.tableName)
      .select('status,amount,surcharge,fraud_score,is_flagged,created_at,delivered_at,collected_at,remitted_at');

    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    const { data, error } = await query;
    if (error) throw error;

    const orders = data || [];
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((s, o) => s + (+o.amount || 0), 0);
    const totalSurcharge = orders.reduce((s, o) => s + (+o.surcharge || 0), 0);
    const collectedAmount = orders.filter(o => o.status === 'collected').reduce((s, o) => s + (+o.amount || 0), 0);
    const remittedAmount = orders.filter(o => o.remitted_at).reduce((s, o) => s + (+o.amount || 0), 0);
    const byStatus = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    const successRate = totalOrders > 0 ? +((byStatus.collected || 0) / totalOrders * 100).toFixed(1) : 0;
    const failedRate = totalOrders > 0 ? +((byStatus.returned || 0) / totalOrders * 100).toFixed(1) : 0;
    const avgOrderValue = totalOrders > 0 ? +(totalAmount / totalOrders).toFixed(2) : 0;
    const avgFraudScore = orders.length > 0
      ? +(orders.reduce((s, o) => s + (+o.fraud_score || 0), 0) / orders.length).toFixed(1)
      : 0;

    return {
      total_orders: totalOrders,
      total_amount: +totalAmount.toFixed(2),
      total_surcharge: +totalSurcharge.toFixed(2),
      collected_amount: +collectedAmount.toFixed(2),
      remitted_amount: +remittedAmount.toFixed(2),
      pending_remittance: +(collectedAmount - remittedAmount).toFixed(2),
      success_rate: successRate,
      failed_delivery_rate: failedRate,
      avg_order_value: avgOrderValue,
      avg_fraud_score: avgFraudScore,
      flagged_count: orders.filter(o => o.is_flagged).length,
      by_status: byStatus,
    };
  }
}
