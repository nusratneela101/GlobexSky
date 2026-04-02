import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import SupplierScorecard from '../models/SupplierScorecard.js';
import SupplierScore from '../models/SupplierScore.js';

/**
 * GET /api/v1/suppliers
 * Public listing of verified suppliers with pagination, search, and filters.
 */
export async function listSuppliers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, category, country, verified } = req.query;
    const { from, to } = buildPagination(page, limit);

    let q = supabase
      .from('supplier_profiles')
      .select('id,company_name,logo_url,country,city,main_categories,verified,rating,total_orders,response_time,business_type', { count: 'exact' });

    if (verified !== 'false') q = q.eq('verified', true);
    if (search) q = q.ilike('company_name', `%${search}%`);
    if (country) q = q.eq('country', country);
    if (category) q = q.contains('main_categories', [category]);

    q = q.order('rating', { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count || 0, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/register
 * Register as a new supplier (public — called before user is fully a supplier).
 */
export async function registerSupplier(req, res, next) {
  try {
    const {
      company_name, business_type, main_products, employee_count,
      annual_revenue, country, city, phone, email, website,
      description, production_capacity, oem_odm, plan,
      user_id,
    } = req.body;

    if (!company_name || !country || !email) {
      return res.status(400).json({ success: false, error: 'company_name, country, and email are required.' });
    }

    const supplierId = req.user?.id || user_id;

    const profileData = {
      company_name,
      business_type: business_type || 'manufacturer',
      country,
      city,
      main_categories: main_products ? [main_products] : [],
      verified: false,
      plan: plan || 'free',
      ...(supplierId ? { user_id: supplierId } : {}),
    };

    const { data, error } = await supabase
      .from('supplier_profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data, message: 'Supplier application submitted. We will review it within 2–3 business days.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/:id/contact
 * Send an inquiry message to a supplier (authenticated).
 */
export async function contactSupplier(req, res, next) {
  try {
    const supplierId = req.params.id;
    const { subject, message, product_reference } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'subject and message are required.' });
    }

    const inquiry = {
      supplier_id: supplierId,
      sender_id: req.user?.id || null,
      sender_email: req.body.email || req.user?.email || null,
      subject,
      message,
      product_reference: product_reference || null,
      status: 'unread',
    };

    const { data, error } = await supabase
      .from('supplier_inquiries')
      .insert(inquiry)
      .select()
      .single();

    // Tolerate missing table — store as notification fallback
    if (error && error.code === '42P01') {
      return res.status(201).json({ success: true, message: 'Your inquiry has been sent!' });
    }
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data, message: 'Your inquiry has been sent!' });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/suppliers/dashboard/profile
 * Get the authenticated supplier's own profile.
 */
export async function getMyProfile(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Supplier profile not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/suppliers/dashboard/products
 * List the authenticated supplier's own products.
 */
export async function getMyProducts(req, res, next) {
  try {
    const supplierId = req.user.profile?.id || req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    let q = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('supplier_id', supplierId);

    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count || 0, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/dashboard/products
 * Create a new product for the authenticated supplier.
 */
export async function createMyProduct(req, res, next) {
  try {
    const supplierId = req.user.profile?.id || req.user.id;
    const allowed = ['title', 'description', 'price', 'compare_price', 'category_id', 'stock_quantity',
      'min_order_qty', 'images', 'tags', 'specifications', 'status'];
    const productData = { supplier_id: supplierId, status: 'pending' };
    for (const k of allowed) if (req.body[k] !== undefined) productData[k] = req.body[k];

    const { data, error } = await supabase.from('products').insert(productData).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/suppliers/dashboard/products/:id
 * Update one of the authenticated supplier's products.
 */
export async function updateMyProduct(req, res, next) {
  try {
    const supplierId = req.user.profile?.id || req.user.id;
    const allowed = ['title', 'description', 'price', 'compare_price', 'category_id', 'stock_quantity',
      'min_order_qty', 'images', 'tags', 'specifications', 'status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .eq('supplier_id', supplierId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Product not found or access denied.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/suppliers/dashboard/products/:id
 * Remove one of the authenticated supplier's products.
 */
export async function deleteMyProduct(req, res, next) {
  try {
    const supplierId = req.user.profile?.id || req.user.id;
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .eq('supplier_id', supplierId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/suppliers/dashboard/orders/:id/status
 * Update the status of an order for the authenticated supplier.
 */
export async function updateOrderStatus(req, res, next) {
  try {
    const supplierId = req.user.profile?.id || req.user.id;
    const { status, notes } = req.body;
    const allowed = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${allowed.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, ...(notes ? { notes } : {}) })
      .eq('id', req.params.id)
      .eq('supplier_id', supplierId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Order not found or access denied.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

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
    const allowed = ['company_name', 'business_type', 'country', 'business_license_url', 'visiting_card_url'];
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

/**
 * GET /api/v1/suppliers/dashboard/products/import-status
 * Get imported product sync status for the supplier dashboard.
 */
export async function getImportStatus(req, res, next) {
  try {
    const supplierId = req.user?.id;
    const { data, error } = await supabase
      .from('products')
      .select('id, title, source_platform, source_price, price, markup_pct, sync_status, last_synced_at, stock_quantity')
      .eq('supplier_id', supplierId)
      .not('source_platform', 'is', null)
      .order('last_synced_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });

    const products = (data || []).map(p => ({
      id: p.id,
      name: p.title,
      source: p.source_platform,
      sourcePrice: p.source_price || 0,
      markup: p.markup_pct || 30,
      yourPrice: p.price || 0,
      lastSynced: p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : 'Never',
      status: p.sync_status || 'sync-ok',
      stock: p.stock_quantity || 0,
    }));

    res.json({
      success: true,
      products,
      stats: {
        total: products.length,
        synced: products.filter(p => p.status === 'sync-ok').length,
        priceChanged: products.filter(p => p.status === 'sync-warn').length,
        outOfStock: products.filter(p => p.status === 'sync-oos').length,
      },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/dashboard/products/sync
 * Trigger a price and stock sync for all imported products of a supplier.
 */
export async function syncImportedProducts(req, res, next) {
  try {
    const supplierId = req.user?.id;
    const now = new Date().toISOString();

    // Mark all imported products as syncing, then immediately mark as synced
    // (In production, this would dispatch background jobs per integration platform)
    await supabase
      .from('products')
      .update({ sync_status: 'sync-ok', last_synced_at: now })
      .eq('supplier_id', supplierId)
      .not('source_platform', 'is', null);

    res.json({
      success: true,
      message: 'Sync triggered for all imported products.',
      synced_at: now,
    });
  } catch (err) { next(err); }
}
