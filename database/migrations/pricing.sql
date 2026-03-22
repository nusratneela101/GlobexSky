-- ─────────────────────────────────────────────────────────────────
-- Migration: Pricing & Commission Management Tables
-- commission_settings, supplier_plans, inspection_pricing,
-- dropshipping_markup, carry_service_rates, parcel_pricing,
-- api_pricing_tiers
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_settings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           TEXT NOT NULL CHECK (type IN ('supplier','buyer','dropshipping','api','carry','parcel')),
  category       TEXT DEFAULT 'all',
  min_value      NUMERIC(12,2) DEFAULT 0,
  max_value      NUMERIC(12,2),
  rate           NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  min_commission NUMERIC(10,2) DEFAULT 0,
  max_commission NUMERIC(10,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  monthly_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  features        JSONB DEFAULT '[]',
  setup_fee       NUMERIC(10,2) DEFAULT 0,
  ai_budget       NUMERIC(10,2) DEFAULT 0,
  trial_days      INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  rush_fee_percent NUMERIC(5,2) DEFAULT 0,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropshipping_markup (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category       TEXT NOT NULL DEFAULT 'all',
  min_price      NUMERIC(12,2) DEFAULT 0,
  max_price      NUMERIC(12,2),
  markup_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
  min_profit     NUMERIC(10,2) DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carry_service_rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     TEXT NOT NULL,
  subcategory  TEXT,
  rate_per_kg  NUMERIC(10,2) NOT NULL,
  min_charge   NUMERIC(10,2) DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country          TEXT NOT NULL DEFAULT 'all',
  min_weight       NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight       NUMERIC(8,2),
  rate_per_kg      NUMERIC(10,2) NOT NULL,
  base_fee         NUMERIC(10,2) DEFAULT 0,
  express_fee      NUMERIC(10,2) DEFAULT 0,
  economy_discount NUMERIC(5,2) DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_pricing_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  monthly_cost    NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_limit   INTEGER,
  rate_limit      INTEGER,
  features        JSONB DEFAULT '[]',
  commission_rate NUMERIC(5,4) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default supplier plans
INSERT INTO supplier_plans (name, monthly_fee, commission_rate, features, setup_fee, ai_budget, trial_days, sort_order)
VALUES
  ('Starter',     0,      0.08, '["10 products","Basic analytics","Standard support"]',       0,    0,    0,  1),
  ('Professional',49.99,  0.05, '["Unlimited products","Advanced analytics","Priority support","Verified badge"]', 9.99, 0, 14, 2),
  ('Enterprise',  199.99, 0.03, '["Unlimited products","AI recommendations","Dedicated manager","Custom integrations","AI ad budget $500/mo"]', 0, 500, 30, 3)
ON CONFLICT DO NOTHING;

-- Default commission settings
INSERT INTO commission_settings (type, category, min_value, rate, min_commission)
VALUES
  ('supplier', 'all',         0,    0.05, 1.00),
  ('supplier', 'electronics', 0,    0.04, 1.00),
  ('supplier', 'apparel',     0,    0.07, 0.50),
  ('dropshipping', 'all',     0,    0.03, 0.50),
  ('api',      'all',         0,    0.02, 0.00),
  ('carry',    'all',         0,    0.10, 2.00),
  ('parcel',   'all',         0,    0.08, 1.00)
ON CONFLICT DO NOTHING;
