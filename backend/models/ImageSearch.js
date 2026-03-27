import BaseModel from './BaseModel.js';

/**
 * ImageSearch model
 *
 * Tables: image_search_history, image_search_config
 * Fields (history): id, user_id, image_url, search_type, results, provider,
 *                   processing_time_ms, created_at
 * Fields (config):  id, key, value, description, is_encrypted, updated_at, updated_by
 */
export default class ImageSearch extends BaseModel {
  static get tableName() {
    return 'image_search_history';
  }

  // ─── Search History ──────────────────────────────────────────────

  /**
   * Save a completed image search to history.
   * @param {object} data - { user_id?, image_url, search_type, results, provider, processing_time_ms }
   * @returns {Promise<object>}
   */
  static async saveSearch(data) {
    const result = await this.db
      .from('image_search_history')
      .insert({
        user_id: data.user_id || null,
        image_url: data.image_url || null,
        search_type: data.search_type || 'upload',
        results: data.results || [],
        provider: data.provider || null,
        processing_time_ms: data.processing_time_ms || null,
      })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get paginated search history (admin view — all users).
   * @param {object} [options] - { page, limit }
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async getHistory({ page = 1, limit = 20 } = {}) {
    return this.findAll({ page, limit, orderBy: 'created_at', ascending: false });
  }

  /**
   * Get search history for a specific user.
   * @param {string} userId - UUID
   * @param {object} [options] - { page, limit }
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async getByUser(userId, { page = 1, limit = 20 } = {}) {
    return this.findAll({
      page,
      limit,
      filters: { user_id: userId },
      orderBy: 'created_at',
      ascending: false,
    });
  }

  // ─── Configuration ───────────────────────────────────────────────

  /**
   * Get all configuration rows.
   * @returns {Promise<object[]>}
   */
  static async getConfig() {
    const result = await this.db
      .from('image_search_config')
      .select('*')
      .order('key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Get a single config value by key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  static async getConfigValue(key) {
    const result = await this.db
      .from('image_search_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    const row = this._handle(result);
    return row ? row.value : null;
  }

  /**
   * Upsert one config key→value pair.
   * @param {string} key
   * @param {string} value
   * @param {string} [actorId] - UUID of admin performing the update
   * @returns {Promise<object>}
   */
  static async setConfigValue(key, value, actorId) {
    const result = await this.db
      .from('image_search_config')
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: actorId || null,
      })
      .eq('key', key)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Bulk-update multiple config keys.
   * @param {object} updates - { key: value, … }
   * @param {string} [actorId] - UUID of admin
   * @returns {Promise<object[]>}
   */
  static async saveConfig(updates, actorId) {
    const now = new Date().toISOString();
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const result = await this.db
        .from('image_search_config')
        .update({ value: String(value), updated_at: now, updated_by: actorId || null })
        .eq('key', key)
        .select()
        .single();
      results.push(this._handle(result));
    }
    return results;
  }

  // ─── Statistics ──────────────────────────────────────────────────

  /**
   * Get aggregate search statistics.
   * @returns {Promise<object>}
   */
  static async getStats() {
    const [totalResult, providerResult, recentResult] = await Promise.all([
      this.db.from('image_search_history').select('id', { count: 'exact', head: true }),
      this.db.from('image_search_history').select('provider').not('provider', 'is', null),
      this.db
        .from('image_search_history')
        .select('id, provider, processing_time_ms, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const total = totalResult.count ?? 0;
    const providers = {};
    (providerResult.data || []).forEach(({ provider }) => {
      providers[provider] = (providers[provider] || 0) + 1;
    });
    const recent = recentResult.data || [];

    return { total, providers, recent };
  }
}
