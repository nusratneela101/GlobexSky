-- Migration: Complete Features & Admin Configuration
-- Creates the system_configs table for the Admin Configuration Panel.
-- Ensures all tables referenced by the 16 completed features exist.

-- ─── system_configs (Admin Configuration Panel) ─────────────────────────────

CREATE TABLE IF NOT EXISTS system_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key      TEXT NOT NULL UNIQUE,
  config_value    JSONB,
  config_group    TEXT NOT NULL DEFAULT 'general',
  is_secret       BOOLEAN NOT NULL DEFAULT false,
  is_live         BOOLEAN NOT NULL DEFAULT false,
  test_value      TEXT,
  live_value      TEXT,
  last_tested_at  TIMESTAMPTZ,
  test_status     TEXT NOT NULL DEFAULT 'untested'
                    CHECK (test_status IN ('untested', 'success', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_group ON system_configs(config_group);
CREATE INDEX IF NOT EXISTS idx_system_configs_key   ON system_configs(config_key);

-- ─── blog_posts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content         TEXT NOT NULL DEFAULT '',
  excerpt         TEXT,
  featured_image  TEXT,
  category        TEXT,
  tags            JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  published_at    TIMESTAMPTZ,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug     ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status   ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author   ON blog_posts(author_id);

-- Helper RPC for atomic view count increment
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts SET views_count = views_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- ─── templates (shared by email & sms templates) ───────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  category        TEXT,
  subject         TEXT,
  body            TEXT NOT NULL DEFAULT '',
  variables       JSONB DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

CREATE TABLE IF NOT EXISTS template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  subject         TEXT,
  body            TEXT,
  variables       JSONB DEFAULT '[]',
  changed_by      UUID REFERENCES auth.users(id),
  change_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);

-- ─── commissions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT DEFAULT 'percentage',
  category_id     UUID REFERENCES categories(id),
  min_order_value NUMERIC DEFAULT 0,
  max_order_value NUMERIC,
  rate_percent    NUMERIC NOT NULL DEFAULT 0,
  min_cap         NUMERIC,
  max_cap         NUMERIC,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_category ON commissions(category_id);

-- ─── subscription_plans ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL UNIQUE,
  price_monthly         NUMERIC NOT NULL DEFAULT 0,
  price_yearly          NUMERIC,
  currency              TEXT NOT NULL DEFAULT 'USD',
  features              JSONB DEFAULT '[]',
  max_products          INTEGER,
  max_orders_per_month  INTEGER,
  ai_marketing_budget   NUMERIC DEFAULT 0,
  analytics_level       TEXT DEFAULT 'basic',
  support_level         TEXT DEFAULT 'email',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  trial_days            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── saved_searches ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_searches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  query           TEXT NOT NULL,
  filters         JSONB DEFAULT '{}',
  name            TEXT,
  alert_enabled   BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- ─── search_history_items ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  query           TEXT NOT NULL,
  results_count   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history_items(user_id, created_at DESC);

-- Helper RPC for trending searches aggregation
CREATE OR REPLACE FUNCTION get_trending_searches(since_ts TIMESTAMPTZ, result_limit INTEGER)
RETURNS TABLE(query TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT sh.query, COUNT(*) as count
    FROM search_history_items sh
    WHERE sh.created_at >= since_ts
    GROUP BY sh.query
    ORDER BY count DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── gdpr_requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  type            TEXT NOT NULL CHECK (type IN ('export', 'deletion', 'correction')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  data_url        TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);

-- ─── vr_showrooms ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vr_showrooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  model_urls      JSONB DEFAULT '[]',
  thumbnail_url   TEXT,
  product_ids     JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'draft')),
  views           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── meetings ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           UUID NOT NULL REFERENCES auth.users(id),
  participant_ids   JSONB DEFAULT '[]',
  title             TEXT NOT NULL,
  description       TEXT,
  meeting_url       TEXT,
  agora_channel     TEXT,
  status            TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  duration_mins     INTEGER DEFAULT 30,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
