/**
 * Coupon Service
 *
 * Business logic for validating coupons, calculating discounts,
 * checking user limits, expiry, and minimum order amounts.
 */

import Coupon from '../models/Coupon.js';

// ─── Discount Calculation ────────────────────────────────────────────────────

/**
 * Calculate the discount amount for a given coupon and cart total.
 * @param {object} coupon  - coupon row from DB
 * @param {number} cartTotal
 * @returns {number} discount amount (never exceeds cartTotal)
 */
export function calculateDiscount(coupon, cartTotal) {
  let discount = 0;

  switch (coupon.type) {
    case 'percentage':
      discount = (parseFloat(coupon.value) / 100) * cartTotal;
      break;
    case 'fixed':
      discount = parseFloat(coupon.value);
      break;
    case 'free_shipping':
      // Caller should zero out shipping separately; return 0 here
      discount = 0;
      break;
    default:
      discount = 0;
  }

  // Cap by max_discount_amount if set
  if (coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined) {
    discount = Math.min(discount, parseFloat(coupon.max_discount_amount));
  }

  // Discount cannot exceed cart total
  discount = Math.min(discount, cartTotal);

  return Math.max(0, parseFloat(discount.toFixed(2)));
}

// ─── Validate & Preview ──────────────────────────────────────────────────────

/**
 * Validate a coupon code for a given cart and return discount info.
 * @param {string} code
 * @param {string} userId
 * @param {number} cartTotal
 * @returns {Promise<{ coupon: object, discountAmount: number, isFreeShipping: boolean }>}
 */
export async function validateForCart(code, userId, cartTotal) {
  const coupon = await Coupon.validateCoupon(code, userId, cartTotal);
  const discountAmount = calculateDiscount(coupon, cartTotal);
  const isFreeShipping = coupon.type === 'free_shipping';
  return { coupon, discountAmount, isFreeShipping };
}

// ─── Apply to Order ──────────────────────────────────────────────────────────

/**
 * Apply a coupon to a placed order (record usage).
 * @param {string} code
 * @param {string} userId
 * @param {string} orderId
 * @param {number} cartTotal
 * @returns {Promise<{ usage: object, discountAmount: number }>}
 */
export async function applyToOrder(code, userId, orderId, cartTotal) {
  const { coupon, discountAmount } = await validateForCart(code, userId, cartTotal);
  const usage = await Coupon.applyCoupon(code, userId, orderId, discountAmount);
  return { usage, discountAmount, coupon };
}
