import BaseModel from './BaseModel.js';

/**
 * CustomStyle model
 *
 * Table: admin_custom_styles
 * Fields: id, name, css_content, js_content, is_active, applied_pages,
 *         created_by, created_at, updated_at
 */
export default class CustomStyle extends BaseModel {
  static get tableName() {
    return 'admin_custom_styles';
  }

  static async getActive() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  static async toggleActive(id, isActive) {
    const result = await this.db
      .from(this.tableName)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}
