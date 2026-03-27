import BaseModel from './BaseModel.js';

/**
 * Recommendation model
 *
 * Primary table : product_recommendations
 * Config table  : recommendation_config
 * Interactions  : user_interactions
 */
export default class Recommendation extends BaseModel {
  static get tableName() { return 'product_recommendations'; }

  // ─── Config helpers ───────────────────────────────────────────────────────

  /** Return all config rows as a plain key→value object. */
  static async getAllConfig() {
    const { data, error } = await this.db
      .from('recommendation_config')
      .select('key, value, description, is_encrypted, updated_at, updated_by');
    if (error) throw error;
    return data ?? [];
  }

  /** Return the value for a single config key, or null. */
  static async getConfigValue(key) {
    const { data, error } = await this.db
      .from('recommendation_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }

  /** Upsert a config key/value pair. */
  static async setConfig(key, value, updatedBy = null) {
    const { data, error } = await this.db
      .from('recommendation_config')
      .update({ value, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ─── Interaction helpers ──────────────────────────────────────────────────

  /**
   * Record a user interaction (view / click / cart / purchase / wishlist).
   * @param {string} userId
   * @param {string} productId
   * @param {string} interactionType
   * @param {object} [metadata]
   */
  static async recordInteraction(userId, productId, interactionType, metadata = null) {
    const { data, error } = await this.db
      .from('user_interactions')
      .insert({ user_id: userId, product_id: productId, interaction_type: interactionType, metadata })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Count a user's total interactions (used to decide if personalisation is ready).
   * @param {string} userId
   */
  static async countUserInteractions(userId) {
    const { count, error } = await this.db
      .from('user_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Retrieve the most interacted-with products by a user
   * (used by the collaborative & content-based algorithms).
   * @param {string} userId
   * @param {number} [limit=50]
   */
  static async getUserInteractions(userId, limit = 50) {
    const { data, error } = await this.db
      .from('user_interactions')
      .select('product_id, interaction_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  // ─── Recommendation retrieval ─────────────────────────────────────────────

  /**
   * Get stored recommendations for a user, ordered by score.
   * @param {string} userId
   * @param {number} [limit=12]
   */
  static async getForUser(userId, limit = 12) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('product_recommendations')
      .select('*')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Batch-insert fresh recommendations for a user (replaces stale ones).
   * @param {string} userId
   * @param {Array<{product_id,score,algorithm,reason}>} recs
   * @param {number} [ttlHours=24]
   */
  static async generateRecommendations(userId, recs, ttlHours = 24) {
    // Soft-expire existing recs for this user
    await this.db
      .from('product_recommendations')
      .update({ expires_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (!recs.length) return [];

    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();
    const rows = recs.map(r => ({
      user_id:    userId,
      product_id: r.product_id,
      score:      r.score,
      algorithm:  r.algorithm,
      reason:     r.reason ?? null,
      expires_at: expiresAt,
    }));

    const { data, error } = await this.db
      .from('product_recommendations')
      .insert(rows)
      .select();
    if (error) throw error;
    return data ?? [];
  }

  /** Mark a recommendation as shown. */
  static async markShown(id) {
    const { data, error } = await this.db
      .from('product_recommendations')
      .update({ is_shown: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Mark a recommendation as clicked. */
  static async markClicked(id) {
    const { data, error } = await this.db
      .from('product_recommendations')
      .update({ is_clicked: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ─── Similar / trending helpers ───────────────────────────────────────────

  /**
   * Fetch products frequently viewed together with the given product.
   * @param {string} productId
   * @param {number} [limit=6]
   */
  static async getFrequentlyBoughtTogether(productId, limit = 6) {
    // Find users who interacted with this product
    const { data: actors, error: e1 } = await this.db
      .from('user_interactions')
      .select('user_id')
      .eq('product_id', productId)
      .in('interaction_type', ['purchase', 'cart']);
    if (e1) throw e1;

    if (!actors?.length) return [];

    const userIds = [...new Set(actors.map(a => a.user_id))];

    // Find other products those users also bought/carted
    const { data: co, error: e2 } = await this.db
      .from('user_interactions')
      .select('product_id')
      .in('user_id', userIds)
      .in('interaction_type', ['purchase', 'cart'])
      .neq('product_id', productId)
      .limit(limit * 10);
    if (e2) throw e2;

    // Count frequency and return top products
    const freq = {};
    (co ?? []).forEach(r => { freq[r.product_id] = (freq[r.product_id] ?? 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([product_id, count]) => ({ product_id, co_occurrence_count: count }));
  }

  /**
   * Return trending products based on recent interaction volume.
   * @param {number} [limit=12]
   * @param {number} [withinHours=48]
   */
  static async getTrending(limit = 12, withinHours = 48) {
    const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();
    const { data, error } = await this.db
      .from('user_interactions')
      .select('product_id')
      .gte('created_at', since)
      .limit(5000);
    if (error) throw error;

    const freq = {};
    (data ?? []).forEach(r => { freq[r.product_id] = (freq[r.product_id] ?? 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([product_id, interaction_count]) => ({ product_id, interaction_count }));
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  /** Return aggregate click-through stats. */
  static async getAnalytics() {
    const [shown, clicked] = await Promise.all([
      this.db.from('product_recommendations').select('id', { count: 'exact', head: true }).eq('is_shown', true),
      this.db.from('product_recommendations').select('id', { count: 'exact', head: true }).eq('is_clicked', true),
    ]);
    const totalShown   = shown.count   ?? 0;
    const totalClicked = clicked.count ?? 0;
    return {
      total_shown:   totalShown,
      total_clicked: totalClicked,
      ctr: totalShown > 0 ? ((totalClicked / totalShown) * 100).toFixed(2) : '0.00',
    };
  }
}
