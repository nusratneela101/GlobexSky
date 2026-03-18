-- ─────────────────────────────────────────────────────────────────
-- Migration 006: Pricing & Commission Settings
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_settings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           TEXT NOT NULL CHECK (type IN ('category','order_value','default')),
  category_id    UUID REFERENCES categories(id),
  min_value      NUMERIC(12,2),
  max_value      NUMERIC(12,2),
  rate_percentage NUMERIC(5,2) NOT NULL DEFAULT 5,
  flat_fee       NUMERIC(8,2) NOT NULL DEFAULT 0,
  min_commission NUMERIC(8,2),
  max_commission NUMERIC(8,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  monthly_fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate      NUMERIC(5,2) NOT NULL DEFAULT 5,
  features             JSONB,
  ai_marketing_budget  NUMERIC(10,2) DEFAULT 0,
  setup_fee            NUMERIC(10,2) DEFAULT 0,
  trial_days           INTEGER DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_pricing (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                TEXT NOT NULL,
  name                TEXT NOT NULL,
  price               NUMERIC(10,2) NOT NULL,
  rush_fee_percentage NUMERIC(5,2) DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dropshipping_markup (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type               TEXT NOT NULL CHECK (type IN ('global','category','price_range')),
  category_id        UUID REFERENCES categories(id),
  min_price          NUMERIC(10,2),
  max_price          NUMERIC(10,2),
  markup_percentage  NUMERIC(5,2) NOT NULL DEFAULT 20,
  min_profit         NUMERIC(8,2) DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_country  TEXT NOT NULL,
  min_weight           NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight           NUMERIC(8,2) NOT NULL DEFAULT 999,
  price_per_kg         NUMERIC(8,2) NOT NULL,
  base_fee             NUMERIC(8,2) NOT NULL DEFAULT 0,
  express_fee          NUMERIC(8,2) DEFAULT 0,
  fragile_fee          NUMERIC(8,2) DEFAULT 0,
  insurance_percentage NUMERIC(5,2) DEFAULT 1,
  estimated_days_min   INTEGER DEFAULT 7,
  estimated_days_max   INTEGER DEFAULT 14,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS carry_rates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_category  TEXT NOT NULL,
  name              TEXT,
  payment_per_kg    NUMERIC(8,2) NOT NULL,
  fragile_surcharge NUMERIC(8,2) DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS api_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  monthly_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_limit        INTEGER NOT NULL DEFAULT 1000,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  features             JSONB,
  commission_rate      NUMERIC(5,2) DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS advertising_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             TEXT NOT NULL,
  name             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  duration_options JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);
