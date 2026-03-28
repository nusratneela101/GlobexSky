/**
 * Coupon Controller
 *
 * Admin: CRUD for coupons.
 * Buyer: validate/apply coupon, list available coupons.
 */

import Coupon from '../models/Coupon.js';
import CouponUsage from '../models/CouponUsage.js';
import * as svc from '../services/coupon.service.js';
import supabase from '../config/supabase.js';

// Validation error message prefixes that should result in 422 (not 500)
const VALIDATION_MESSAGES = [
  'Coupon not found.', 'This coupon is no longer active.',
  'This coupon is not yet valid.', 'This coupon has expired.',
  'Minimum order amount', 'This coupon has reached its usage limit.',
  'You have already used this coupon',
];


// ─── Admin: Create ───────────────────────────────────────────────────────────

/** POST /api/v1/coupons */
export async function createCoupon(req, res, next) {
  try {
    const payload = {
      ...req.body,
      created_by: req.user?.id ?? null,
    };
    const coupon = await Coupon.create(payload);
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Coupon code already exists.' });
    }
    next(err);
  }
}

// ─── Admin: List All ────────────────────────────────────────────────────────

/** GET /api/v1/coupons */
export async function listCoupons(req, res, next) {
  try {
    const { page = 1, limit = 20, is_active, type } = req.query;
    const filters = {};
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (type) filters.type = type;

    const result = await Coupon.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filters,
      orderBy: 'created_at',
      ascending: false,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Admin / Buyer: Get Single ───────────────────────────────────────────────

/** GET /api/v1/coupons/:id */
export async function getCoupon(req, res, next) {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, error: 'Coupon not found.' });
    res.json({ success: true, data: coupon });
  } catch (err) { next(err); }
}

// ─── Admin: Update ──────────────────────────────────────────────────────────

/** PUT /api/v1/coupons/:id */
export async function updateCoupon(req, res, next) {
  try {
    const coupon = await Coupon.update(req.params.id, req.body);
    if (!coupon) return res.status(404).json({ success: false, error: 'Coupon not found.' });
    res.json({ success: true, data: coupon });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Coupon code already exists.' });
    }
    next(err);
  }
}

// ─── Admin: Deactivate ──────────────────────────────────────────────────────

/** DELETE /api/v1/coupons/:id */
export async function deactivateCoupon(req, res, next) {
  try {
    const coupon = await Coupon.update(req.params.id, { is_active: false });
    if (!coupon) return res.status(404).json({ success: false, error: 'Coupon not found.' });
    res.json({ success: true, data: coupon, message: 'Coupon deactivated.' });
  } catch (err) { next(err); }
}

// ─── Buyer: Validate Coupon ──────────────────────────────────────────────────

/** POST /api/v1/coupons/validate */
export async function validateCoupon(req, res, next) {
  try {
    const { code, cart_total } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Coupon code is required.' });
    if (!cart_total || isNaN(parseFloat(cart_total))) {
      return res.status(400).json({ success: false, error: 'cart_total must be a valid number.' });
    }

    const userId = req.user?.id ?? null;
    const { coupon, discountAmount, isFreeShipping } = await svc.validateForCart(
      code, userId, parseFloat(cart_total)
    );

    res.json({
      success: true,
      data: {
        coupon_id:       coupon.id,
        code:            coupon.code,
        type:            coupon.type,
        value:           coupon.value,
        discount_amount: discountAmount,
        is_free_shipping: isFreeShipping,
        currency:        coupon.currency,
      },
    });
  } catch (err) {
    // Validation errors should be 400, not 500
    if (VALIDATION_MESSAGES.some((m) => err.message?.startsWith(m))) {
      return res.status(422).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// ─── Buyer: Apply Coupon to Order ────────────────────────────────────────────

/** POST /api/v1/coupons/apply */
export async function applyCoupon(req, res, next) {
  try {
    const { code, order_id, cart_total } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Coupon code is required.' });
    if (!cart_total || isNaN(parseFloat(cart_total))) {
      return res.status(400).json({ success: false, error: 'cart_total must be a valid number.' });
    }

    const userId = req.user?.id;
    const { usage, discountAmount, coupon } = await svc.applyToOrder(
      code, userId, order_id ?? null, parseFloat(cart_total)
    );

    res.status(201).json({
      success: true,
      data: {
        usage_id:        usage.id,
        coupon_id:       coupon.id,
        code:            coupon.code,
        discount_amount: discountAmount,
        currency:        coupon.currency,
      },
    });
  } catch (err) {
    if (VALIDATION_MESSAGES.some((m) => err.message?.startsWith(m))) {
      return res.status(422).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// ─── Buyer: List Available Coupons ──────────────────────────────────────────

/** GET /api/v1/coupons/available */
export async function listAvailableCoupons(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await Coupon.listAvailable({ page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Buyer: My Used Coupons ──────────────────────────────────────────────────

/** GET /api/v1/coupons/my-usage */
export async function myUsage(req, res, next) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const from = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const to   = from + parseInt(limit, 10) - 1;

    const { data, error, count } = await supabase
      .from('coupon_usages')
      .select('*, coupon:coupons(id,code,type,value,currency)', { count: 'exact' })
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    res.json({ success: true, data: data ?? [], total: count ?? 0, page: +page, limit: +limit });
  } catch (err) { next(err); }
}
