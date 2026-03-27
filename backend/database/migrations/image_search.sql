-- ─────────────────────────────────────────────────────────────────
-- AI Image Search System — Database Migration
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── image_search_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_history (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID,
  image_url         TEXT,
  search_type       TEXT    NOT NULL DEFAULT 'upload'
                              CHECK (search_type IN ('upload', 'camera', 'url')),
  results           JSONB   NOT NULL DEFAULT '[]',
  provider          TEXT,
  processing_time_ms INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_search_history_user_id    ON image_search_history (user_id);
CREATE INDEX IF NOT EXISTS idx_image_search_history_created_at ON image_search_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_search_history_provider   ON image_search_history (provider);

-- ─── image_search_config ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_config (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_image_search_config_key ON image_search_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO image_search_config (key, value, description, is_encrypted)
VALUES
  ('feature_enabled',        'false',        'Enable or disable AI image search feature',          FALSE),
  ('mode',                   'test',         'Operating mode: test or live',                       FALSE),
  ('primary_provider',       'openai',       'Primary AI provider: openai, google_vision, azure_cv, clarifai', FALSE),
  ('openai_api_key',         '',             'OpenAI API key (encrypted at rest)',                 TRUE),
  ('google_vision_api_key',  '',             'Google Cloud Vision API key (encrypted at rest)',    TRUE),
  ('azure_cv_endpoint',      '',             'Azure Computer Vision endpoint URL',                 FALSE),
  ('azure_cv_api_key',       '',             'Azure Computer Vision API key (encrypted at rest)',  TRUE),
  ('clarifai_api_key',       '',             'Clarifai API key (encrypted at rest)',               TRUE),
  ('max_results',            '20',           'Maximum number of similar products to return',       FALSE),
  ('min_confidence',         '0.7',          'Minimum confidence threshold for results (0–1)',     FALSE),
  ('max_file_size_mb',       '10',           'Maximum image file size in megabytes',               FALSE),
  ('allowed_formats',        'jpg,jpeg,png,webp', 'Comma-separated list of allowed image formats', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for image_search_config ──────────────────
CREATE OR REPLACE FUNCTION image_search_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_image_search_config_updated_at ON image_search_config;
CREATE TRIGGER trg_image_search_config_updated_at
  BEFORE UPDATE ON image_search_config
  FOR EACH ROW EXECUTE FUNCTION image_search_config_set_updated_at();
