/**
 * Commission Controller
 * CRUD operations for commission rules with calculation support.
 */

import Commission from '../models/Commission.js';

// ─── List commissions ─────────────────────────────────────────────────────────

/** GET /api/v1/commissions */
export async function listCommissions(req, res, next) {
  try {
    const { page = 1, limit = 20, category_id, is_active } = req.query;

    const filters = {};
    if (category_id) filters.category_id = category_id;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const result = await Commission.findAll({
      page: Number(page),
      limit: Number(limit),
      filters,
      orderBy: 'created_at',
      ascending: false,
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single commission ────────────────────────────────────────────────────

/** GET /api/v1/commissions/:id */
export async function getCommission(req, res, next) {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' });
    res.json({ success: true, data: commission });
  } catch (err) { next(err); }
}

// ─── Create commission ────────────────────────────────────────────────────────

/** POST /api/v1/commissions */
export async function createCommission(req, res, next) {
  try {
    const {
      name, type, category_id, min_order_value, max_order_value,
      rate_percent, min_cap, max_cap, is_active,
    } = req.body;

    if (!name || !type || !category_id || rate_percent === undefined) {
      return res.status(400).json({ success: false, error: 'Name, type, category_id, and rate_percent are required.' });
    }

    const commission = await Commission.create({
      name,
      type,
      category_id,
      min_order_value: min_order_value || null,
      max_order_value: max_order_value || null,
      rate_percent,
      min_cap: min_cap || null,
      max_cap: max_cap || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({ success: true, data: commission });
  } catch (err) { next(err); }
}

// ─── Update commission ────────────────────────────────────────────────────────

/** PUT /api/v1/commissions/:id */
export async function updateCommission(req, res, next) {
  try {
    const existing = await Commission.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Commission not found' });

    const allowed = [
      'name', 'type', 'category_id', 'min_order_value', 'max_order_value',
      'rate_percent', 'min_cap', 'max_cap', 'is_active',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const commission = await Commission.update(req.params.id, updates);
    res.json({ success: true, data: commission });
  } catch (err) { next(err); }
}

// ─── Delete commission ────────────────────────────────────────────────────────

/** DELETE /api/v1/commissions/:id */
export async function deleteCommission(req, res, next) {
  try {
    const existing = await Commission.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Commission not found' });

    await Commission.delete(req.params.id);
    res.json({ success: true, message: 'Commission deleted.' });
  } catch (err) { next(err); }
}

// ─── Calculate commission ─────────────────────────────────────────────────────

/** POST /api/v1/commissions/calculate */
export async function calculateCommission(req, res, next) {
  try {
    const { commission_id, category_id, order_value } = req.body;

    if (order_value === undefined) {
      return res.status(400).json({ success: false, error: 'order_value is required.' });
    }

    let result;
    if (commission_id) {
      result = await Commission.calculateCommission(commission_id, order_value);
    } else if (category_id) {
      const rule = await Commission.findActiveByCategoryAndValue(category_id, order_value);
      if (!rule) return res.status(404).json({ success: false, error: 'No active commission rule found for this category and order value.' });
      result = await Commission.calculateCommission(rule.id, order_value);
    } else {
      return res.status(400).json({ success: false, error: 'Either commission_id or category_id is required.' });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ─── Get commissions by category ──────────────────────────────────────────────

/** GET /api/v1/commissions/category/:categoryId */
export async function getCommissionsByCategory(req, res, next) {
  try {
    const data = await Commission.findByCategory(req.params.categoryId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
