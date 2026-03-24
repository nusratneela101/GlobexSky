import BaseModel from './BaseModel.js';

/**
 * Order model
 *
 * Table: orders
 * Fields: id, order_number, buyer_id, supplier_id, items, subtotal,
 *         shipping_cost, tax, total, currency, status, shipping_address,
 *         billing_address, payment_method, payment_status, tracking_number,
 *         estimated_delivery, notes, created_at, updated_at
 */
export default class Order extends BaseModel {
  static get tableName() {
    return 'orders';
  }

  /**
   * Find an order by its human-readable order number.
   * @param {string} orderNumber
   * @returns {Promise<object|null>}
   */
  static async findByOrderNumber(orderNumber) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Find all orders placed by a buyer.
   * @param {string} buyerId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Find all orders for a supplier.
   * @param {string} supplierId
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Update the status of an order.
   * @param {string} id
   * @param {string} status
   * @returns {Promise<object>}
   */
  static async updateStatus(id, status) {
    const result = await this.db
      .from(this.tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Retrieve a chronological timeline of status changes for an order.
   * @param {string} orderId
   * @returns {Promise<object[]>}
   */
  static async getOrderTimeline(orderId) {
    const result = await this.db
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Split an order into multiple child orders by item groupings.
   * @param {string} orderId
   * @param {object[][]} itemGroups - array of item arrays for each new order
   * @returns {Promise<object[]>} created child orders
   */
  static async splitOrder(orderId, itemGroups) {
    const parent = await this.findById(orderId);
    if (!parent) throw new Error(`Order ${orderId} not found`);

    const children = await Promise.all(
      itemGroups.map((items) =>
        this.create({
          buyer_id: parent.buyer_id,
          supplier_id: parent.supplier_id,
          items,
          currency: parent.currency,
          shipping_address: parent.shipping_address,
          billing_address: parent.billing_address,
          payment_method: parent.payment_method,
          status: 'pending',
          parent_order_id: orderId,
        })
      )
    );

    return children;
  }

  /**
   * Merge multiple orders into a single order.
   * @param {string[]} orderIds
   * @param {object} [overrides] - fields to override on the merged order
   * @returns {Promise<object>} merged order
   */
  static async mergeOrders(orderIds, overrides = {}) {
    const orders = await Promise.all(orderIds.map((id) => this.findById(id)));
    const validOrders = orders.filter(Boolean);

    const mergedItems = validOrders.flatMap((o) => (Array.isArray(o.items) ? o.items : []));
    const subtotal = validOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const total = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const base = validOrders[0];
    const merged = await this.create({
      buyer_id: base.buyer_id,
      supplier_id: base.supplier_id,
      items: mergedItems,
      subtotal,
      total,
      currency: base.currency,
      shipping_address: base.shipping_address,
      billing_address: base.billing_address,
      payment_method: base.payment_method,
      status: 'pending',
      merged_from: orderIds,
      ...overrides,
    });

    return merged;
  }
}
