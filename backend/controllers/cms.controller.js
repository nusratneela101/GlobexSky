import supabase from '../config/supabase.js';
import { slugify } from '../utils/slugify.js';

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function listPages(req, res, next) {
  try {
    const { data, error } = await supabase.from('pages').select('id,title,slug,status,created_at').eq('status', 'published');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPage(req, res, next) {
  try {
    const { data, error } = await supabase.from('pages').select('*').eq('slug', req.params.slug).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Page not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createPage(req, res, next) {
  try {
    const { title, content, status = 'draft' } = req.body;
    const { data, error } = await supabase.from('pages').insert({ title, slug: slugify(title), content, status }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updatePage(req, res, next) {
  try {
    const { data, error } = await supabase.from('pages').update(req.body).eq('id', req.params.id).select().single();
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

// ─── Banners ─────────────────────────────────────────────────────────────────

export async function listBanners(req, res, next) {
  try {
    const { data, error } = await supabase.from('banners').select('*').eq('is_active', true).order('sort_order');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBanner(req, res, next) {
  try {
    const { data, error } = await supabase.from('banners').insert(req.body).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateBanner(req, res, next) {
  try {
    const { data, error } = await supabase.from('banners').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

export async function listBlogPosts(req, res, next) {
  try {
    const { data, error } = await supabase.from('blog_posts').select('id,title,slug,category,tags,featured_image,published_at').eq('status', 'published').order('published_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getBlogPost(req, res, next) {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Post not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createBlogPost(req, res, next) {
  try {
    const { title, content, category, tags, featured_image, status = 'draft' } = req.body;
    const { data, error } = await supabase.from('blog_posts').insert({
      title, slug: slugify(title), content, author_id: req.user.id, category, tags, featured_image, status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateBlogPost(req, res, next) {
  try {
    const { data, error } = await supabase.from('blog_posts').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

export async function listFAQs(req, res, next) {
  try {
    const { category } = req.query;
    let query = supabase.from('faqs').select('*').eq('is_active', true).order('sort_order');
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createFAQ(req, res, next) {
  try {
    const { data, error } = await supabase.from('faqs').insert(req.body).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateFAQ(req, res, next) {
  try {
    const { data, error } = await supabase.from('faqs').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
