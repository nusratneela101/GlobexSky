import BaseModel from './BaseModel.js';

/**
 * CouponUsage model
 *
 * Table: coupon_usages
 * Fields: id, coupon_id, user_id, order_id, discount_amount, used_at
 */
export default class CouponUsage extends BaseModel {
  static get tableName() {
    return 'coupon_usages';
  }
}
