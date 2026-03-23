-- Migration 007: Promotions — Coupons, Flash Sales, and Campaigns
-- ─────────────────────────────────────────────────────────────────

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value      NUMERIC(12,2) NOT NULL CHECK (value > 0),
  min_order  NUMERIC(12,2) DEFAULT 0,
  max_uses   INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code      ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);

-- Flash Sales table
CREATE TABLE IF NOT EXISTS flash_sales (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_price NUMERIC(12,2) NOT NULL CHECK (original_price > 0),
  sale_price     NUMERIC(12,2) NOT NULL CHECK (sale_price > 0),
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  max_quantity   INTEGER,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flash_sales_price_check CHECK (sale_price < original_price),
  CONSTRAINT flash_sales_time_check  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_product_id ON flash_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_start_time ON flash_sales(start_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_end_time   ON flash_sales(end_time);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  conditions JSONB,
  rewards    JSONB,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaigns_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_is_active  ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date   ON campaigns(end_date);
