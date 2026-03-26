import BaseModel from './BaseModel.js';

/**
 * SearchHistory model
 *
 * Table: search_history_items
 * Fields:
 *   id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id       UUID NOT NULL REFERENCES auth.users(id)
 *   query         TEXT NOT NULL
 *   results_count INTEGER
 *   created_at    TIMESTAMPTZ DEFAULT now()
 *
 * Index: (user_id, created_at DESC) for fast per-user pagination.
 */
export default class SearchHistory extends BaseModel {
  static get tableName() {
    return 'search_history_items';
  }

  /**
   * Get paginated history for a user, newest first.
   * @param {string} userId
   * @param {object} [opts]
   * @param {number} [opts.limit=50]
   * @param {number} [opts.page=1]
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async findByUser(userId, { limit = 50, page = 1 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    const { data, error, count } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Record a search query for a user.
   * Enforces a cap of 50 items per user by deleting the oldest excess rows.
   * @param {string} userId
   * @param {string} query
   * @param {number} [resultsCount]
   * @returns {Promise<object>}
   */
  static async record(userId, query, resultsCount = null) {
    const item = await this.create({
      user_id: userId,
      query,
      results_count: resultsCount,
      created_at: new Date().toISOString(),
    });

    // Keep only the most recent 50 rows per user
    const { data: oldest } = await this.db
      .from(this.tableName)
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(50, 9999);

    if (oldest && oldest.length > 0) {
      const ids = oldest.map(r => r.id);
      await this.db.from(this.tableName).delete().in('id', ids);
    }

    return item;
  }

  /**
   * Delete all history for a user.
   * @param {string} userId
   * @returns {Promise<null>}
   */
  static async clearByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);
    return this._handle(result);
  }

  /**
   * Get the most popular search terms across all users (trending).
   * Returns top N queries by frequency over the last 7 days.
   * @param {number} [limit=10]
   * @returns {Promise<Array<{query: string, count: number}>>}
   */
  static async getTrending(limit = 10) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Use a raw Supabase RPC if available, otherwise approximate with JS
    try {
      const { data, error } = await this.db.rpc('get_trending_searches', {
        since_ts: since,
        result_limit: limit,
      });
      if (!error && data) return data;
    } catch (_) { /* fall through */ }

    // Fallback: fetch recent rows and aggregate in JS
    const { data, error } = await this.db
      .from(this.tableName)
      .select('query')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const counts = {};
    for (const row of (data || [])) {
      const q = (row.query || '').toLowerCase().trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }
}
