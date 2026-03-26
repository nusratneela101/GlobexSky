-- ============================================================
-- Migration: 017_missing_tables.sql
-- Purpose  : Create tables that are referenced by the
--            application but were not yet present in the schema:
--              flash_sales, loyalty_points,
--              dropshipping_products, support_tickets,
--              support_ticket_messages, vr_showrooms,
--              gdpr_requests, advertisements
--            Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- flash_sales
CREATE TABLE IF NOT EXISTS flash_sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL,
  product_ids      UUID[] DEFAULT '{}',
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  max_quantity     INTEGER,
  sold_count       INTEGER DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_status     ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_start_time ON flash_sales(start_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_end_time   ON flash_sales(end_time);

-- loyalty_points
CREATE TABLE IF NOT EXISTS loyalty_points (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  points       INTEGER NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','adjust')),
  source       TEXT,
  reference_id UUID,
  description  TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user       ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_type       ON loyalty_points(type);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_expires_at ON loyalty_points(expires_at);

-- dropshipping_products
CREATE TABLE IF NOT EXISTS dropshipping_products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID NOT NULL,
  original_product_id UUID,
  seller_id           UUID NOT NULL,
  markup_percent      NUMERIC(5,2) NOT NULL DEFAULT 20,
  selling_price       NUMERIC(12,2),
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','sold_out')),
  imported_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dropshipping_products_seller   ON dropshipping_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_dropshipping_products_supplier ON dropshipping_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dropshipping_products_status   ON dropshipping_products(status);

-- support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  subject     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','urgent')),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user     ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);

-- support_ticket_messages
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  message     TEXT NOT NULL,
  attachments TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_sender ON support_ticket_messages(sender_id);

-- vr_showrooms
CREATE TABLE IF NOT EXISTS vr_showrooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  model_urls    TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  product_ids   UUID[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','draft')),
  views         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vr_showrooms_seller ON vr_showrooms(seller_id);
CREATE INDEX IF NOT EXISTS idx_vr_showrooms_status ON vr_showrooms(status);

-- gdpr_requests
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('export','deletion','correction','portability')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','rejected')),
  data_url     TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user   ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type   ON gdpr_requests(type);

-- advertisements
CREATE TABLE IF NOT EXISTS advertisements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id   UUID NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'banner'
                CHECK (type IN ('banner','featured','sponsored','video')),
  target_url  TEXT,
  image_url   TEXT,
  placement   TEXT NOT NULL DEFAULT 'homepage',
  budget      NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent       NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','paused','ended','rejected')),
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_seller ON advertisements(seller_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_type   ON advertisements(type);
