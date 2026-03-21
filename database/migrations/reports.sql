-- ─────────────────────────────────────────────────────────────────
-- Migration: Financial Reports Tables
-- transactions, payouts, admin_settings
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('payment','refund','payout','commission','subscription','adjustment')),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL,
  fee         NUMERIC(10,2) DEFAULT 0,
  net_amount  NUMERIC(12,2),
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','cancelled')),
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order   ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT NOT NULL DEFAULT 'bank_transfer',
  type         TEXT NOT NULL DEFAULT 'supplier' CHECK (type IN ('supplier','carrier','affiliate')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  notes        TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_user    ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status  ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_type    ON payouts(type);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- Admin key-value settings store
CREATE TABLE IF NOT EXISTS admin_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default payout schedule setting
INSERT INTO admin_settings (key, value)
VALUES ('payout_schedule', '{"frequency":"weekly","day_of_week":5,"min_amount":50,"auto_process":false}')
ON CONFLICT (key) DO NOTHING;
