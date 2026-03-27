import BaseModel from './BaseModel.js';

/**
 * CustomizationRequest model
 *
 * Tables: customization_requests, customization_quotes,
 *         customization_messages, customization_config
 */
export default class CustomizationRequest extends BaseModel {
  static get tableName() {
    return 'customization_requests';
  }

  // ─── Requests ────────────────────────────────────────────────────

  /**
   * Create a new customization request (starts as draft).
   * @param {object} data
   * @returns {Promise<object>}
   */
  static async createRequest(data) {
    return this.create({ ...data, status: 'draft' });
  }

  /**
   * Submit a draft request (change status → submitted).
   * @param {string} requestId
   * @param {string} buyerId  — ownership check
   * @returns {Promise<object>}
   */
  static async submitRequest(requestId, buyerId) {
    const request = await this.findById(requestId);
    if (!request) {
      const err = new Error('Customization request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (request.buyer_id !== buyerId) {
      const err = new Error('Forbidden: you do not own this request.');
      err.statusCode = 403;
      throw err;
    }
    if (request.status !== 'draft') {
      const err = new Error('Only draft requests can be submitted.');
      err.statusCode = 422;
      throw err;
    }
    return this.update(requestId, { status: 'submitted', updated_at: new Date().toISOString() });
  }

  // ─── Quotes ──────────────────────────────────────────────────────

  /**
   * Supplier submits a quote for a request.
   * @param {string} requestId
   * @param {object} quoteData  — { supplier_id, unit_price, total_price, moq, lead_time_days, notes, valid_until }
   * @returns {Promise<object>}
   */
  static async addQuote(requestId, quoteData) {
    // Enforce max_quotes_per_request
    const configRow = await this._getConfigValue('max_quotes_per_request');
    const maxQuotes = parseInt(configRow ?? '10', 10);

    const { count, error: countErr } = await this.db
      .from('customization_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('request_id', requestId);
    if (countErr) throw countErr;
    if ((count ?? 0) >= maxQuotes) {
      const err = new Error(`Maximum of ${maxQuotes} quotes per request reached.`);
      err.statusCode = 422;
      throw err;
    }

    // Calculate valid_until from config if not provided
    let { valid_until } = quoteData;
    if (!valid_until) {
      const expiryDays = parseInt(await this._getConfigValue('quote_expiry_days') ?? '14', 10);
      const d = new Date();
      d.setDate(d.getDate() + expiryDays);
      valid_until = d.toISOString().slice(0, 10);
    }

    const result = await this.db
      .from('customization_quotes')
      .insert({ ...quoteData, request_id: requestId, status: 'pending', valid_until })
      .select()
      .single();
    const quote = this._handle(result);

    // Move request to 'quoted' state
    await this.db
      .from(this.tableName)
      .update({ status: 'quoted', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .in('status', ['submitted', 'quoted']);

    return quote;
  }

  /**
   * Buyer accepts a quote.
   * @param {string} requestId
   * @param {string} quoteId
   * @param {string} buyerId
   * @returns {Promise<object>}
   */
  static async acceptQuote(requestId, quoteId, buyerId) {
    const request = await this.findById(requestId);
    if (!request) {
      const err = new Error('Customization request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (request.buyer_id !== buyerId) {
      const err = new Error('Forbidden: you do not own this request.');
      err.statusCode = 403;
      throw err;
    }

    const quoteResult = await this.db
      .from('customization_quotes')
      .update({ status: 'accepted' })
      .eq('id', quoteId)
      .eq('request_id', requestId)
      .select()
      .single();
    const quote = this._handle(quoteResult);

    // Reject all other pending quotes for this request
    await this.db
      .from('customization_quotes')
      .update({ status: 'rejected' })
      .eq('request_id', requestId)
      .eq('status', 'pending')
      .neq('id', quoteId);

    // Move request to 'accepted'
    await this.db
      .from(this.tableName)
      .update({
        status: 'accepted',
        supplier_id: quote.supplier_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    return quote;
  }

  /**
   * Buyer rejects a specific quote.
   * @param {string} requestId
   * @param {string} quoteId
   * @param {string} buyerId
   * @returns {Promise<object>}
   */
  static async rejectQuote(requestId, quoteId, buyerId) {
    const request = await this.findById(requestId);
    if (!request) {
      const err = new Error('Customization request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (request.buyer_id !== buyerId) {
      const err = new Error('Forbidden: you do not own this request.');
      err.statusCode = 403;
      throw err;
    }

    const result = await this.db
      .from('customization_quotes')
      .update({ status: 'rejected' })
      .eq('id', quoteId)
      .eq('request_id', requestId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get all quotes for a request.
   * @param {string} requestId
   * @returns {Promise<object[]>}
   */
  static async getQuotes(requestId) {
    const result = await this.db
      .from('customization_quotes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  // ─── Messages ────────────────────────────────────────────────────

  /**
   * Send a message within a customization request thread.
   * @param {string} requestId
   * @param {object} msgData  — { sender_id, message, attachments }
   * @returns {Promise<object>}
   */
  static async sendMessage(requestId, msgData) {
    const result = await this.db
      .from('customization_messages')
      .insert({ ...msgData, request_id: requestId })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get messages for a request thread.
   * @param {string} requestId
   * @param {number} [page=1]
   * @param {number} [limit=50]
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async getMessages(requestId, page = 1, limit = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const result = await this.db
      .from('customization_messages')
      .select('*', { count: 'exact' })
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .range(from, to);
    const { data, error, count } = result;
    if (error) throw error;
    return { data, total: count ?? 0 };
  }

  // ─── Queries ─────────────────────────────────────────────────────

  /**
   * Get all requests submitted by a buyer (paginated), with quote count.
   * @param {string} buyerId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async getByBuyer(buyerId, options = {}) {
    const { page = 1, limit = 20, filters = {}, orderBy = 'created_at', ascending = false } = options;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from(this.tableName)
      .select('*, quotes:customization_quotes(id)', { count: 'exact' })
      .eq('buyer_id', buyerId)
      .order(orderBy, { ascending })
      .range(from, to);

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) query = query.eq(key, value);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    // Normalise: expose quote_count for convenience
    const rows = (data ?? []).map((r) => ({ ...r, quote_count: Array.isArray(r.quotes) ? r.quotes.length : 0 }));
    return { data: rows, total: count ?? 0, page, limit };
  }

  /**
   * Get all requests assigned to / received by a supplier (paginated), with quote count.
   * @param {string} supplierId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async getBySupplier(supplierId, options = {}) {
    const { page = 1, limit = 20, filters = {}, orderBy = 'created_at', ascending = false } = options;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from(this.tableName)
      .select('*, quotes:customization_quotes(id)', { count: 'exact' })
      .eq('supplier_id', supplierId)
      .order(orderBy, { ascending })
      .range(from, to);

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) query = query.eq(key, value);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({ ...r, quote_count: Array.isArray(r.quotes) ? r.quotes.length : 0 }));
    return { data: rows, total: count ?? 0, page, limit };
  }

  /**
   * Find suppliers whose profile matches the request's category/product keywords.
   * Returns up to 20 supplier IDs that could be notified.
   * (Placeholder — real implementation would JOIN with supplier/product tables.)
   * @param {string} _requestId
   * @returns {Promise<string[]>}
   */
  static async matchSuppliers(_requestId) {
    const result = await this.db
      .from('suppliers')
      .select('id')
      .eq('is_verified', true)
      .limit(20);
    const rows = this._handle(result) ?? [];
    return rows.map((r) => r.id);
  }

  // ─── Config ──────────────────────────────────────────────────────

  /**
   * Get all customization config entries.
   * @returns {Promise<object[]>}
   */
  static async getConfig() {
    const result = await this.db
      .from('customization_config')
      .select('*')
      .order('key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a config value.
   * @param {string} key
   * @param {string} value
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async setConfig(key, value, actorId) {
    const result = await this.db
      .from('customization_config')
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: actorId },
        { onConflict: 'key' },
      )
      .select()
      .single();
    return this._handle(result);
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /** @private */
  static async _getConfigValue(key) {
    const result = await this.db
      .from('customization_config')
      .select('value')
      .eq('key', key)
      .single();
    const row = this._handle(result);
    return row?.value ?? null;
  }
}
