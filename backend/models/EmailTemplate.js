import Template from './Template.js';

/**
 * EmailTemplate model
 *
 * Convenience subclass of Template scoped to type = 'email'.
 * All read/write helpers automatically filter to / enforce email type.
 */
export default class EmailTemplate extends Template {
  /** Always scope searches to email templates. */
  static async search(options = {}) {
    return super.search({ ...options, type: 'email' });
  }

  /**
   * Create a new email template.
   * Forces type = 'email' and validates that a subject is supplied.
   * @param {object} data
   * @returns {Promise<object>}
   */
  static async create(data) {
    if (!data.subject) throw new Error('subject is required for email templates');
    return super.create({ ...data, type: 'email' });
  }

  /**
   * List all active email templates (no pagination).
   * @returns {Promise<object[]>}
   */
  static async listActive() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('id, name, category, subject, variables')
      .eq('type', 'email')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Find active email templates by category.
   * @param {string} category
   * @returns {Promise<object[]>}
   */
  static async findByCategory(category) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('type', 'email')
      .eq('category', category)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
