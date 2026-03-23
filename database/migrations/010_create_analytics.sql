-- Migration 010: Analytics — Product Views, Search Logs, and Feature Toggles
-- ─────────────────────────────────────────────────────────────────────────────

-- Product Views table
CREATE TABLE IF NOT EXISTS product_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_spent  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_user_id    ON product_views(user_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at  ON product_views(viewed_at DESC);

-- Search Logs table
CREATE TABLE IF NOT EXISTS search_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  query              TEXT NOT NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  searched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id    ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_searched_at ON search_logs(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_query       ON search_logs USING gin(to_tsvector('english', query));

-- Feature Toggles table
CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  conditions   JSONB,
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_toggles_feature_name ON feature_toggles(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_is_enabled   ON feature_toggles(is_enabled);
