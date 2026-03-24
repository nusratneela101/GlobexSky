import BaseModel from './BaseModel.js';

/**
 * BlogPost model
 *
 * Table: blog_posts
 * Fields: id, author_id, title, slug, content, excerpt, featured_image,
 *         category, tags, status, published_at, views_count,
 *         created_at, updated_at
 */
export default class BlogPost extends BaseModel {
  static get tableName() {
    return 'blog_posts';
  }

  /**
   * Find a blog post by its URL slug.
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
   * Find all published blog posts (paginated).
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findPublished(options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, status: 'published' } });
  }

  /**
   * Find posts by category.
   * @param {string} category
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByCategory(category, options = {}) {
    return this.findAll({ ...options, filters: { ...options.filters, category } });
  }

  /**
   * Find posts that contain a specific tag.
   * @param {string} tag
   * @param {object} [options] - pagination options (page, limit)
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findByTag(tag, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .contains('tags', [tag])
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Atomically increment the views_count for a post.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async incrementViews(id) {
    const { data, error } = await this.db.rpc('increment_blog_views', { post_id: id });
    if (error) {
      // Fallback: read-then-write if RPC not available
      const post = await this.findById(id);
      if (!post) throw new Error(`BlogPost ${id} not found`);
      const result = await this.db
        .from(this.tableName)
        .update({ views_count: (post.views_count || 0) + 1 })
        .eq('id', id)
        .select()
        .single();
      return this._handle(result);
    }
    return data;
  }
}
