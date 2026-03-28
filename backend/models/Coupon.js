import BaseModel from './BaseModel.js';
import supabase from '../config/supabase.js';

/**
 * Coupon model
 *
 * Table: coupons
 * Fields: id, code, type, value, min_order_amount, max_discount_amount,
 *         currency, usage_limit, used_count, per_user_limit, valid_from,
 *         valid_until, is_active, applies_to, target_ids, created_by,
 *         created_at, updated_at
 */
export default class Coupon extends BaseModel {
  static get tableName() {
    return 'coupons';
  }

  /**
   * Find a coupon by its code (case-insensitive).
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  static async findByCode(code) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .ilike('code', code.trim())
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Validate a coupon against a cart total and user context.
   * Returns the coupon row if valid, throws with a descriptive message if not.
   *
   * @param {string} code
   * @param {string} userId
   * @param {number} cartTotal
   * @returns {Promise<object>} valid coupon row
   */
  static async validateCoupon(code, userId, cartTotal) {
    const coupon = await this.findByCode(code);
    if (!coupon) throw new Error('Coupon not found.');
    if (!coupon.is_active) throw new Error('This coupon is no longer active.');

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      throw new Error('This coupon is not yet valid.');
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      throw new Error('This coupon has expired.');
    }
    if (coupon.min_order_amount && cartTotal < parseFloat(coupon.min_order_amount)) {
      throw new Error(`Minimum order amount of ${coupon.min_order_amount} ${coupon.currency} required.`);
    }
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      throw new Error('This coupon has reached its usage limit.');
    }

    // Check per-user limit
    if (userId && coupon.per_user_limit > 0) {
      const { count, error: cntErr } = await supabase
        .from('coupon_usages')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', userId);
      if (cntErr) throw cntErr;
      if (count >= coupon.per_user_limit) {
        throw new Error('You have already used this coupon the maximum number of times.');
      }
    }

    return coupon;
  }

  /**
   * Record coupon usage after an order is placed.
   * @param {string} code
   * @param {string} userId
   * @param {string} orderId
   * @param {number} discountAmount
   * @returns {Promise<object>} usage row
   */
  static async applyCoupon(code, userId, orderId, discountAmount) {
    const coupon = await this.findByCode(code);
    if (!coupon) throw new Error('Coupon not found.');

    const { data, error } = await supabase
      .from('coupon_usages')
      .insert({
        coupon_id:       coupon.id,
        user_id:         userId,
        order_id:        orderId || null,
        discount_amount: discountAmount,
      })
      .select()
      .single();
    if (error) throw error;

    await this.incrementUsage(coupon.id);
    return data;
  }

  /**
   * Increment the used_count for a coupon.
   * @param {string} id coupon UUID
   * @returns {Promise<object>}
   */
  static async incrementUsage(id) {
    const { data, error } = await supabase.rpc('increment_coupon_usage', { coupon_id: id });
    if (error) {
      // Fallback: manual increment if RPC not defined
      const existing = await this.findById(id);
      if (!existing) throw new Error('Coupon not found.');
      return this.update(id, { used_count: (existing.used_count ?? 0) + 1 });
    }
    return data;
  }

  /**
   * List currently available (active + not expired + not exhausted) coupons.
   * @param {object} [options]
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async listAvailable(options = {}) {
    const page  = parseInt(options.page  ?? 1, 10);
    const limit = parseInt(options.limit ?? 20, 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;
    const now   = new Date().toISOString();

    const { data, error, count } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    // Filter out exhausted coupons client-side (usage_limit null means unlimited)
    const available = (data ?? []).filter(
      (c) => c.usage_limit === null || c.used_count < c.usage_limit
    );

    return { data: available, total: count ?? 0, page, limit };
  }
}
