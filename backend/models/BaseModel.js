import supabase from '../config/supabase.js';

/**
 * BaseModel — shared Supabase CRUD helpers for all models.
 *
 * Usage:
 *   class User extends BaseModel {
 *     static get tableName() { return 'users'; }
 *   }
 */
export default class BaseModel {
  /** Supabase client (service-role, bypasses RLS). */
  static get db() {
    return supabase;
  }

  /** Override in each subclass. */
  static get tableName() {
    throw new Error('BaseModel: tableName getter must be overridden.');
  }

  /**
   * Wrap a Supabase query result; throw on error.
   * @param {{ data: any, error: any }} result
   * @returns {any}
   */
  static _handle({ data, error }) {
    if (error) throw error;
    return data;
  }

  /**
   * Find a single row by primary-key (id).
   * @param {string} id UUID
   * @returns {Promise<object|null>}
   */
  static async findById(id) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Insert a new row.
   * @param {object} data
   * @returns {Promise<object>}
   */
  static async create(data) {
    const result = await this.db
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Update an existing row by id.
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  static async update(id, data) {
    const result = await this.db
      .from(this.tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Delete a row by id.
   * @param {string} id
   * @returns {Promise<null>}
   */
  static async delete(id) {
    const result = await this.db
      .from(this.tableName)
      .delete()
      .eq('id', id);
    return this._handle(result);
  }

  /**
   * Paginated findAll helper.
   * @param {object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {object} [options.filters] - key/value pairs for .eq() filters
   * @param {string} [options.orderBy='created_at']
   * @param {boolean} [options.ascending=false]
   * @param {string} [options.select='*']
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findAll({
    page = 1,
    limit = 20,
    filters = {},
    orderBy = 'created_at',
    ascending = false,
    select = '*',
  } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from(this.tableName)
      .select(select, { count: 'exact' })
      .order(orderBy, { ascending })
      .range(from, to);

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data ?? [], total: count ?? 0, page, limit };
  }
}
