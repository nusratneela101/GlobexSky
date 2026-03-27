import BaseModel from './BaseModel.js';

/**
 * ImportExportJob model
 *
 * Table: import_export_jobs
 * Fields: id, type (import|export), entity_type, status, file_url,
 *         total_records, processed_records, failed_records, errors,
 *         created_by, started_at, completed_at, created_at, updated_at
 */
export default class ImportExportJob extends BaseModel {
  static get tableName() {
    return 'import_export_jobs';
  }

  static async findByUser(userId, page = 1, limit = 20) {
    return this.findAll({ page, limit, filters: { created_by: userId }, orderBy: 'created_at' });
  }

  static async updateStatus(id, status, extra = {}) {
    const result = await this.db
      .from(this.tableName)
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}
