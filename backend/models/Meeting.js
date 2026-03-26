import BaseModel from './BaseModel.js';

/**
 * Meeting model
 *
 * Table: meetings
 * Fields: id, host_id, participant_ids, title, description, meeting_url,
 *         agora_channel, status, scheduled_at, duration_mins, created_at
 */
export default class Meeting extends BaseModel {
  static get tableName() {
    return 'meetings';
  }

  /**
   * Find all meetings hosted by a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByHost(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('host_id', userId)
      .order('scheduled_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find all meetings where a user appears in participant_ids.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByParticipant(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .contains('participant_ids', [userId])
      .order('scheduled_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find upcoming meetings (scheduled in the future) for a user,
   * either as host or participant.
   * @param {string} userId - must be a valid UUID
   * @returns {Promise<object[]>}
   */
  static async findUpcoming(userId) {
    this._assertUUID(userId);
    const now = new Date().toISOString();
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'scheduled')
      .gt('scheduled_at', now)
      .or(`host_id.eq.${userId},participant_ids.cs.["${userId}"]`)
      .order('scheduled_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Validate that a value is a UUID; throw if not.
   * @param {string} value
   */
  static _assertUUID(value) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error(`Invalid UUID: ${value}`);
    }
  }
}
