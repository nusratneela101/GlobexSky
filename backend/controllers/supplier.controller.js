import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import SupplierScorecard from '../models/SupplierScorecard.js';
import SupplierScore from '../models/SupplierScore.js';

export async function getSupplierProfile(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_profiles').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Supplier not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierProducts(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase
      .from('products').select('*', { count: 'exact' }).eq('supplier_id', req.params.id).eq('status', 'active').range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getDashboardStats(req, res, next) {
  try {
    const supplierId = req.user.profile?.id;
    const [orders, products, earnings] = await Promise.all([
      supabase.from('orders').select('id,status,total', { count: 'exact' }).eq('supplier_id', supplierId),
      supabase.from('products').select('id,status', { count: 'exact' }).eq('supplier_id', supplierId),
      supabase.from('supplier_payouts').select('amount').eq('supplier_id', supplierId).eq('status', 'paid'),
    ]);
    res.json({
      success: true, data: {
        total_orders: orders.count || 0,
        total_products: products.count || 0,
        total_earned: (earnings.data || []).reduce((s, r) => s + (+r.amount), 0),
      },
    });
  } catch (err) { next(err); }
}

export async function updateSupplierProfile(req, res, next) {
  try {
    const allowed = ['company_name', 'business_type', 'country'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabase.from('supplier_profiles').update(updates).eq('user_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierOrders(req, res, next) {
  try {
    const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('supplier_id', req.user.profile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSupplierAnalytics(req, res, next) {
  try {
    const { data, error } = await supabase.from('orders').select('total,status,created_at').eq('supplier_id', req.user.profile?.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    const revenue = (data || []).filter((o) => o.status === 'delivered').reduce((s, o) => s + (+o.total), 0);
    res.json({ success: true, data: { orders: data, total_revenue: revenue } });
  } catch (err) { next(err); }
}

export async function getSupplierEarnings(req, res, next) {
  try {
    const { data, error } = await supabase.from('supplier_payouts').select('*').eq('supplier_id', req.user.profile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/suppliers/:id/scorecard
 * Get supplier scorecard (public).
 */
export async function getScorecard(req, res, next) {
  try {
    const scorecard = await SupplierScorecard.findBySupplierId(req.params.id);
    if (!scorecard) return res.status(404).json({ success: false, error: 'Scorecard not found for this supplier.' });
    res.json({ success: true, data: scorecard });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/suppliers/:id/scorecard
 * Update supplier scorecard (admin only).
 */
export async function updateScorecard(req, res, next) {
  try {
    const { overall_score, quality_score, delivery_score, communication_score, pricing_score, review_count } = req.body;
    const scores = { overall_score, quality_score, delivery_score, communication_score, pricing_score };
    const badges = SupplierScorecard.calculateBadges(scores);
    const data = await SupplierScorecard.upsert({
      supplier_id: req.params.id,
      ...scores,
      badges,
      ...(review_count !== undefined && { review_count }),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/:id/evaluate
 * Submit a supplier evaluation (authenticated buyers).
 */
export async function evaluateSupplier(req, res, next) {
  try {
    const supplierId = req.params.id;
    const { quality_score, delivery_score, communication_score, pricing_score, review_text, order_id } = req.body;
    const overall_score = (quality_score + delivery_score + communication_score + pricing_score) / 4;

    // Persist the individual review score
    const score = await SupplierScore.create({
      supplier_id: supplierId,
      reviewer_id: req.user.id,
      quality_score,
      delivery_score,
      communication_score,
      price_score: pricing_score,
      overall_score,
      review_text,
      order_id,
    });

    // Recalculate aggregate scorecard
    const aggregate = await SupplierScore.getAggregateScore(supplierId);
    if (aggregate) {
      const scores = {
        overall_score: Math.round(aggregate.overall * 20), // convert 0-5 to 0-100
        quality_score: Math.round(aggregate.quality * 20),
        delivery_score: Math.round(aggregate.delivery * 20),
        communication_score: Math.round(aggregate.communication * 20),
        pricing_score: Math.round(aggregate.price * 20),
      };
      const badges = SupplierScorecard.calculateBadges(scores);
      await SupplierScorecard.upsert({
        supplier_id: supplierId,
        ...scores,
        badges,
        review_count: aggregate.count,
      });
    }

    res.status(201).json({ success: true, data: score });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/suppliers/top-rated
 * Get top-rated suppliers.
 */
export async function getTopRated(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const suppliers = await SupplierScorecard.getTopRated(limit);
    res.json({ success: true, data: suppliers });
  } catch (err) { next(err); }
}
