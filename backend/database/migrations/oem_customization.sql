-- OEM / Product Customization Request System
-- Migration: oem_customization.sql

-- ─── customization_requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id         UUID NOT NULL,
  supplier_id      UUID,
  product_id       UUID,
  title            TEXT NOT NULL,
  description      TEXT,
  specifications   JSONB DEFAULT '{}',
  attachments      TEXT[] DEFAULT '{}',
  quantity         INTEGER,
  target_price     NUMERIC(12,2),
  target_date      DATE,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','quoted','accepted','in_production','completed','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_buyer_id    ON customization_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_cr_supplier_id ON customization_requests (supplier_id);
CREATE INDEX IF NOT EXISTS idx_cr_status      ON customization_requests (status);

-- ─── customization_quotes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL,
  unit_price     NUMERIC(12,2) NOT NULL,
  total_price    NUMERIC(12,2) NOT NULL,
  moq            INTEGER,
  lead_time_days INTEGER,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','expired')),
  valid_until    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cq_request_id  ON customization_quotes (request_id);
CREATE INDEX IF NOT EXISTS idx_cq_supplier_id ON customization_quotes (supplier_id);

-- ─── customization_messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  message     TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_request_id ON customization_messages (request_id);

-- ─── customization_config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- Default config values
INSERT INTO customization_config (key, value, description) VALUES
  ('feature_enabled',               'false', 'Enable or disable the OEM customization feature'),
  ('mode',                          'test',  'Operational mode: test or live'),
  ('max_attachments',               '10',    'Maximum number of file attachments per request'),
  ('max_file_size_mb',              '25',    'Maximum file size in MB per attachment'),
  ('auto_notify_matching_suppliers','true',  'Automatically notify matching suppliers when a request is submitted'),
  ('quote_expiry_days',             '14',    'Number of days until a submitted quote expires'),
  ('max_quotes_per_request',        '10',    'Maximum number of quotes allowed per customization request')
ON CONFLICT (key) DO NOTHING;
