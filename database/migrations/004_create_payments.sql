-- Migration 004: Payments and Refunds
-- ─────────────────────────────────────

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method                 TEXT NOT NULL
                           CHECK (method IN ('stripe', 'bkash', 'nagad', 'paypal', 'cod')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'completed', 'failed',
                                             'cancelled', 'refunded')),
  amount                 NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency               TEXT NOT NULL DEFAULT 'USD',
  gateway_transaction_id TEXT,
  gateway_response       JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id               ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status                 ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method                 ON payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id ON payments(gateway_transaction_id);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id        UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  gateway_refund_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id        ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status            ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id ON refunds(gateway_refund_id);
