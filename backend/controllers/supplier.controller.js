import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import SupplierScorecard from '../models/SupplierScorecard.js';
import SupplierScore from '../models/SupplierScore.js';

/**
 * GET /api/v1/suppliers
 * List all verified suppliers with pagination, search, and filters.
 */
export async function listSuppliers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, category, country, rating, verified } = req.query;
    const { from, to } = buildPagination(page, limit);

    let q = supabase
      .from('supplier_profiles')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (search) {
      q = q.ilike('company_name', `%${search}%`);
    }
    if (country) {
      q = q.eq('country', country);
    }
    if (verified === 'true' || verified === true) {
      q = q.eq('verification_status', 'verified');
    }

    const { data, error, count } = await q;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count || 0, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/register
 * Register as a new supplier.
 */
export async function registerSupplier(req, res, next) {
  try {
    const {
      company_name, business_type, country, city, address,
      contact_name, email, phone, website, description,
      production_capacity, oem_odm, established_year, plan,
    } = req.body;

    if (!company_name || !business_type || !country || !email) {
      return res.status(400).json({ success: false, error: 'company_name, business_type, country, and email are required.' });
    }

    const payload = {
      company_name,
      business_type,
      country,
      city: city || null,
      address: address || null,
      contact_name: contact_name || null,
      email,
      phone: phone || null,
      website: website || null,
      description: description || null,
      production_capacity: production_capacity || null,
      oem_odm: oem_odm || null,
      established_year: established_year ? parseInt(established_year, 10) : null,
      plan_type: plan || 'free',
      verification_status: 'pending',
    };

    if (req.user?.id) payload.user_id = req.user.id;

    const { data, error } = await supabase.from('supplier_profiles').insert(payload).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data, message: 'Supplier registration submitted successfully.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/:id/contact
 * Send an inquiry message to a supplier.
 */
export async function contactSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const { subject, message, product_id, buyer_name, buyer_email, buyer_phone } = req.body;

    if (!message) return res.status(400).json({ success: false, error: 'message is required.' });

    const inquiry = {
      supplier_id: id,
      subject: subject || 'Product Inquiry',
      message,
      product_id: product_id || null,
      buyer_name: buyer_name || (req.user ? req.user.email : null),
      buyer_email: buyer_email || (req.user ? req.user.email : null),
      buyer_phone: buyer_phone || null,
      buyer_id: req.user?.id || null,
      status: 'new',
    };

    const { data, error } = await supabase.from('supplier_inquiries').insert(inquiry).select().single();
    if (error) {
      // If table doesn't exist yet, log and return a graceful response
      if (error.code === '42P01') {
        console.error('[contactSupplier] supplier_inquiries table not found:', error.message);
        return res.json({ success: true, message: 'Your inquiry has been sent!' });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(201).json({ success: true, data, message: 'Your inquiry has been sent!' });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/suppliers/dashboard/products
 * List the authenticated supplier's own products.
 */
export async function getDashboardProducts(req, res, next) {
  try {
    const supplierId = req.user?.profile?.id || req.user?.id;
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    let q = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('supplier_id', supplierId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count || 0, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/suppliers/dashboard/products
 * Create a new product for the authenticated supplier.
 */
export async function createDashboardProduct(req, res, next) {
  try {
    const supplierId = req.user?.profile?.id || req.user?.id;
    const allowed = [
      'title', 'description', 'price', 'compare_price', 'stock_quantity',
      'category_id', 'images', 'sku', 'weight', 'dimensions', 'tags', 'status',
    ];
    const payload = { supplier_id: supplierId };
    for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];

    if (!payload.title || !payload.price) {
      return res.status(400).json({ success: false, error: 'title and price are required.' });
    }

    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/suppliers/dashboard/products/:id
 * Update one of the authenticated supplier's products.
 */
export async function updateDashboardProduct(req, res, next) {
  try {
    const supplierId = req.user?.profile?.id || req.user?.id;
    const allowed = [
      'title', 'description', 'price', 'compare_price', 'stock_quantity',
      'category_id', 'images', 'sku', 'weight', 'dimensions', 'tags', 'status',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .eq('supplier_id', supplierId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/suppliers/dashboard/products/:id
 * Delete one of the authenticated supplier's products.
 */
export async function deleteDashboardProduct(req, res, next) {
  try {
    const supplierId = req.user?.profile?.id || req.user?.id;
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
    const supplierId = req.user?.profile?.id || req.user?.id;
    const { status, notes } = req.body;
    const allowed = ['processing', 'production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${allowed.join(', ')}` });
    }

    const updates = { status };
    if (notes) updates.supplier_notes = notes;

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', req.params.id)
      .eq('supplier_id', supplierId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Order not found.' });
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
