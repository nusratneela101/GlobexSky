-- ─────────────────────────────────────────────────────────────────
-- Migration 008: CMS (Pages, Banners, Blog, FAQs, Email Templates)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  content    TEXT,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link       TEXT,
  position   TEXT,
  start_date TIMESTAMPTZ,
  end_date   TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content        TEXT,
  author_id      UUID REFERENCES auth.users(id),
  category       TEXT,
  tags           TEXT[] DEFAULT '{}',
  featured_image TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug   ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

CREATE TABLE IF NOT EXISTS email_templates (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT UNIQUE NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS faqs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS site_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  type       TEXT DEFAULT 'text',
  category   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Livestreams
CREATE TABLE IF NOT EXISTS livestreams (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID REFERENCES supplier_profiles(id),
  title        TEXT NOT NULL,
  description  TEXT,
  thumbnail    TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
