import Template from './Template.js';

/**
 * SmsTemplate model
 *
 * Convenience subclass of Template scoped to type = 'sms'.
 * All read/write helpers automatically filter to / enforce sms type.
 * Also provides SMS-specific utilities (segment counting).
 */
export default class SmsTemplate extends Template {
  /** Always scope searches to SMS templates. */
  static async search(options = {}) {
    return super.search({ ...options, type: 'sms' });
  }

  /**
   * Create a new SMS template.
   * Forces type = 'sms'.
   * @param {object} data
   * @returns {Promise<object>}
   */
  static async create(data) {
    return super.create({ ...data, type: 'sms' });
  }

  /**
   * List all active SMS templates (no pagination).
   * @returns {Promise<object[]>}
   */
  static async listActive() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('id, name, category, body, variables')
      .eq('type', 'sms')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Find active SMS templates by category.
   * @param {string} category
   * @returns {Promise<object[]>}
   */
  static async findByCategory(category) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('type', 'sms')
      .eq('category', category)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Calculate SMS segment count for a given message body.
   * GSM-7 encoding: single message = 160 chars; multipart = 153 chars/segment.
   * @param {string} text
   * @returns {{ charCount: number, segmentCount: number, charsPerSegment: number }}
   */
  static calculateSegments(text = '') {
    const charCount = text.length;
    if (charCount === 0) return { charCount: 0, segmentCount: 1, charsPerSegment: 160 };
    const charsPerSegment = charCount <= 160 ? 160 : 153;
    const segmentCount = Math.ceil(charCount / charsPerSegment);
    return { charCount, segmentCount, charsPerSegment };
  }
}
