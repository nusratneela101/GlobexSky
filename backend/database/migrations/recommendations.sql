-- ─────────────────────────────────────────────────────────────────
-- AI Product Recommendations Engine — Database Migration
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── user_interactions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_interactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  product_id       UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view','click','cart','purchase','wishlist')),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id    ON user_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_product_id ON user_interactions (product_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type       ON user_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions (created_at);

-- ─── product_recommendations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_recommendations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL,
  product_id UUID NOT NULL,
  score      NUMERIC(5,4) NOT NULL DEFAULT 0,
  algorithm  TEXT NOT NULL DEFAULT 'hybrid',
  reason     TEXT,
  is_shown   BOOLEAN NOT NULL DEFAULT FALSE,
  is_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_recs_user_id    ON product_recommendations (user_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_product_id ON product_recommendations (product_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_score      ON product_recommendations (score DESC);
CREATE INDEX IF NOT EXISTS idx_product_recs_expires_at ON product_recommendations (expires_at);

-- ─── recommendation_config ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_recommendation_config_key ON recommendation_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO recommendation_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',                    'false',        'Enable or disable the recommendations engine',              FALSE),
  ('mode',                               'test',         'Operating mode: test or live',                              FALSE),
  ('algorithm',                          'hybrid',       'Algorithm: collaborative, content_based, hybrid, ai_powered', FALSE),
  ('ai_provider',                        'openai',       'AI provider: openai, azure, custom',                        FALSE),
  ('ai_api_key',                         '',             'AI provider API key (encrypted at rest)',                   TRUE),
  ('ai_endpoint',                        '',             'Custom AI endpoint URL (for azure or custom provider)',     FALSE),
  ('max_recommendations',                '12',           'Maximum number of recommendations to return per user',      FALSE),
  ('refresh_interval_hours',             '24',           'How often (hours) recommendations are regenerated',         FALSE),
  ('min_interactions_for_personalization','5',           'Minimum interactions needed before personalised recs fire', FALSE),
  ('enable_similar_products',            'true',         'Enable similar products widget',                            FALSE),
  ('enable_frequently_bought_together',  'true',         'Enable frequently bought together widget',                  FALSE),
  ('enable_trending',                    'true',         'Enable trending products widget',                           FALSE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for recommendation_config ────────────────
CREATE OR REPLACE FUNCTION recommendation_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommendation_config_updated_at ON recommendation_config;
CREATE TRIGGER trg_recommendation_config_updated_at
  BEFORE UPDATE ON recommendation_config
  FOR EACH ROW EXECUTE FUNCTION recommendation_config_set_updated_at();
