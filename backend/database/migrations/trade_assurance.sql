-- =============================================================================
-- Trade Assurance / Buyer Protection System
-- Migration: trade_assurance.sql
-- =============================================================================

-- ─── trade_assurance_policies ────────────────────────────────────────────────
-- Policy definitions: coverage %, max claim amount, duration, terms

CREATE TABLE IF NOT EXISTS trade_assurance_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  coverage_pct    NUMERIC(5,2) NOT NULL DEFAULT 100.00,  -- e.g. 100.00 = 100%
  max_amount      NUMERIC(14,2) NOT NULL DEFAULT 50000.00,
  duration_days   INTEGER NOT NULL DEFAULT 90,           -- claim window in days
  terms           TEXT,                                  -- policy terms/conditions
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_claims ───────────────────────────────────────────────────
-- Buyer claims against an order

CREATE TABLE IF NOT EXISTS trade_assurance_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES trade_assurance_policies(id),
  order_id        UUID NOT NULL,
  buyer_id        UUID NOT NULL,
  supplier_id     UUID,
  claim_amount    NUMERIC(14,2) NOT NULL,
  reason          TEXT NOT NULL,
  description     TEXT,
  evidence_urls   JSONB DEFAULT '[]',                    -- array of file/image URLs
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','under_review','approved','rejected','resolved','closed')),
  resolution      TEXT,
  resolution_amount NUMERIC(14,2),
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  is_test_mode    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_deposits ────────────────────────────────────────────────
-- Supplier security deposits held by the platform

CREATE TABLE IF NOT EXISTS trade_assurance_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','released','forfeited','refunded')),
  reference       TEXT,
  notes           TEXT,
  released_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_config ───────────────────────────────────────────────────
-- Admin-configurable settings for Trade Assurance

CREATE TABLE IF NOT EXISTS trade_assurance_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     TEXT NOT NULL UNIQUE,
  value                   TEXT NOT NULL,
  description             TEXT,
  updated_by              UUID,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO trade_assurance_config (key, value, description) VALUES
  ('enabled',               'true',   'Master toggle: enable or disable Trade Assurance'),
  ('mode',                  'test',   'Operating mode: test or live'),
  ('coverage_pct',          '100',    'Default coverage percentage (0-100)'),
  ('max_claim_amount',      '50000',  'Maximum claim amount in USD'),
  ('claim_window_days',     '90',     'Days after delivery within which a claim can be filed'),
  ('auto_approve_threshold','500',    'Claims up to this USD amount are auto-approved'),
  ('deposit_required_pct',  '5',      'Supplier deposit as % of annual GMV'),
  ('currency',              'USD',    'Default currency for Trade Assurance transactions')
ON CONFLICT (key) DO NOTHING;
