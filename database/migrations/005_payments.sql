-- ─────────────────────────────────────────────────────────────────
-- Migration 005: Payments & Transactions
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID NOT NULL REFERENCES auth.users(id),
  order_id               UUID REFERENCES orders(id),
  type                   TEXT NOT NULL CHECK (type IN ('payment','refund','payout','commission','subscription')),
  amount                 NUMERIC(12,2) NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'USD',
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  payment_method         TEXT,
  payment_gateway        TEXT,
  gateway_transaction_id TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order   ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);

CREATE TABLE IF NOT EXISTS carrier_earnings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES carrier_profiles(id),
  carry_request_id UUID REFERENCES carry_requests(id),
  base_amount      NUMERIC(10,2) NOT NULL,
  bonus            NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','withdrawn')),
  withdrawn_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_payouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id    UUID NOT NULL REFERENCES supplier_profiles(id),
  amount         NUMERIC(12,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  payout_method  TEXT,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
