import supabase from '../config/supabase.js';
import ProductComparison from '../models/ProductComparison.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getMaxProducts() {
  try {
    const cfg = await ProductComparison.getConfig();
    return parseInt(cfg.max_products ?? '5', 10) || 5;
  } catch {
    return 5;
  }
}

async function isFeatureEnabled() {
  try {
    const cfg = await ProductComparison.getConfig();
    return cfg.comparison_enabled !== 'false';
  } catch {
    return true;
  }
}

/** Enrich product_ids in a comparison with full product rows. */
async function enrichProducts(comparison) {
  if (!comparison) return null;
  const ids = Array.isArray(comparison.products) ? comparison.products : [];
  if (!ids.length) return { ...comparison, product_details: [] };

  const { data: products } = await supabase
    .from('products')
    .select('id, title, images, price, moq, description, specifications, supplier_id, category_id')
    .in('id', ids);

  return { ...comparison, product_details: products ?? [] };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/** POST /api/v1/comparisons — Create a new comparison */
export async function createComparison(req, res, next) {
  try {
    if (!await isFeatureEnabled()) {
      return res.status(503).json({ success: false, error: 'Product comparison feature is currently disabled.' });
    }

    const cfg = await ProductComparison.getConfig();
    // Guest comparison check
    const userId = req.user?.id ?? null;
    if (!userId && cfg.guest_comparison === 'false') {
      return res.status(401).json({ success: false, error: 'Login required to create a comparison.' });
    }

    const { name, is_public, products = [] } = req.body;
    const maxProducts = parseInt(cfg.max_products ?? '5', 10) || 5;

    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, error: 'products must be an array of product IDs.' });
    }
    if (products.length > maxProducts) {
      return res.status(422).json({ success: false, error: `Maximum of ${maxProducts} products allowed per comparison.` });
    }

    const comparison = await ProductComparison.createComparison({
      user_id: userId,
      products,
      name: name ?? null,
      is_public: Boolean(is_public),
    });

    res.status(201).json({ success: true, data: comparison });
  } catch (err) { next(err); }
}

/** GET /api/v1/comparisons/:id — Get comparison with full product data */
export async function getComparison(req, res, next) {
  try {
    const comparison = await ProductComparison.getComparison(req.params.id);
    if (!comparison) return res.status(404).json({ success: false, error: 'Comparison not found.' });

    // Non-public comparisons are only accessible by their owner
    if (!comparison.is_public) {
      const userId = req.user?.id;
      if (!userId || (comparison.user_id && comparison.user_id !== userId)) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
    }

    res.json({ success: true, data: await enrichProducts(comparison) });
  } catch (err) { next(err); }
}

/** GET /api/v1/comparisons/shared/:token — Get public comparison by share token */
export async function getSharedComparison(req, res, next) {
  try {
    const cfg = await ProductComparison.getConfig();
    if (cfg.sharing_enabled === 'false') {
      return res.status(503).json({ success: false, error: 'Sharing is currently disabled.' });
    }

    const comparison = await ProductComparison.getByShareToken(req.params.token);
    if (!comparison) return res.status(404).json({ success: false, error: 'Shared comparison not found or no longer public.' });

    res.json({ success: true, data: await enrichProducts(comparison) });
  } catch (err) { next(err); }
}

/** PUT /api/v1/comparisons/:id/products — Add or remove a product */
export async function updateProducts(req, res, next) {
  try {
    const { action, product_id } = req.body;

    if (!product_id) return res.status(400).json({ success: false, error: 'product_id is required.' });
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be "add" or "remove".' });
    }

    // Ownership check
    const existing = await ProductComparison.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Comparison not found.' });

    const userId = req.user?.id;
    if (existing.user_id && existing.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    let updated;
    if (action === 'add') {
      const maxProducts = await getMaxProducts();
      updated = await ProductComparison.addProduct(req.params.id, product_id, maxProducts);
    } else {
      updated = await ProductComparison.removeProduct(req.params.id, product_id);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
}

/** GET /api/v1/comparisons/my — Get authenticated user's comparisons */
export async function getMyComparisons(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ProductComparison.getByUser(req.user.id, {
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/comparisons/:id — Delete a comparison */
export async function deleteComparison(req, res, next) {
  try {
    const comparison = await ProductComparison.findById(req.params.id);
    if (!comparison) return res.status(404).json({ success: false, error: 'Comparison not found.' });

    const userId = req.user?.id;
    if (comparison.user_id && comparison.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    await ProductComparison.delete(req.params.id);
    res.json({ success: true, message: 'Comparison deleted.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/comparisons/config — Get admin config (admin only) */
export async function getConfig(req, res, next) {
  try {
    const config = await ProductComparison.getConfig();
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
}

/** PUT /api/v1/comparisons/config — Update admin config (admin only) */
export async function updateConfig(req, res, next) {
  try {
    const allowed = ['comparison_enabled', 'max_products', 'sharing_enabled', 'guest_comparison', 'mode', 'highlight_differences'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, error: 'No valid config keys provided.' });
    }

    await ProductComparison.updateConfig(updates, req.user.id);
    const config = await ProductComparison.getConfig();
    res.json({ success: true, data: config, message: 'Configuration updated.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/comparisons/attributes/:categoryId — Get comparable attributes for a category */
export async function getAttributes(req, res, next) {
  try {
    const attrs = await ProductComparison.getComparisonAttributes(req.params.categoryId);
    res.json({ success: true, data: attrs });
  } catch (err) { next(err); }
}
