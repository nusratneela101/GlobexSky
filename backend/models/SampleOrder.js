import BaseModel from './BaseModel.js';

/**
 * SampleOrder model
 *
 * Table: sample_orders
 * Fields: id, buyer_id, supplier_id, product_id, quantity, message,
 *         shipping_address_id, status, tracking_number, cost, is_free,
 *         supplier_notes, buyer_feedback, buyer_rating, created_at, updated_at
 */
export default class SampleOrder extends BaseModel {
  static get tableName() {
    return 'sample_orders';
  }

  // ─── Buyer actions ─────────────────────────────────────────────────────────

  /**
   * Create a new sample request.
   * @param {object} data - { buyer_id, supplier_id, product_id, quantity, message, shipping_address_id, cost, is_free }
   * @returns {Promise<object>}
   */
  static async requestSample(data) {
    return this.create({
      ...data,
      status: 'pending',
      quantity: data.quantity ?? 1,
      is_free: data.is_free ?? false,
      cost: data.cost ?? 0,
    });
  }

  /**
   * Buyer confirms delivery of the sample.
   * @param {string} id - sample order UUID
   * @param {string} buyerId - must match the order's buyer_id
   * @returns {Promise<object>}
   */
  static async deliverSample(id, buyerId) {
    const order = await this.findById(id);
    if (!order) throw new Error('Sample order not found.');
    if (order.buyer_id !== buyerId) throw new Error('Forbidden.');
    if (order.status !== 'shipped') throw new Error('Sample must be in "shipped" status to confirm delivery.');
    return this.update(id, { status: 'delivered' });
  }

  /**
   * Buyer adds feedback/rating after delivery.
   * @param {string} id
   * @param {string} buyerId
   * @param {object} feedbackData - { buyer_feedback, buyer_rating }
   * @returns {Promise<object>}
   */
  static async addFeedback(id, buyerId, { buyer_feedback, buyer_rating }) {
    const order = await this.findById(id);
    if (!order) throw new Error('Sample order not found.');
    if (order.buyer_id !== buyerId) throw new Error('Forbidden.');
    if (!['delivered', 'reviewed'].includes(order.status)) {
      throw new Error('Sample must be delivered before adding feedback.');
    }
    if (buyer_rating !== undefined && (buyer_rating < 1 || buyer_rating > 5)) {
      throw new Error('Rating must be between 1 and 5.');
    }
    return this.update(id, { buyer_feedback, buyer_rating, status: 'reviewed' });
  }

  // ─── Supplier actions ──────────────────────────────────────────────────────

  /**
   * Supplier approves a pending sample request.
   * @param {string} id
   * @param {string} supplierId
   * @param {object} [opts] - { supplier_notes, cost, is_free }
   * @returns {Promise<object>}
   */
  static async approveSample(id, supplierId, opts = {}) {
    const order = await this.findById(id);
    if (!order) throw new Error('Sample order not found.');
    if (order.supplier_id !== supplierId) throw new Error('Forbidden.');
    if (order.status !== 'pending') throw new Error('Only pending orders can be approved.');
    return this.update(id, {
      status: 'approved',
      supplier_notes: opts.supplier_notes ?? order.supplier_notes,
      cost: opts.cost ?? order.cost,
      is_free: opts.is_free ?? order.is_free,
    });
  }

  /**
   * Supplier rejects a pending sample request.
   * @param {string} id
   * @param {string} supplierId
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  static async rejectSample(id, supplierId, reason) {
    const order = await this.findById(id);
    if (!order) throw new Error('Sample order not found.');
    if (order.supplier_id !== supplierId) throw new Error('Forbidden.');
    if (order.status !== 'pending') throw new Error('Only pending orders can be rejected.');
    return this.update(id, {
      status: 'rejected',
      supplier_notes: reason ?? order.supplier_notes,
    });
  }

  /**
   * Supplier marks the sample as shipped.
   * @param {string} id
   * @param {string} supplierId
   * @param {string} trackingNumber
   * @returns {Promise<object>}
   */
  static async shipSample(id, supplierId, trackingNumber) {
    const order = await this.findById(id);
    if (!order) throw new Error('Sample order not found.');
    if (order.supplier_id !== supplierId) throw new Error('Forbidden.');
    if (order.status !== 'approved') throw new Error('Only approved orders can be shipped.');
    return this.update(id, { status: 'shipped', tracking_number: trackingNumber });
  }

  // ─── Query helpers ─────────────────────────────────────────────────────────

  /**
   * Get all sample orders for a buyer.
   * @param {string} buyerId
   * @param {object} [options] - pagination options
   */
  static async getByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Get all sample orders for a supplier.
   * @param {string} supplierId
   * @param {object} [options]
   */
  static async getBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Get all sample orders for a product.
   * @param {string} productId
   * @param {object} [options]
   */
  static async getByProduct(productId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, product_id: productId } });
  }

  /**
   * Check if a buyer is eligible to request a sample.
   * Returns { eligible: boolean, reason?: string }
   * @param {string} buyerId
   * @param {string} productId
   * @param {string} supplierId
   * @param {object} config - { max_samples_per_buyer, max_samples_per_product, sample_request_cooldown_days }
   */
  static async checkEligibility(buyerId, productId, supplierId, config = {}) {
    const {
      max_samples_per_buyer = 3,
      max_samples_per_product = 1,
      sample_request_cooldown_days = 30,
    } = config;

    // Check open orders count for buyer
    const { data: buyerOrders } = await this.findAll({
      limit: 100,
      filters: { buyer_id: buyerId },
    });
    const openOrders = (buyerOrders || []).filter(o =>
      ['pending', 'approved', 'shipped'].includes(o.status)
    );
    if (openOrders.length >= Number(max_samples_per_buyer)) {
      return { eligible: false, reason: `You already have ${max_samples_per_buyer} active sample requests.` };
    }

    // Check if buyer already requested this product
    const { data: productOrders } = await this.findAll({
      limit: 100,
      filters: { buyer_id: buyerId, product_id: productId },
    });
    if ((productOrders || []).length >= Number(max_samples_per_product)) {
      return { eligible: false, reason: 'You have already requested a sample for this product.' };
    }

    // Check cooldown: last order to this supplier within cooldown_days
    const { data: supplierOrders } = await this.findAll({
      limit: 100,
      filters: { buyer_id: buyerId, supplier_id: supplierId },
    });
    if (supplierOrders && supplierOrders.length > 0) {
      const cooldownMs = Number(sample_request_cooldown_days) * 24 * 60 * 60 * 1000;
      const latest = supplierOrders.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
      if (Date.now() - new Date(latest.created_at).getTime() < cooldownMs) {
        return { eligible: false, reason: `You must wait ${sample_request_cooldown_days} days between sample requests to the same supplier.` };
      }
    }

    return { eligible: true };
  }
}

// ─── SampleOrderConfig model ───────────────────────────────────────────────

/**
 * SampleOrderConfig model
 *
 * Table: sample_order_config
 * Fields: id, key, value, description, updated_at, updated_by
 */
export class SampleOrderConfig extends BaseModel {
  static get tableName() {
    return 'sample_order_config';
  }

  /**
   * Return all config rows as a key→value plain object.
   * @returns {Promise<object>}
   */
  static async getAll() {
    const result = await this.db
      .from(this.tableName)
      .select('key, value');
    const rows = this._handle(result) || [];
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  }

  /**
   * Upsert a config value by key.
   * @param {string} key
   * @param {string} value
   * @param {string} [updatedBy] - UUID of admin user
   * @returns {Promise<object>}
   */
  static async set(key, value, updatedBy) {
    const result = await this.db
      .from(this.tableName)
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
        { onConflict: 'key' }
      )
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Bulk upsert multiple config key/value pairs.
   * @param {object} kvMap - { key: value, ... }
   * @param {string} [updatedBy]
   * @returns {Promise<object[]>}
   */
  static async setMany(kvMap, updatedBy) {
    const rows = Object.entries(kvMap).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    }));
    const result = await this.db
      .from(this.tableName)
      .upsert(rows, { onConflict: 'key' })
      .select();
    return this._handle(result);
  }
}
