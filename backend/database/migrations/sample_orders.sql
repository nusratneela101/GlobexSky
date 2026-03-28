-- Migration: Sample Order System
-- Creates tables: sample_orders, sample_order_config

-- ─── sample_orders ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sample_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id           UUID NOT NULL,
  supplier_id        UUID NOT NULL,
  product_id         UUID NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1,
  message            TEXT,
  shipping_address_id UUID,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','shipped','delivered','reviewed')),
  tracking_number    TEXT,
  cost               NUMERIC(10,2) DEFAULT 0,
  is_free            BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_notes     TEXT,
  buyer_feedback     TEXT,
  buyer_rating       SMALLINT CHECK (buyer_rating BETWEEN 1 AND 5),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_orders_buyer_id    ON sample_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_supplier_id ON sample_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_product_id  ON sample_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_status      ON sample_orders (status);

-- ─── sample_order_config ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sample_order_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- Default configuration rows
INSERT INTO sample_order_config (key, value, description) VALUES
  ('max_samples_per_buyer',            '3',     'Maximum number of sample orders a buyer can have open at one time'),
  ('max_samples_per_product',          '1',     'Maximum number of samples a buyer can request per product'),
  ('free_sample_eligible_min_order',   '500',   'Minimum cumulative order value (USD) for free sample eligibility'),
  ('auto_approve_verified_suppliers',  'false', 'Automatically approve sample requests for verified suppliers'),
  ('sample_request_cooldown_days',     '30',    'Days a buyer must wait before requesting another sample from the same supplier'),
  ('feature_enabled',                  'false', 'Master switch to enable or disable the sample order feature'),
  ('mode',                             'test',  'Operating mode: test or live')
ON CONFLICT (key) DO NOTHING;
