-- CMS Migration
-- Creates tables for static pages, banners, and blog posts.

-- ─── Pages ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  content          TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pages_slug_idx        ON pages (slug);
CREATE INDEX IF NOT EXISTS pages_published_idx   ON pages (is_published);

-- Seed default static pages
INSERT INTO pages (slug, title, content, is_published) VALUES
  ('home',          'Homepage',        '',   true),
  ('about',         'About Us',        '',   true),
  ('contact',       'Contact Us',      '',   true),
  ('privacy',       'Privacy Policy',  '',   true),
  ('terms',         'Terms of Service','',   true),
  ('faq',           'FAQ',             '',   true)
ON CONFLICT (slug) DO NOTHING;

-- ─── Banners ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link       TEXT,
  position   TEXT DEFAULT 'hero',   -- hero | sidebar | footer | popup
  start_date DATE,
  end_date   DATE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS banners_position_idx  ON banners (position);
CREATE INDEX IF NOT EXISTS banners_active_idx    ON banners (is_active);

-- ─── Blog Posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content        TEXT,
  author_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category       TEXT,
  tags           TEXT[],
  featured_image TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',   -- draft | published | scheduled | archived
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx      ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx    ON blog_posts (status);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx  ON blog_posts (category);
CREATE INDEX IF NOT EXISTS blog_posts_author_idx    ON blog_posts (author_id);

-- ─── Categories (products) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_slug_idx      ON categories (slug);
CREATE INDEX IF NOT EXISTS categories_active_idx    ON categories (is_active);

-- Seed default categories
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Electronics',        'electronics',        1),
  ('Clothing & Fashion', 'clothing-fashion',   2),
  ('Home & Garden',      'home-garden',        3),
  ('Industrial',         'industrial',         4),
  ('Food & Agriculture', 'food-agriculture',   5),
  ('Health & Beauty',    'health-beauty',      6),
  ('Toys & Sports',      'toys-sports',        7),
  ('Automotive',         'automotive',         8)
ON CONFLICT (slug) DO NOTHING;
