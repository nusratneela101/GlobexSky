-- ─────────────────────────────────────────────────────────────────
-- Migration: Payment Gateway Tables
-- payments, escrow
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  amount      NUMERIC(12,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  method      TEXT NOT NULL CHECK (method IN ('card','paypal','bank_transfer','escrow','cod')),
  provider    TEXT,
  provider_id TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','completed','failed','refunded','held','cancelled')),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_id);

CREATE TABLE IF NOT EXISTS escrow (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id           UUID REFERENCES orders(id) ON DELETE SET NULL,
  buyer_id           UUID NOT NULL REFERENCES auth.users(id),
  seller_id          UUID NOT NULL REFERENCES auth.users(id),
  amount             NUMERIC(12,2) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held','released','disputed','refunded','cancelled')),
  release_conditions TEXT,
  released_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_order  ON escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer  ON escrow(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow(status);
