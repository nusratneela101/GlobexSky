-- Migration: 018_dynamic_features.sql
-- Adds tables for newsletter, barcode products, custom styles,
-- import/export jobs, supplier scores/badges, currency contracts,
-- containers, and freight bookings.

-- ─── Newsletter Subscribers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  name             VARCHAR(100),
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  preferences      JSONB        DEFAULT '{}',
  subscribed_at    TIMESTAMPTZ  DEFAULT NOW(),
  unsubscribed_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_email  ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);

-- ─── Barcode Products ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barcode_products (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode      VARCHAR(128) NOT NULL UNIQUE,
  barcode_type VARCHAR(30)  NOT NULL DEFAULT 'EAN-13',
  product_id   UUID         REFERENCES products(id) ON DELETE SET NULL,
  name         VARCHAR(255),
  description  TEXT,
  metadata     JSONB        DEFAULT '{}',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_barcode_products_barcode    ON barcode_products(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_products_product_id ON barcode_products(product_id);

-- ─── Admin Custom Styles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_custom_styles (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  css_content   TEXT         DEFAULT '',
  js_content    TEXT         DEFAULT '',
  is_active     BOOLEAN      DEFAULT FALSE,
  applied_pages JSONB        DEFAULT '[]',
  created_by    UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_styles_active ON admin_custom_styles(is_active);

-- ─── Import / Export Jobs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_export_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              VARCHAR(10)  NOT NULL CHECK (type IN ('import', 'export')),
  entity_type       VARCHAR(50)  NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url          TEXT,
  total_records     INTEGER      DEFAULT 0,
  processed_records INTEGER      DEFAULT 0,
  failed_records    INTEGER      DEFAULT 0,
  errors            JSONB        DEFAULT '[]',
  created_by        UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  metadata          JSONB        DEFAULT '{}',
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_status     ON import_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_created_by ON import_export_jobs(created_by);

-- ─── Supplier Scores ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_scores (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID         NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reviewer_id         UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  quality_score       NUMERIC(3,1) NOT NULL CHECK (quality_score BETWEEN 0 AND 5),
  delivery_score      NUMERIC(3,1) NOT NULL CHECK (delivery_score BETWEEN 0 AND 5),
  communication_score NUMERIC(3,1) NOT NULL CHECK (communication_score BETWEEN 0 AND 5),
  price_score         NUMERIC(3,1) NOT NULL CHECK (price_score BETWEEN 0 AND 5),
  overall_score       NUMERIC(3,1) NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
  review_text         TEXT,
  order_id            UUID         REFERENCES orders(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_supplier_id ON supplier_scores(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_reviewer_id ON supplier_scores(reviewer_id);

-- ─── Supplier Badges ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_badges (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID         NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  badge_type   VARCHAR(50)  NOT NULL,
  badge_name   VARCHAR(100) NOT NULL,
  awarded_at   TIMESTAMPTZ  DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  criteria_met JSONB        DEFAULT '{}',
  metadata     JSONB        DEFAULT '{}',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_badges_supplier_id ON supplier_badges(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_badges_type        ON supplier_badges(badge_type);

-- ─── Currency Contracts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_contracts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  contract_type   VARCHAR(20)   NOT NULL CHECK (contract_type IN ('forward', 'option', 'swap')),
  base_currency   CHAR(3)       NOT NULL,
  quote_currency  CHAR(3)       NOT NULL,
  notional_amount NUMERIC(18,4) NOT NULL,
  contract_rate   NUMERIC(18,6) NOT NULL,
  spot_rate       NUMERIC(18,6),
  settlement_date DATE          NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'active', 'closed', 'expired', 'cancelled')),
  hedging_ratio   NUMERIC(5,4)  DEFAULT 1.0,
  pnl             NUMERIC(18,4),
  metadata        JSONB         DEFAULT '{}',
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_user_id    ON currency_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_status     ON currency_contracts(status);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_settlement ON currency_contracts(settlement_date);

-- ─── Containers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS containers (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number  VARCHAR(20)  NOT NULL UNIQUE,
  type              VARCHAR(30)  NOT NULL,
  size              VARCHAR(10)  NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'booked',
  origin_port       VARCHAR(100) NOT NULL,
  destination_port  VARCHAR(100) NOT NULL,
  carrier           VARCHAR(100),
  vessel_name       VARCHAR(100),
  voyage_number     VARCHAR(50),
  eta               TIMESTAMPTZ,
  etd               TIMESTAMPTZ,
  current_location  VARCHAR(200),
  booking_reference VARCHAR(50),
  supplier_id       UUID         REFERENCES suppliers(id) ON DELETE SET NULL,
  buyer_id          UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  metadata          JSONB        DEFAULT '{}',
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_containers_container_number ON containers(container_number);
CREATE INDEX IF NOT EXISTS idx_containers_status           ON containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_booking_ref      ON containers(booking_reference);

-- ─── Freight Bookings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freight_bookings (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(50)   NOT NULL UNIQUE,
  shipper_id        UUID          REFERENCES profiles(user_id) ON DELETE SET NULL,
  consignee_id      UUID          REFERENCES profiles(user_id) ON DELETE SET NULL,
  freight_type      VARCHAR(10)   NOT NULL CHECK (freight_type IN ('FCL', 'LCL', 'AIR', 'RAIL')),
  container_id      UUID          REFERENCES containers(id) ON DELETE SET NULL,
  origin            VARCHAR(200)  NOT NULL,
  destination       VARCHAR(200)  NOT NULL,
  cargo_description TEXT          NOT NULL,
  weight_kg         NUMERIC(10,2),
  volume_cbm        NUMERIC(10,3),
  incoterms         VARCHAR(10),
  estimated_cost    NUMERIC(12,2),
  actual_cost       NUMERIC(12,2),
  status            VARCHAR(30)   NOT NULL DEFAULT 'pending',
  pickup_date       DATE,
  delivery_date     DATE,
  tracking_events   JSONB         DEFAULT '[]',
  metadata          JSONB         DEFAULT '{}',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_shipper_id        ON freight_bookings(shipper_id);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_status            ON freight_bookings(status);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_booking_reference ON freight_bookings(booking_reference);
