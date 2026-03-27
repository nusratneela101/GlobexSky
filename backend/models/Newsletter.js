import BaseModel from './BaseModel.js';

/**
 * Newsletter model
 *
 * Table: newsletter_subscribers
 * Fields: id, email, name, status, subscribed_at, unsubscribed_at,
 *         preferences, created_at, updated_at
 */
export default class Newsletter extends BaseModel {
  static get tableName() {
    return 'newsletter_subscribers';
  }

  static normalizeEmail(email) {
    return email.toLowerCase();
  }

  static async findByEmail(email) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('email', this.normalizeEmail(email))
      .maybeSingle();
    return this._handle(result);
  }

  static async subscribe(email, name = null, preferences = {}) {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      const result = await this.db
        .from(this.tableName)
        .update({ status: 'active', unsubscribed_at: null, updated_at: new Date().toISOString() })
        .eq('email', normalizedEmail)
        .select()
        .single();
      return this._handle(result);
    }
    return this.create({
      email: normalizedEmail,
      name,
      status: 'active',
      preferences,
      subscribed_at: new Date().toISOString(),
    });
  }

  static async unsubscribe(email) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('email', this.normalizeEmail(email))
      .select()
      .single();
    return this._handle(result);
  }

  static async getActive(page = 1, limit = 50) {
    return this.findAll({ page, limit, filters: { status: 'active' }, orderBy: 'subscribed_at' });
  }
}
