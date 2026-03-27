import BaseModel from './BaseModel.js';

/**
 * Escrow model
 *
 * Tables: escrow_transactions, escrow_milestones, escrow_audit_log, escrow_config
 */
export default class Escrow extends BaseModel {
  static get tableName() {
    return 'escrow_transactions';
  }

  // ─── Escrow Transactions ────────────────────────────────────────

  /**
   * Create a new escrow transaction and record an audit entry.
   * @param {object} data - { order_id, buyer_id, supplier_id, amount, currency }
   * @param {string} actorId - ID of the user performing the action
   * @returns {Promise<object>}
   */
  static async createEscrow(data, actorId) {
    const escrow = await this.create({
      ...data,
      status: 'held',
      held_at: new Date().toISOString(),
    });
    await this._auditLog(escrow.id, 'escrow_created', actorId, { amount: escrow.amount, currency: escrow.currency });
    return escrow;
  }

  /**
   * Mark funds as held (idempotent update to held state).
   * @param {string} escrowId
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async holdFunds(escrowId, actorId) {
    const escrow = await this.update(escrowId, {
      status: 'held',
      held_at: new Date().toISOString(),
    });
    await this._auditLog(escrowId, 'funds_held', actorId, { status: 'held' });
    return escrow;
  }

  /**
   * Release held funds to the supplier.
   * @param {string} escrowId
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async releaseFunds(escrowId, actorId) {
    const escrow = await this.update(escrowId, {
      status: 'released',
      released_at: new Date().toISOString(),
    });
    await this._auditLog(escrowId, 'funds_released', actorId, { status: 'released' });
    return escrow;
  }

  /**
   * Refund held funds back to the buyer.
   * @param {string} escrowId
   * @param {string} actorId
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  static async refundFunds(escrowId, actorId, reason) {
    const escrow = await this.update(escrowId, {
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    });
    await this._auditLog(escrowId, 'funds_refunded', actorId, { status: 'refunded', reason: reason || null });
    return escrow;
  }

  // ─── Milestones ─────────────────────────────────────────────────

  /**
   * Add a milestone to an escrow transaction.
   * @param {string} escrowId
   * @param {object} milestoneData - { name, amount, due_date }
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async addMilestone(escrowId, milestoneData, actorId) {
    const result = await this.db
      .from('escrow_milestones')
      .insert({ ...milestoneData, escrow_id: escrowId, status: 'pending' })
      .select()
      .single();
    const milestone = this._handle(result);
    await this._auditLog(escrowId, 'milestone_added', actorId, { milestone_id: milestone.id, name: milestone.name });
    return milestone;
  }

  /**
   * Mark a milestone as completed.
   * @param {string} escrowId
   * @param {string} milestoneId
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async completeMilestone(escrowId, milestoneId, actorId) {
    const result = await this.db
      .from('escrow_milestones')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', milestoneId)
      .eq('escrow_id', escrowId)
      .select()
      .single();
    const milestone = this._handle(result);
    await this._auditLog(escrowId, 'milestone_completed', actorId, { milestone_id: milestoneId });
    return milestone;
  }

  /**
   * Get milestones for an escrow transaction.
   * @param {string} escrowId
   * @returns {Promise<object[]>}
   */
  static async getMilestones(escrowId) {
    const result = await this.db
      .from('escrow_milestones')
      .select('*')
      .eq('escrow_id', escrowId)
      .order('created_at', { ascending: true });
    return this._handle(result);
  }

  // ─── Queries ────────────────────────────────────────────────────

  /**
   * Get escrow transaction(s) by order ID.
   * @param {string} orderId
   * @returns {Promise<object[]>}
   */
  static async getByOrder(orderId) {
    const result = await this.db
      .from(this.tableName)
      .select('*, milestones:escrow_milestones(*)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Get paginated audit log for an escrow transaction.
   * @param {string} escrowId
   * @param {number} [page=1]
   * @param {number} [limit=20]
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async getAuditLog(escrowId, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const result = await this.db
      .from('escrow_audit_log')
      .select('*', { count: 'exact' })
      .eq('escrow_id', escrowId)
      .order('created_at', { ascending: false })
      .range(from, to);
    const { data, error, count } = result;
    if (error) throw error;
    return { data, total: count };
  }

  // ─── Config ─────────────────────────────────────────────────────

  /**
   * Get all escrow config entries.
   * @returns {Promise<object[]>}
   */
  static async getConfig() {
    const result = await this.db
      .from('escrow_config')
      .select('*')
      .order('key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a config entry.
   * @param {string} key
   * @param {string} value
   * @param {string} actorId
   * @param {boolean} [isEncrypted=false]
   * @returns {Promise<object>}
   */
  static async setConfig(key, value, actorId, isEncrypted = false) {
    const result = await this.db
      .from('escrow_config')
      .upsert(
        { key, value, is_encrypted: isEncrypted, updated_at: new Date().toISOString(), updated_by: actorId },
        { onConflict: 'key' },
      )
      .select()
      .single();
    return this._handle(result);
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /**
   * Append an entry to the audit log.
   * @private
   */
  static async _auditLog(escrowId, action, actorId, details = {}) {
    await this.db.from('escrow_audit_log').insert({
      escrow_id: escrowId,
      action,
      actor_id: actorId,
      details,
    });
  }
}
