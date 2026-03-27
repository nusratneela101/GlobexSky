import BaseModel from './BaseModel.js';

/**
 * BadgeCatalog model
 *
 * Table: badge_catalog
 * Fields: id, name, description, icon, criteria (JSONB), tier (bronze/silver/gold/platinum),
 *         created_at, updated_at
 */
export default class BadgeCatalog extends BaseModel {
  static get tableName() {
    return 'badge_catalog';
  }

  /**
   * List all available badges.
   * @returns {Promise<object[]>}
   */
  static async listAll() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .order('tier', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Find badges by tier.
   * @param {string} tier
   * @returns {Promise<object[]>}
   */
  static async findByTier(tier) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('tier', tier)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
