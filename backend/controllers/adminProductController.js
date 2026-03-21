/**
 * Admin Product Controller
 * Full product management and moderation for the admin panel.
 */

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/** GET /api/admin/products — list all products with filters */
export async function listProducts(req, res, next) {
  try {
    const { page = 1, limit = 20, status, category_id, supplier_id, search, featured } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('products')
      .select('*, supplier:supplier_profiles(id, company_name), category:categories(id, name)', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category_id) query = query.eq('category_id', category_id);
    if (supplier_id) query = query.eq('supplier_id', supplier_id);
    if (featured !== undefined) query = query.eq('is_featured', featured === 'true');
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/products/pending — products awaiting moderation */
export async function listPendingProducts(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('products')
      .select('*, supplier:supplier_profiles(id, company_name)', { count: 'exact' })
      .eq('status', 'pending')
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/products/:id — get product details */
export async function getProduct(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, supplier:supplier_profiles(*), category:categories(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/:id — update product details */
export async function updateProduct(req, res, next) {
  try {
    const allowed = [
      'name', 'description', 'price', 'stock_quantity', 'category_id',
      'status', 'is_featured', 'is_trending', 'tags', 'images',
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/:id/status — change product status */
export async function changeProductStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['active', 'inactive', 'pending', 'rejected', 'deleted'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('products')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/:id/approve — approve pending product */
export async function approveProduct(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ status: 'active', approved_at: new Date().toISOString(), approved_by: req.user?.profile?.id })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/:id/reject — reject product with reason */
export async function rejectProduct(req, res, next) {
  try {
    const { reason } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/:id/feature — toggle featured flag */
export async function toggleFeatured(req, res, next) {
  try {
    const { is_featured } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({ is_featured: !!is_featured, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/products/:id — delete product */
export async function deleteProduct(req, res, next) {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
}

/** PUT /api/admin/products/bulk-update — update multiple products */
export async function bulkUpdateProducts(req, res, next) {
  try {
    const { ids, updates } = req.body;
    if (!ids?.length) return res.status(400).json({ success: false, error: 'Product IDs are required.' });

    const allowed = ['status', 'is_featured', 'is_trending', 'category_id'];
    const safeUpdates = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) safeUpdates[k] = updates[k];
    }
    safeUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(safeUpdates)
      .in('id', ids)
      .select('id, name, status');

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: `${data.length} products updated.` });
  } catch (err) { next(err); }
}

/** POST /api/admin/products/bulk-import — import products from CSV data */
export async function bulkImportProducts(req, res, next) {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ success: false, error: 'Products array is required.' });
    }

    const toInsert = products.map(p => ({
      name: p.name,
      description: p.description || '',
      price: +p.price || 0,
      stock_quantity: +p.stock_quantity || 0,
      category_id: p.category_id || null,
      supplier_id: p.supplier_id || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase.from('products').insert(toInsert).select('id, name');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data, message: `${data.length} products imported.` });
  } catch (err) { next(err); }
}

// ─── Categories ──────────────────────────────────────────────────────────────

/** GET /api/admin/categories */
export async function listCategories(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/categories */
export async function createCategory(req, res, next) {
  try {
    const { name, slug, description, image_url, parent_id, sort_order } = req.body;
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug, description, image_url, parent_id: parent_id || null, sort_order: sort_order || 0 })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/categories/:id */
export async function updateCategory(req, res, next) {
  try {
    const allowed = ['name', 'slug', 'description', 'image_url', 'parent_id', 'sort_order', 'is_active'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/categories/:id */
export async function deleteCategory(req, res, next) {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
}
