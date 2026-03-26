import BaseModel from './BaseModel.js';

/**
 * Template model
 *
 * Table: templates
 * Fields: id, name, type (email|sms), category, subject, body, variables,
 *         is_active, created_by, created_at, updated_at
 *
 * Table: template_versions
 * Fields: id, template_id, version_number, subject, body, variables,
 *         changed_by, change_note, created_at
 */
export default class Template extends BaseModel {
  static get tableName() {
    return 'templates';
  }

  /**
   * List templates with optional search and filters.
   * @param {object} [options]
   * @param {string} [options.search]
   * @param {string} [options.type] - 'email' | 'sms'
   * @param {string} [options.category]
   * @param {boolean} [options.isActive]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
   */
  static async search({ search, type, category, isActive, page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
    }
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (isActive !== undefined) query = query.eq('is_active', isActive);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  /**
   * Clone a template, creating a new record with a modified name.
   * @param {string} id - source template id
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async clone(id, actorId) {
    const source = await this.findById(id);
    if (!source) throw new Error(`Template ${id} not found`);

    const { id: _id, created_at, updated_at, ...rest } = source;
    const cloned = await this.create({
      ...rest,
      name: `${source.name} (Copy)`,
      is_active: false,
      created_by: actorId,
    });
    return cloned;
  }

  // ─── Versions ──────────────────────────────────────────────────────────────

  /**
   * Get the version history for a template.
   * @param {string} templateId
   * @returns {Promise<object[]>}
   */
  static async getVersions(templateId) {
    const { data, error } = await this.db
      .from('template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Save a version snapshot of a template.
   * @param {object} template - current template record
   * @param {string} changedBy - user id
   * @param {string} [changeNote]
   * @returns {Promise<object>}
   */
  static async saveVersion(template, changedBy, changeNote = '') {
    // Find the next version number
    const { data: latest, error: vErr } = await this.db
      .from('template_versions')
      .select('version_number')
      .eq('template_id', template.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr) throw vErr;

    const versionNumber = (latest?.version_number ?? 0) + 1;

    const { data, error } = await this.db
      .from('template_versions')
      .insert({
        template_id: template.id,
        version_number: versionNumber,
        subject: template.subject ?? null,
        body: template.body,
        variables: template.variables ?? [],
        changed_by: changedBy,
        change_note: changeNote,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Restore a template to a specific version.
   * @param {string} templateId
   * @param {number} versionNumber
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async restoreVersion(templateId, versionNumber, actorId) {
    const { data: version, error: vErr } = await this.db
      .from('template_versions')
      .select('*')
      .eq('template_id', templateId)
      .eq('version_number', versionNumber)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!version) throw new Error(`Version ${versionNumber} not found for template ${templateId}`);

    // Snapshot current state before overwriting
    const current = await this.findById(templateId);
    if (current) {
      await this.saveVersion(current, actorId, `Auto-saved before restoring v${versionNumber}`);
    }

    return this.update(templateId, {
      subject: version.subject,
      body: version.body,
      variables: version.variables,
    });
  }
}
