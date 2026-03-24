import BaseModel from './BaseModel.js';

/**
 * FeatureToggle model
 *
 * Table: feature_toggles
 * Fields: id, feature_key, name, description, is_enabled, environment,
 *         percentage_rollout, allowed_roles, created_at, updated_at
 */
export default class FeatureToggle extends BaseModel {
  static get tableName() {
    return 'feature_toggles';
  }

  /**
   * Find a feature toggle by its unique key.
   * @param {string} key
   * @returns {Promise<object|null>}
   */
  static async findByKey(key) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('feature_key', key)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Flip the is_enabled flag for a feature toggle.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async toggle(id) {
    const feature = await this.findById(id);
    if (!feature) throw new Error(`FeatureToggle ${id} not found`);

    const result = await this.db
      .from(this.tableName)
      .update({ is_enabled: !feature.is_enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Check whether a feature is enabled (optionally for a specific role/user).
   * @param {string} key - feature_key
   * @param {object} [context]
   * @param {string} [context.role] - user role to check against allowed_roles
   * @param {number} [context.rolloutSeed] - 0-100 value to check percentage rollout
   * @returns {Promise<boolean>}
   */
  static async isEnabled(key, { role, rolloutSeed } = {}) {
    const feature = await this.findByKey(key);
    if (!feature || !feature.is_enabled) return false;

    if (role && Array.isArray(feature.allowed_roles) && feature.allowed_roles.length > 0) {
      if (!feature.allowed_roles.includes(role)) return false;
    }

    if (feature.percentage_rollout !== null && feature.percentage_rollout < 100) {
      const seed = rolloutSeed !== undefined ? rolloutSeed : Math.random() * 100;
      if (seed > feature.percentage_rollout) return false;
    }

    return true;
  }
}
