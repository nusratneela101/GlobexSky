/**
 * CMS Controller
 * Admin management of pages, banners, blog posts, and media.
 */

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function listPages(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('pages')
      .select('id, slug, title, is_published, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPage(req, res, next) {
  try {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const field = UUID_REGEX.test(req.params.id) ? 'id' : 'slug';
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq(field, req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Page not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createPage(req, res, next) {
  try {
    const { slug, title, content, meta_title, meta_description, is_published = false } = req.body;
    if (!slug || !title) return res.status(400).json({ success: false, error: 'Slug and title are required.' });

    const { data, error } = await supabase
      .from('pages')
      .insert({ slug, title, content, meta_title, meta_description, is_published, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updatePage(req, res, next) {
  try {
    const allowed = ['slug', 'title', 'content', 'meta_title', 'meta_description', 'is_published'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('pages').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deletePage(req, res, next) {
  try {
    const { error } = await supabase.from('pages').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Page deleted.' });
  } catch (err) { next(err); }
}

// ─── Banners ──────────────────────────────────────────────────────────────────

export async function listBanners(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBanner(req, res, next) {
  try {
    const { title, image_url, link, position, start_date, end_date, is_active = true } = req.body;
    if (!title || !image_url) return res.status(400).json({ success: false, error: 'Title and image_url are required.' });

    const { data, error } = await supabase
      .from('banners')
      .insert({ title, image_url, link, position, start_date, end_date, is_active, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateBanner(req, res, next) {
  try {
    const allowed = ['title', 'image_url', 'link', 'position', 'start_date', 'end_date', 'is_active'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('banners').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteBanner(req, res, next) {
  try {
    const { error } = await supabase.from('banners').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Banner deleted.' });
  } catch (err) { next(err); }
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export async function listBlogPosts(req, res, next) {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, author_id, category, status, published_at, created_at', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getBlogPost(req, res, next) {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Blog post not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBlogPost(req, res, next) {
  try {
    const { title, slug, content, category, tags, featured_image, status = 'draft', published_at } = req.body;
    if (!title || !slug) return res.status(400).json({ success: false, error: 'Title and slug are required.' });

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title, slug, content, author_id: req.user?.profile?.id,
        category, tags, featured_image, status,
        published_at: status === 'published' ? (published_at || new Date().toISOString()) : published_at,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateBlogPost(req, res, next) {
  try {
    const allowed = ['title', 'slug', 'content', 'category', 'tags', 'featured_image', 'status', 'published_at'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (updates.status === 'published' && !updates.published_at) {
      updates.published_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteBlogPost(req, res, next) {
  try {
    const { error } = await supabase.from('blog_posts').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Blog post deleted.' });
  } catch (err) { next(err); }
}

// ─── Media Upload ─────────────────────────────────────────────────────────────

export async function uploadMedia(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    // Cloudinary URL is set by the upload middleware
    const url = req.file.path || req.file.secure_url || req.file.url;
    res.json({ success: true, data: { url, filename: req.file.originalname, size: req.file.size } });
  } catch (err) { next(err); }
}
