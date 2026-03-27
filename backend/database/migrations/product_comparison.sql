-- ============================================================
-- Product Comparison Tool — Database Migration
-- ============================================================

-- Table 1: product_comparisons
-- Stores comparison lists created by users (or guests).
CREATE TABLE IF NOT EXISTS product_comparisons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,   -- nullable for guests
  products     JSONB NOT NULL DEFAULT '[]',                         -- array of product_ids (UUIDs)
  name         TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT FALSE,
  share_token  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_comparisons_user_id      ON product_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_share_token  ON product_comparisons(share_token);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_is_public    ON product_comparisons(is_public);

-- Table 2: comparison_attributes
-- Defines which product attributes are shown per category in the comparison table.
CREATE TABLE IF NOT EXISTS comparison_attributes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID REFERENCES categories(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  attribute_key  TEXT NOT NULL,
  sort_order     INT  NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_attributes_category_id ON comparison_attributes(category_id);
CREATE INDEX IF NOT EXISTS idx_comparison_attributes_is_active   ON comparison_attributes(is_active);

-- Table 3: product_comparison_config
-- Admin-controlled platform settings for the comparison feature.
CREATE TABLE IF NOT EXISTS product_comparison_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_comparison_config_key ON product_comparison_config(key);

-- Seed default config values
INSERT INTO product_comparison_config (key, value, description) VALUES
  ('comparison_enabled',    'true',  'Enable or disable the product comparison feature'),
  ('max_products',          '5',     'Maximum number of products allowed in a single comparison'),
  ('sharing_enabled',       'true',  'Allow users to share comparisons via public link'),
  ('guest_comparison',      'true',  'Allow guests (unauthenticated users) to create comparisons'),
  ('mode',                  'live',  'Platform mode: live | test'),
  ('highlight_differences', 'true',  'Highlight differing attribute values between compared products')
ON CONFLICT (key) DO NOTHING;
