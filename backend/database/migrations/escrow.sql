-- ─────────────────────────────────────────────────────────────────
-- Escrow Payment System — Database Migration
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── escrow_transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL,
  buyer_id      UUID NOT NULL,
  supplier_id   UUID NOT NULL,
  amount        NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
  status        VARCHAR(20) NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  milestone_id  UUID,
  held_at       TIMESTAMPTZ,
  released_at   TIMESTAMPTZ,
  refunded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_order_id   ON escrow_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer_id   ON escrow_transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_supplier_id ON escrow_transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status     ON escrow_transactions (status);

-- ─── escrow_milestones ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_milestones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id    UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed', 'released')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow_id ON escrow_milestones (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status    ON escrow_milestones (status);

-- ─── escrow_audit_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id  UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  actor_id   UUID NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_escrow_id ON escrow_audit_log (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_actor_id  ON escrow_audit_log (actor_id);

-- ─── escrow_config ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_escrow_config_key ON escrow_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO escrow_config (key, value, description, is_encrypted)
VALUES
  ('escrow_enabled',        'true',   'Enable or disable the escrow system',              FALSE),
  ('hold_period_days',      '7',      'Number of days funds are held in escrow',          FALSE),
  ('platform_fee_percent',  '2.5',    'Platform fee percentage on escrow transactions',   FALSE),
  ('auto_release_enabled',  'true',   'Automatically release funds after hold period',    FALSE),
  ('auto_release_days',     '14',     'Days after which funds are auto-released',         FALSE),
  ('min_escrow_amount',     '10.00',  'Minimum transaction amount for escrow',            FALSE),
  ('payment_gateway',       'stripe', 'Active payment gateway (stripe / paypal)',         FALSE),
  ('gateway_mode',          'test',   'Gateway mode: test or live',                       FALSE),
  ('stripe_public_key',     '',       'Stripe publishable key',                           FALSE),
  ('stripe_secret_key',     '',       'Stripe secret key (encrypted at rest)',            TRUE),
  ('paypal_client_id',      '',       'PayPal client ID',                                 FALSE),
  ('paypal_client_secret',  '',       'PayPal client secret (encrypted at rest)',         TRUE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for escrow_transactions ──────────────────
CREATE OR REPLACE FUNCTION escrow_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_transactions_updated_at ON escrow_transactions;
CREATE TRIGGER trg_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_milestones_updated_at ON escrow_milestones;
CREATE TRIGGER trg_escrow_milestones_updated_at
  BEFORE UPDATE ON escrow_milestones
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_config_updated_at ON escrow_config;
CREATE TRIGGER trg_escrow_config_updated_at
  BEFORE UPDATE ON escrow_config
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();
