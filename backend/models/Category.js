import BaseModel from './BaseModel.js';

/**
 * Category model
 *
 * Table: categories
 * Fields: id, name, slug, parent_id, description, image_url, icon,
 *         commission_rate, is_active, sort_order, created_at
 */
export default class Category extends BaseModel {
  static get tableName() {
    return 'categories';
  }

  /**
   * Find a category by its URL slug.
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  static async findBySlug(slug) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Find all direct children of a parent category.
   * @param {string} parentId
   * @returns {Promise<object[]>}
   */
  static async findChildren(parentId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true });
    return this._handle(result);
  }

  /**
   * Find all top-level categories (where parent_id is null).
   * @returns {Promise<object[]>}
   */
  static async findByParent(parentId = null) {
    const query = this.db.from(this.tableName).select('*').order('sort_order', { ascending: true });
    const result = parentId === null ? await query.is('parent_id', null) : await query.eq('parent_id', parentId);
    return this._handle(result);
  }

  /**
   * Build the full category tree (all levels).
   * @returns {Promise<object[]>} nested tree structure
   */
  static async getTree() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const map = {};
    const roots = [];

    for (const cat of data ?? []) {
      map[cat.id] = { ...cat, children: [] };
    }
    for (const cat of data ?? []) {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    }

    return roots;
  }
}
