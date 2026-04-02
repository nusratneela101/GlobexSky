import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';

/** GET /api/v1/products */
export async function listProducts(req, res, next) {
  try {
    const { page = 1, limit = 20, category, status = 'active', sort = 'created_at', order = 'desc' } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase.from('products').select('*, supplier:supplier_profiles(company_name)', { count: 'exact' })
      .eq('status', status)
      .order(sort, { ascending: order === 'asc' })
      .range(from, to);

    if (category) query = query.eq('category_id', category);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/products/search */
export async function searchProducts(req, res, next) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .textSearch('title', q, { type: 'websearch' })
      .eq('status', 'active')
      .range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/products/categories */
export async function listCategories(req, res, next) {
  try {
    const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/products/featured */
export async function getFeaturedProducts(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('featured', true).eq('status', 'active').limit(20);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/products/trending */
export async function getTrendingProducts(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('trending', true).eq('status', 'active').limit(20);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/products/:id */
export async function getProduct(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, supplier:supplier_profiles(*), variants:product_variants(*), reviews(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/products */
export async function createProduct(req, res, next) {
  try {
    const userId = req.user.id;

    // Check KYC verification status — block unverified suppliers
    const { data: kycRecords } = await supabase
      .from('kyc_verifications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const kycStatus = (kycRecords && kycRecords.length > 0) ? kycRecords[0].status : 'unverified';
    if (kycStatus !== 'verified' && kycStatus !== 'pending_review') {
      return res.status(403).json({
        success: false,
        error: 'Identity verification required. Complete Real Name Authentication (NID/Passport) before uploading products.',
      });
    }

    const { title, description, price, moq, stock, category_id, specifications } = req.body;
    const images = (req.files || []).map((f) => f.path);
    const supplierId = req.user.profile?.id;

    const { data, error } = await supabase
      .from('products')
      .insert({
        supplier_id: supplierId,
        title,
        slug: slugify(title),
        description,
        price,
        moq,
        stock,
        category_id,
        specifications,
        images,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/products/:id */
export async function updateProduct(req, res, next) {
  try {
    const allowed = ['title', 'description', 'price', 'moq', 'stock', 'specifications', 'status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (updates.title) updates.slug = slugify(updates.title);

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

/** DELETE /api/v1/products/:id */
export async function deleteProduct(req, res, next) {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/products/:id/wishlist */
export async function toggleWishlist(req, res, next) {
  try {
    const userId = req.user.id;
    const productId = req.params.id;
    const { data: existing } = await supabase.from('wishlists').select('id').eq('user_id', userId).eq('product_id', productId).single();

    if (existing) {
      await supabase.from('wishlists').delete().eq('id', existing.id);
      return res.json({ success: true, message: 'Removed from wishlist.', wishlisted: false });
    }

    await supabase.from('wishlists').insert({ user_id: userId, product_id: productId });
    res.json({ success: true, message: 'Added to wishlist.', wishlisted: true });
  } catch (err) { next(err); }
}
