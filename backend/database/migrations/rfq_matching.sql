-- Migration: RFQ Auto-Matching System
-- Tables: rfq_matches, rfq_marketplace, rfq_match_config

-- ─── rfq_matches ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id         UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL,
  match_score    NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_reasons  JSONB DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','notified','viewed','quoted','expired')),
  notified_at    TIMESTAMPTZ,
  viewed_at      TIMESTAMPTZ,
  quoted_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_matches_rfq_id     ON rfq_matches (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_supplier   ON rfq_matches (supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_score      ON rfq_matches (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_status     ON rfq_matches (status);

-- ─── rfq_marketplace ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_marketplace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id        UUID NOT NULL UNIQUE REFERENCES rfqs(id) ON DELETE CASCADE,
  is_public     BOOLEAN NOT NULL DEFAULT TRUE,
  category_id   UUID,
  tags          TEXT[] DEFAULT '{}',
  budget_range  TEXT,
  urgency       TEXT NOT NULL DEFAULT 'medium'
                  CHECK (urgency IN ('low','medium','high','urgent')),
  views_count   INTEGER NOT NULL DEFAULT 0,
  quotes_count  INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_rfq_id    ON rfq_marketplace (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_public    ON rfq_marketplace (is_public);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_category  ON rfq_marketplace (category_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_urgency   ON rfq_marketplace (urgency);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_expires   ON rfq_marketplace (expires_at);

-- ─── rfq_match_config ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_match_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_rfq_match_config_key ON rfq_match_config (key);

-- ─── Default configuration rows ──────────────────────────────────────────────
INSERT INTO rfq_match_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',        'false',    'Enable or disable the auto-matching feature',      FALSE),
  ('mode',                   'test',     'Operating mode: test or live',                     FALSE),
  ('matching_algorithm',     'weighted', 'Algorithm: weighted, ai_powered, or hybrid',       FALSE),
  ('weight_category_match',  '0.30',     'Score weight for category match (0-1)',             FALSE),
  ('weight_country_match',   '0.15',     'Score weight for country match (0-1)',              FALSE),
  ('weight_price_range',     '0.20',     'Score weight for price range alignment (0-1)',      FALSE),
  ('weight_rating',          '0.15',     'Score weight for supplier rating (0-1)',            FALSE),
  ('weight_response_rate',   '0.10',     'Score weight for supplier response rate (0-1)',     FALSE),
  ('weight_on_time_delivery','0.10',     'Score weight for on-time delivery rate (0-1)',      FALSE),
  ('min_match_score',        '0.5',      'Minimum score threshold to include a match',        FALSE),
  ('max_matches_per_rfq',    '20',       'Maximum supplier matches returned per RFQ',         FALSE),
  ('auto_notify_suppliers',  'true',     'Automatically notify matched suppliers',            FALSE),
  ('ai_provider',            'openai',   'AI provider for ai_powered/hybrid modes',           FALSE),
  ('ai_api_key',             '',         'API key for the AI provider (stored encrypted)',    TRUE),
  ('marketplace_enabled',    'true',     'Enable the public RFQ marketplace',                FALSE),
  ('rfq_expiry_days',        '30',       'Days until an RFQ marketplace listing expires',     FALSE)
ON CONFLICT (key) DO NOTHING;
