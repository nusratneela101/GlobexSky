-- Migration 019: Supplier Scorecard & Badge Catalog tables
-- Creates supplier_scorecards (aggregate per-supplier scorecard) and badge_catalog (available badge types).

-- ─── Supplier Scorecards ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_scorecards (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           UUID         NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  quality_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  delivery_score        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (delivery_score BETWEEN 0 AND 100),
  communication_score   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (communication_score BETWEEN 0 AND 100),
  pricing_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pricing_score BETWEEN 0 AND 100),
  badges                JSONB        NOT NULL DEFAULT '[]',
  review_count          INTEGER      NOT NULL DEFAULT 0,
  last_evaluated_at     TIMESTAMPTZ  DEFAULT NOW(),
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_supplier_id ON supplier_scorecards(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_overall     ON supplier_scorecards(overall_score DESC);

-- ─── Badge Catalog ────────────────────────────────────────────────────────────
-- Stores the definition/catalog of available badges (not per-supplier awards).
CREATE TABLE IF NOT EXISTS badge_catalog (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT         NOT NULL,
  icon        VARCHAR(100) NOT NULL,
  criteria    JSONB        NOT NULL DEFAULT '{}',
  tier        VARCHAR(20)  NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badge_catalog_tier ON badge_catalog(tier);

-- ─── Seed default badge catalog entries ──────────────────────────────────────
INSERT INTO badge_catalog (name, description, icon, criteria, tier) VALUES
  ('Bronze Supplier',    'Achieved an overall score of 50+',           'fa-medal',         '{"overall_min": 50}',  'bronze'),
  ('Silver Supplier',    'Achieved an overall score of 65+',           'fa-award',         '{"overall_min": 65}',  'silver'),
  ('Gold Supplier',      'Achieved an overall score of 80+',           'fa-star',          '{"overall_min": 80}',  'gold'),
  ('Platinum Supplier',  'Achieved an overall score of 90+',           'fa-crown',         '{"overall_min": 90}',  'platinum'),
  ('Premium Quality',    'Quality score of 90 or above',               'fa-gem',           '{"quality_min": 90}',  'gold'),
  ('Fast Shipper',       'Delivery score of 90 or above',              'fa-shipping-fast', '{"delivery_min": 90}', 'silver'),
  ('Quick Responder',    'Communication score of 90 or above',         'fa-bolt',          '{"communication_min": 90}', 'silver'),
  ('Best Value',         'Pricing score of 90 or above',               'fa-tag',           '{"pricing_min": 90}',  'bronze')
ON CONFLICT DO NOTHING;
