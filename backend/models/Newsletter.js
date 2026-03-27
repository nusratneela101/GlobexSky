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

  static async findByEmail(email) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    return this._handle(result);
  }

  static async subscribe(email, name = null, preferences = {}) {
    const existing = await this.findByEmail(email);
    if (existing) {
      const result = await this.db
        .from(this.tableName)
        .update({ status: 'active', unsubscribed_at: null, updated_at: new Date().toISOString() })
        .eq('email', email.toLowerCase())
        .select()
        .single();
      return this._handle(result);
    }
    return this.create({
      email: email.toLowerCase(),
      name,
      status: 'active',
      preferences,
      subscribed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  static async unsubscribe(email) {
    const result = await this.db
      .from(this.tableName)
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .select()
      .single();
    return this._handle(result);
  }

  static async getActive(page = 1, limit = 50) {
    return this.findAll({ page, limit, filters: { status: 'active' }, orderBy: 'subscribed_at' });
  }
}
