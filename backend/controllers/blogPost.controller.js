/**
 * Blog Post Controller
 * CRUD operations for blog posts with slug support, publishing, and view tracking.
 */

import BlogPost from '../models/BlogPost.js';

// ─── Slug generation ──────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── List blog posts ──────────────────────────────────────────────────────────

/** GET /api/v1/blog-posts */
export async function listBlogPosts(req, res, next) {
  try {
    const { page = 1, limit = 20, status, category, tag } = req.query;

    let result;
    if (status === 'published') {
      result = await BlogPost.findPublished({ page: Number(page), limit: Number(limit) });
    } else if (category) {
      result = await BlogPost.findByCategory(category, { page: Number(page), limit: Number(limit) });
    } else if (tag) {
      result = await BlogPost.findByTag(tag, { page: Number(page), limit: Number(limit) });
    } else {
      const filters = {};
      if (status) filters.status = status;
      result = await BlogPost.findAll({
        page: Number(page),
        limit: Number(limit),
        filters,
        orderBy: 'created_at',
        ascending: false,
      });
    }

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single blog post ────────────────────────────────────────────────────

/** GET /api/v1/blog-posts/:id */
export async function getBlogPost(req, res, next) {
  try {
    const { id } = req.params;

    const post = await (id.includes('-') && !id.match(/^[0-9a-f-]{36}$/)
      ? BlogPost.findBySlug(id)
      : BlogPost.findById(id));

    if (!post) return res.status(404).json({ success: false, error: 'Blog post not found' });

    await BlogPost.incrementViews(post.id);
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
}

// ─── Create blog post ────────────────────────────────────────────────────────

/** POST /api/v1/blog-posts */
export async function createBlogPost(req, res, next) {
  try {
    const { title, content, excerpt, featured_image, category, tags, status } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required.' });
    }

    const slug = slugify(title);

    const existing = await BlogPost.findBySlug(slug);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A blog post with this slug already exists.' });
    }

    const post = await BlogPost.create({
      title,
      slug,
      content,
      excerpt: excerpt || null,
      featured_image: featured_image || null,
      category: category || null,
      tags: tags || [],
      status: status || 'draft',
      author_id: req.user.id,
    });

    res.status(201).json({ success: true, data: post });
  } catch (err) { next(err); }
}

// ─── Update blog post ────────────────────────────────────────────────────────

/** PUT /api/v1/blog-posts/:id */
export async function updateBlogPost(req, res, next) {
  try {
    const existing = await BlogPost.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Blog post not found' });

    const allowed = ['title', 'content', 'excerpt', 'featured_image', 'category', 'tags', 'status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    if (updates.title) {
      updates.slug = slugify(updates.title);
      const conflict = await BlogPost.findBySlug(updates.slug);
      if (conflict && conflict.id !== req.params.id) {
        return res.status(409).json({ success: false, error: 'A blog post with this slug already exists.' });
      }
    }

    const post = await BlogPost.update(req.params.id, updates);
    res.json({ success: true, data: post });
  } catch (err) { next(err); }
}

// ─── Delete blog post ────────────────────────────────────────────────────────

/** DELETE /api/v1/blog-posts/:id */
export async function deleteBlogPost(req, res, next) {
  try {
    const existing = await BlogPost.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Blog post not found' });

    await BlogPost.delete(req.params.id);
    res.json({ success: true, message: 'Blog post deleted.' });
  } catch (err) { next(err); }
}

// ─── Publish blog post ───────────────────────────────────────────────────────

/** PATCH /api/v1/blog-posts/:id/publish */
export async function publishBlogPost(req, res, next) {
  try {
    const existing = await BlogPost.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Blog post not found' });

    const post = await BlogPost.update(req.params.id, {
      status: 'published',
      published_at: new Date().toISOString(),
    });

    res.json({ success: true, data: post });
  } catch (err) { next(err); }
}
