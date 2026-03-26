import BaseModel from './BaseModel.js';

/**
 * Livestream model
 *
 * Table: livestreams
 * Fields: id, host_id, title, description, status, stream_url,
 *         agora_channel, viewer_count, featured_products, started_at,
 *         ended_at, created_at
 */
export default class Livestream extends BaseModel {
  static get tableName() {
    return 'livestreams';
  }

  /**
   * Find all currently live streams.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all livestreams created by a host.
   * @param {string} hostId
   * @returns {Promise<object[]>}
   */
  static async findByHost(hostId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find a livestream by its id.
   * @param {string} id
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
}
