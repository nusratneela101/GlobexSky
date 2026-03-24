import BaseModel from './BaseModel.js';

/**
 * SubscriptionPlan model
 *
 * Table: subscription_plans
 * Fields: id, name, price_monthly, price_yearly, currency, features,
 *         max_products, max_orders_per_month, ai_marketing_budget,
 *         analytics_level, support_level, is_active, trial_days, created_at
 */
export default class SubscriptionPlan extends BaseModel {
  static get tableName() {
    return 'subscription_plans';
  }

  /**
   * Find a plan by its name (basic/professional/enterprise).
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  static async findByName(name) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('name', name)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Return only active subscription plans.
   * @returns {Promise<object[]>}
   */
  static async findActive() {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });
    return this._handle(result);
  }

  /**
   * Return all plans with side-by-side feature comparison.
   * @returns {Promise<object[]>}
   */
  static async comparePlans() {
    const result = await this.db
      .from(this.tableName)
      .select(
        'id, name, price_monthly, price_yearly, currency, features, max_products, max_orders_per_month, ai_marketing_budget, analytics_level, support_level, trial_days'
      )
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });
    return this._handle(result);
  }
}
