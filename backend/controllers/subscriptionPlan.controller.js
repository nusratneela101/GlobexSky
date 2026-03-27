/**
 * Subscription Plan Controller
 * CRUD operations for subscription plans with comparison support.
 */

import SubscriptionPlan from '../models/SubscriptionPlan.js';

// ─── List plans ───────────────────────────────────────────────────────────────

/** GET /api/v1/subscription-plans */
export async function listPlans(req, res, next) {
  try {
    const { is_active, page = 1, limit = 50 } = req.query;

    if (is_active === 'true') {
      const data = await SubscriptionPlan.findActive();
      return res.json({ success: true, data });
    }

    const result = await SubscriptionPlan.findAll({
      page: Number(page),
      limit: Number(limit),
      orderBy: 'price_monthly',
      ascending: true,
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single plan ──────────────────────────────────────────────────────────

/** GET /api/v1/subscription-plans/:id */
export async function getPlan(req, res, next) {
  try {
    const { name } = req.query;

    let plan;
    if (name) {
      plan = await SubscriptionPlan.findByName(name);
    } else {
      plan = await SubscriptionPlan.findById(req.params.id);
    }

    if (!plan) return res.status(404).json({ success: false, error: 'Subscription plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
}

// ─── Create plan ──────────────────────────────────────────────────────────────

/** POST /api/v1/subscription-plans */
export async function createPlan(req, res, next) {
  try {
    const {
      name, price_monthly, price_yearly, currency, features, max_products,
      max_orders_per_month, ai_marketing_budget, analytics_level,
      support_level, is_active, trial_days,
    } = req.body;

    if (!name || price_monthly === undefined) {
      return res.status(400).json({ success: false, error: 'Name and price_monthly are required.' });
    }

    const existing = await SubscriptionPlan.findByName(name);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A plan with this name already exists.' });
    }

    const plan = await SubscriptionPlan.create({
      name,
      price_monthly,
      price_yearly: price_yearly || null,
      currency: currency || 'USD',
      features: features || {},
      max_products: max_products || null,
      max_orders_per_month: max_orders_per_month || null,
      ai_marketing_budget: ai_marketing_budget || null,
      analytics_level: analytics_level || null,
      support_level: support_level || null,
      is_active: is_active !== undefined ? is_active : true,
      trial_days: trial_days || 0,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
}

// ─── Update plan ──────────────────────────────────────────────────────────────

/** PUT /api/v1/subscription-plans/:id */
export async function updatePlan(req, res, next) {
  try {
    const existing = await SubscriptionPlan.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Subscription plan not found' });

    const allowed = [
      'name', 'price_monthly', 'price_yearly', 'currency', 'features',
      'max_products', 'max_orders_per_month', 'ai_marketing_budget',
      'analytics_level', 'support_level', 'is_active', 'trial_days',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const plan = await SubscriptionPlan.update(req.params.id, updates);
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
}

// ─── Delete plan ──────────────────────────────────────────────────────────────

/** DELETE /api/v1/subscription-plans/:id */
export async function deletePlan(req, res, next) {
  try {
    const existing = await SubscriptionPlan.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Subscription plan not found' });

    await SubscriptionPlan.delete(req.params.id);
    res.json({ success: true, message: 'Subscription plan deleted.' });
  } catch (err) { next(err); }
}

// ─── Compare plans ────────────────────────────────────────────────────────────

/** GET /api/v1/subscription-plans/compare */
export async function comparePlans(req, res, next) {
  try {
    const data = await SubscriptionPlan.comparePlans();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
