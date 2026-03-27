/**
 * Category Controller
 * CRUD operations for product categories with nested category support.
 */

import Category from '../models/Category.js';
import supabase from '../config/supabase.js';

// ─── Slug generation ──────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── List categories ──────────────────────────────────────────────────────────

/** GET /api/v1/categories */
export async function listCategories(req, res, next) {
  try {
    const { parent_id, is_active, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    let data;
    if (parent_id === 'null' || parent_id === '') {
      data = await Category.findByParent(null);
    } else if (parent_id) {
      data = await Category.findChildren(parent_id);
    } else {
      const result = await Category.findAll({
        page: Number(page),
        limit: Number(limit),
        filters,
        orderBy: 'sort_order',
        ascending: true,
      });
      return res.json({ success: true, ...result });
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/categories/tree — Return full category tree */
export async function getCategoryTree(req, res, next) {
  try {
    const { data: allCategories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Build tree structure
    const map = {};
    const roots = [];

    (allCategories || []).forEach((cat) => {
      map[cat.id] = { ...cat, children: [] };
    });

    (allCategories || []).forEach((cat) => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    });

    res.json({ success: true, data: roots });
  } catch (err) { next(err); }
}

// ─── Get single category ──────────────────────────────────────────────────────

/** GET /api/v1/categories/:id */
export async function getCategory(req, res, next) {
  try {
    const { id } = req.params;
    const category = await (id.includes('-') && !id.match(/^[0-9a-f-]{36}$/)
      ? Category.findBySlug(id)
      : Category.findById(id));

    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
}

/** GET /api/v1/categories/slug/:slug */
export async function getCategoryBySlug(req, res, next) {
  try {
    const category = await Category.findBySlug(req.params.slug);
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
}

// ─── Create category ──────────────────────────────────────────────────────────

/** POST /api/v1/categories */
export async function createCategory(req, res, next) {
  try {
    const { name, parent_id, description, image_url, icon, commission_rate, sort_order } = req.body;
    const slug = req.body.slug || slugify(name);

    // Check for slug uniqueness
    const existing = await Category.findBySlug(slug);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A category with this slug already exists.' });
    }

    const category = await Category.create({
      name,
      slug,
      parent_id: parent_id || null,
      description: description || null,
      image_url: image_url || null,
      icon: icon || null,
      commission_rate: commission_rate || 0,
      sort_order: sort_order || 0,
      is_active: true,
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) { next(err); }
}

// ─── Update category ──────────────────────────────────────────────────────────

/** PUT /api/v1/categories/:id */
export async function updateCategory(req, res, next) {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    const { name, slug, parent_id, description, image_url, icon, commission_rate, is_active, sort_order } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    else if (name) updates.slug = slugify(name);
    if (parent_id !== undefined) updates.parent_id = parent_id || null;
    if (description !== undefined) updates.description = description;
    if (image_url !== undefined) updates.image_url = image_url;
    if (icon !== undefined) updates.icon = icon;
    if (commission_rate !== undefined) updates.commission_rate = commission_rate;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const category = await Category.update(req.params.id, updates);
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
}

// ─── Delete category ──────────────────────────────────────────────────────────

/** DELETE /api/v1/categories/:id */
export async function deleteCategory(req, res, next) {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    // Check for children
    const children = await Category.findChildren(req.params.id);
    if (children.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with sub-categories. Remove or re-parent children first.',
      });
    }

    await Category.delete(req.params.id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/categories/:id/toggle — Toggle active state */
export async function toggleCategory(req, res, next) {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });
    const category = await Category.update(req.params.id, { is_active: !existing.is_active });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
}
