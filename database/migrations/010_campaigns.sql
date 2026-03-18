-- ─────────────────────────────────────────────────────────────────
-- Migration 010: Campaigns, RFQs, Inspections
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('flash_sale','seasonal','clearance','limited')),
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  start_date     TIMESTAMPTZ NOT NULL,
  end_date       TIMESTAMPTZ NOT NULL,
  product_ids    UUID[] DEFAULT '{}',
  quantity_limit INTEGER,
  banner_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_price   NUMERIC(12,2) NOT NULL,
  discounted_price NUMERIC(12,2) NOT NULL
);

-- RFQs
CREATE TABLE IF NOT EXISTS rfqs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id     UUID NOT NULL REFERENCES auth.users(id),
  product_name TEXT NOT NULL,
  description  TEXT,
  quantity     INTEGER NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'pcs',
  target_price NUMERIC(10,2),
  category_id  UUID REFERENCES categories(id),
  attachments  TEXT[] DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','quoted','negotiating','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfq_quotes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id      UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES supplier_profiles(id),
  price       NUMERIC(10,2) NOT NULL,
  moq         INTEGER NOT NULL DEFAULT 1,
  lead_time   TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID REFERENCES orders(id),
  buyer_id         UUID REFERENCES auth.users(id),
  supplier_id      UUID REFERENCES supplier_profiles(id),
  inspector_id     UUID REFERENCES auth.users(id),
  type             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','scheduled','in_progress','completed','cancelled')),
  scheduled_date   TIMESTAMPTZ,
  factory_address  TEXT,
  report_url       TEXT,
  photos           TEXT[] DEFAULT '{}',
  result           TEXT CHECK (result IN ('pass','fail','conditional')),
  fee              NUMERIC(10,2) DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
