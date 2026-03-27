import BaseModel from './BaseModel.js';

/**
 * TradeAssurance model
 *
 * Covers four tables:
 *   - trade_assurance_policies   (policy definitions)
 *   - trade_assurance_claims     (buyer claims)
 *   - trade_assurance_deposits   (supplier security deposits)
 *   - trade_assurance_config     (admin-configurable settings)
 */

// ─── Policy ──────────────────────────────────────────────────────────────────

export class TradeAssurancePolicy extends BaseModel {
  static get tableName() {
    return 'trade_assurance_policies';
  }

  /**
   * Return only active policies.
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findActive(options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, is_active: true } });
  }
}

// ─── Claim ───────────────────────────────────────────────────────────────────

export class TradeAssuranceClaim extends BaseModel {
  static get tableName() {
    return 'trade_assurance_claims';
  }

  /**
   * File a new claim.
   * @param {object} data - { policy_id, order_id, buyer_id, supplier_id, claim_amount, reason, description, evidence_urls, is_test_mode }
   * @returns {Promise<object>}
   */
  static async fileClaim(data) {
    return this.create({
      ...data,
      status: 'pending',
      evidence_urls: data.evidence_urls ?? [],
    });
  }

  /**
   * Resolve a claim (admin action).
   * @param {string} id - claim UUID
   * @param {object} resolution - { status, resolution, resolution_amount, resolved_by }
   * @returns {Promise<object>}
   */
  static async resolveClaim(id, { status, resolution, resolution_amount, resolved_by }) {
    const allowedStatuses = ['approved', 'rejected', 'resolved', 'closed'];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid resolution status: ${status}`);
    }
    return this.update(id, {
      status,
      resolution,
      resolution_amount: resolution_amount ?? null,
      resolved_by: resolved_by ?? null,
      resolved_at: new Date().toISOString(),
    });
  }

  /**
   * Find all claims for a specific buyer.
   * @param {string} buyerId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByBuyer(buyerId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, buyer_id: buyerId } });
  }

  /**
   * Find claims by status (admin).
   * @param {string} status
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByStatus(status, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, status } });
  }
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

export class TradeAssuranceDeposit extends BaseModel {
  static get tableName() {
    return 'trade_assurance_deposits';
  }

  /**
   * Find all deposits for a specific supplier.
   * @param {string} supplierId
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findBySupplier(supplierId, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, supplier_id: supplierId } });
  }

  /**
   * Release a deposit back to the supplier.
   * @param {string} id - deposit UUID
   * @returns {Promise<object>}
   */
  static async releaseDeposit(id) {
    return this.update(id, { status: 'released', released_at: new Date().toISOString() });
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

export class TradeAssuranceConfig extends BaseModel {
  static get tableName() {
    return 'trade_assurance_config';
  }

  /**
   * Get the value of a single config key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  static async getValue(key) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }

  /**
   * Return all config as a flat key→value map.
   * @returns {Promise<object>}
   */
  static async getAll() {
    const { data, error } = await this.db.from(this.tableName).select('key,value');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  }

  /**
   * Upsert a config key.
   * @param {string} key
   * @param {string} value
   * @param {string} [updatedBy]
   * @returns {Promise<object>}
   */
  static async setValue(key, value, updatedBy) {
    const { data, error } = await this.db
      .from(this.tableName)
      .upsert(
        { key, value, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Return true when Trade Assurance is operating in test mode.
   * @returns {Promise<boolean>}
   */
  static async isTestMode() {
    const mode = await this.getValue('mode');
    return mode !== 'live';
  }

  /**
   * Bulk-update config from a plain object { key: value, ... }.
   * @param {object} settings
   * @param {string} [updatedBy]
   * @returns {Promise<object>} updated flat map
   */
  static async setMany(settings, updatedBy) {
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.db
      .from(this.tableName)
      .upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return this.getAll();
  }
}

// ─── Default export (primary entry point) ───────────────────────────────────

export default {
  TradeAssurancePolicy,
  TradeAssuranceClaim,
  TradeAssuranceDeposit,
  TradeAssuranceConfig,
};
