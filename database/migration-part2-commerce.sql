-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Migration Part 2: Commerce
-- (Orders, Shipments, Carry, Suppliers, Wishlists)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER migration-part1-core.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Orders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number       TEXT          UNIQUE,
  buyer_id           UUID          NOT NULL REFERENCES auth.users(id),
  supplier_id        UUID          REFERENCES supplier_profiles(id),
  items              JSONB         NOT NULL DEFAULT '[]'::JSONB,
  subtotal           NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_fee       NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax                NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total              NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency           TEXT          NOT NULL DEFAULT 'USD',
  status             TEXT          NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','confirmed','processing','shipped',
                                         'delivered','cancelled','refunded','disputed')),
  shipping_address   JSONB,
  billing_address    JSONB,
  shipping_address_id UUID         REFERENCES addresses(id),
  billing_address_id  UUID         REFERENCES addresses(id),
  payment_method     TEXT,
  payment_status     TEXT          NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending','unpaid','paid','failed',
                                                  'refunded','partial','partially_refunded')),
  tracking_number    TEXT,
  coupon_code        VARCHAR(50),
  carrier            VARCHAR(100),
  notes              TEXT,
  estimated_delivery DATE,
  parent_order_id    UUID          REFERENCES orders(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id       ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id    ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number   ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at);

-- ── Order Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(14,4) NOT NULL,
  total_price NUMERIC(14,4) NOT NULL,
  total       NUMERIC(14,4)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ── Order Status History ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  notes      TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id   ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

-- ── Order Timeline ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_timeline (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL,
  description TEXT,
  note        TEXT,
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);

-- ── Shipments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id                 UUID REFERENCES orders(id) ON DELETE RESTRICT,
  reference_number         TEXT UNIQUE,
  -- Destination
  destination_country      TEXT,
  destination_country_code TEXT,
  destination_address      TEXT,
  destination_city         TEXT,
  destination_postal_code  TEXT,
  -- Receiver
  receiver_name            TEXT,
  receiver_phone           TEXT,
  receiver_email           TEXT,
  -- Package Details
  package_type             TEXT DEFAULT 'parcel'
                             CHECK (package_type IN ('parcel','document','fragile','liquid')),
  weight_kg                NUMERIC(8,2),
  length_cm                NUMERIC(8,2),
  width_cm                 NUMERIC(8,2),
  height_cm                NUMERIC(8,2),
  declared_value           NUMERIC(12,2),
  declared_contents        TEXT,
  special_handling         JSONB DEFAULT '[]',
  -- Shipping
  carrier                  TEXT,
  shipping_method          TEXT DEFAULT 'standard',
  tracking_number          TEXT,
  -- Pricing
  base_fee                 NUMERIC(10,2) DEFAULT 0,
  weight_fee               NUMERIC(10,2) DEFAULT 0,
  special_handling_fee     NUMERIC(10,2) DEFAULT 0,
  total_cost               NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Status
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending','payment_pending','payment_confirmed',
                               'received_at_warehouse','processing','customs_clearance',
                               'in_transit','out_for_delivery','delivered','returned','cancelled',
                               'picked_up','failed'
                             )),
  payment_status           TEXT DEFAULT 'unpaid'
                             CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- Sender tracking
  sender_courier           TEXT,
  sender_tracking_no       TEXT,
  courier_receipt_url      TEXT,
  dispatched_at            TIMESTAMPTZ,
  shipping_address         JSONB,
  estimated_delivery       DATE,
  shipped_at               TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_user_id       ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id      ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_reference     ON shipments(reference_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status        ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking      ON shipments(tracking_number);

-- Sequence for reference numbers
CREATE SEQUENCE IF NOT EXISTS shipment_ref_seq START 1;

-- ── Shipment Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_events_event_time  ON shipment_events(event_time DESC);

-- ── Shipment Timeline ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  description TEXT NOT NULL,
  photo_url   TEXT,
  is_public   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment ON shipment_timeline(shipment_id);

-- ── Carry Requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  flight_ticket_url TEXT,
  flight_number    TEXT NOT NULL,
  origin           TEXT NOT NULL,
  destination      TEXT NOT NULL,
  departure_city   TEXT,
  arrival_city     TEXT,
  departure_date   DATE NOT NULL,
  arrival_date     DATE,
  weight_capacity  NUMERIC(8,2),
  available_weight NUMERIC(8,2),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','open','full','in_transit','completed','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier_id ON carry_requests(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_status     ON carry_requests(status);

-- ── Carry Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id  UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products(id),
  product_name      TEXT,
  product_category  TEXT,
  quantity          INTEGER NOT NULL DEFAULT 1,
  weight_kg         NUMERIC(8,2) NOT NULL,
  payment_per_kg    NUMERIC(8,2),
  payment_amount    NUMERIC(10,2),
  total_payment     NUMERIC(10,2),
  buyer_id          UUID REFERENCES auth.users(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  booked_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_items_request_id ON carry_items(carry_request_id);

-- ── Carry Deliveries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  receiver_name    TEXT,
  receiver_address TEXT,
  receiver_phone   TEXT,
  qr_code          TEXT,
  delivery_receipt_url TEXT,
  photos           TEXT[] DEFAULT '{}',
  signature        TEXT,
  delivery_status  TEXT NOT NULL DEFAULT 'pending'
                     CHECK (delivery_status IN (
                       'pending','collected','in_transit','out_for_delivery',
                       'delivered','failed','returned'
                     )),
  pickup_status    TEXT NOT NULL DEFAULT 'pending'
                     CHECK (pickup_status IN ('pending','picked_up','failed')),
  collected_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request_id ON carry_deliveries(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_deliveries_status     ON carry_deliveries(delivery_status);

-- ── Carry Rates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_rates (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_category     TEXT NOT NULL,
  payment_per_kg       NUMERIC(8,2) NOT NULL,
  max_weight_kg        NUMERIC(8,2),
  platform_fee_percent NUMERIC(5,2) DEFAULT 10,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Carry Products ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  category         TEXT,
  rate_per_kg      NUMERIC(10,4) DEFAULT 0,
  min_weight       NUMERIC(8,3),
  max_weight       NUMERIC(8,3),
  bonus_rate       NUMERIC(10,4) DEFAULT 0,
  surge_multiplier NUMERIC(5,4)  DEFAULT 1,
  platform_fee_percent NUMERIC(5,2) DEFAULT 0,
  quantity         INTEGER NOT NULL DEFAULT 1,
  weight           NUMERIC(8,2),
  unit_value       NUMERIC(12,2),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_products_request  ON carry_products(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_products_product  ON carry_products(product_id);

-- ── Carry Service Rates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_service_rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     TEXT NOT NULL,
  subcategory  TEXT,
  rate_per_kg  NUMERIC(10,2) NOT NULL,
  min_charge   NUMERIC(10,2) DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Parcel Shipments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_shipments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id             UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  reference_number      TEXT UNIQUE,
  receiver_name         TEXT NOT NULL,
  receiver_phone        TEXT,
  receiver_email        TEXT,
  receiver_address      TEXT NOT NULL,
  receiver_city         TEXT,
  receiver_country      TEXT,
  package_description   TEXT,
  sender_address        JSONB DEFAULT '{}',
  package_details       JSONB DEFAULT '{}',
  weight                NUMERIC(8,2) NOT NULL,
  weight_kg             NUMERIC(8,2),
  length_cm             NUMERIC(8,2),
  width_cm              NUMERIC(8,2),
  height_cm             NUMERIC(8,2),
  dimensions            JSONB DEFAULT '{}',
  declared_value        NUMERIC(12,2),
  shipping_method       TEXT,
  carrier_name          TEXT,
  tracking_number       TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending','confirmed','created','pickup_scheduled',
                            'picked_up','in_transit','customs','out_for_delivery',
                            'delivered','returned','cancelled','failed'
                          )),
  shipping_fee          NUMERIC(12,2),
  insurance_fee         NUMERIC(12,2) DEFAULT 0,
  pricing               JSONB DEFAULT '{}',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_shipments_sender    ON parcel_shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_status    ON parcel_shipments(status);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_ref       ON parcel_shipments(reference_number);

-- ── Parcels ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcels (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id           UUID NOT NULL REFERENCES auth.users(id),
  receiver_name       TEXT NOT NULL,
  receiver_phone      TEXT,
  receiver_address    TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  weight_kg           NUMERIC(8,2) NOT NULL,
  dimensions          JSONB,
  declared_value      NUMERIC(10,2) DEFAULT 0,
  product_type        TEXT,
  shipping_method     TEXT,
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN (
                          'created','received','processing','shipped',
                          'in_transit','customs','delivered'
                        )),
  tracking_number     TEXT UNIQUE NOT NULL,
  carrier_tracking    TEXT,
  total_cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  reference_number    TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_sender          ON parcels(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_number ON parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_parcels_status          ON parcels(status);

-- ── Parcel Tracking Events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_tracking_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  photos      TEXT[] DEFAULT '{}',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_events_parcel ON parcel_tracking_events(parcel_id);

-- ── Suppliers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID          UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name            TEXT          NOT NULL,
  business_type           TEXT
                            CHECK (business_type IN ('manufacturer','trading','manufacturer_trading','wholesaler','agent')),
  established_year        INTEGER,
  registration_number     TEXT,
  description             TEXT,
  country                 TEXT,
  city                    TEXT,
  address                 TEXT,
  contact_name            TEXT,
  contact_email           TEXT,
  contact_phone           TEXT,
  website                 TEXT,
  employees               TEXT,
  annual_revenue          TEXT,
  production_capacity     TEXT,
  export_markets          TEXT,
  oem_odm                 TEXT,
  main_categories         TEXT[] DEFAULT '{}',
  business_license_url    TEXT,
  registration_cert_url   TEXT,
  certifications          JSONB DEFAULT '[]',
  factory_photos          JSONB DEFAULT '[]',
  verification_status     TEXT NOT NULL DEFAULT 'pending'
                            CHECK (verification_status IN (
                              'pending','under_review','verified','rejected','suspended','unverified','pro'
                            )),
  verification_documents  JSONB NOT NULL DEFAULT '[]'::JSONB,
  verified_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  tier                    TEXT NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free','basic','gold','platinum','diamond')),
  plan_type               TEXT NOT NULL DEFAULT 'free'
                            CHECK (plan_type IN ('free','basic','professional','enterprise')),
  plan_expires_at         TIMESTAMPTZ,
  tier_expires_at         TIMESTAMPTZ,
  rating                  NUMERIC(3,2) DEFAULT 0,
  score                   NUMERIC(4,2) NOT NULL DEFAULT 0,
  total_orders            INTEGER DEFAULT 0,
  total_revenue           NUMERIC(14,2) DEFAULT 0,
  total_transactions      INTEGER NOT NULL DEFAULT 0,
  response_rate           NUMERIC(5,2) DEFAULT 0,
  on_time_delivery_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,
  on_time_delivery        NUMERIC(5,2) DEFAULT 0,
  quality_score           NUMERIC(4,2) NOT NULL DEFAULT 0,
  badges                  JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active               BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id             ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_verification_status ON suppliers(verification_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_tier                ON suppliers(tier);
CREATE INDEX IF NOT EXISTS idx_suppliers_plan_type           ON suppliers(plan_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_country             ON suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_rating              ON suppliers(rating);
CREATE INDEX IF NOT EXISTS idx_suppliers_search              ON suppliers
  USING GIN (to_tsvector('english', company_name || ' ' || COALESCE(description, '')));

-- ── Supplier Products ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  name             TEXT,
  description      TEXT,
  category         TEXT,
  images           JSONB DEFAULT '[]',
  unit_price       NUMERIC(12,2),
  bulk_price_tiers JSONB DEFAULT '[]',
  moq              INTEGER DEFAULT 1,
  unit             TEXT DEFAULT 'piece',
  specifications   JSONB DEFAULT '{}',
  certifications   TEXT[] DEFAULT '{}',
  stock_quantity   INTEGER,
  lead_time_days   INTEGER,
  is_active        BOOLEAN DEFAULT TRUE,
  is_featured      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);

-- ── Supplier Documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_status      ON supplier_documents(status);

-- ── Supplier Reviews ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id          UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  buyer_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id             UUID REFERENCES orders(id),
  rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                TEXT,
  comment              TEXT,
  quality_rating       INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  shipping_rating      INTEGER CHECK (shipping_rating BETWEEN 1 AND 5),
  photos               JSONB DEFAULT '[]',
  is_verified          BOOLEAN DEFAULT FALSE,
  helpful_count        INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_reviews_supplier ON supplier_reviews(supplier_id);

-- ── Supplier Assessments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_assessments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  assessed_by         UUID REFERENCES auth.users(id),
  assessment_type     TEXT DEFAULT 'periodic',
  quality_score       NUMERIC(5,2),
  delivery_score      NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  compliance_score    NUMERIC(5,2),
  overall_score       NUMERIC(5,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Wishlists ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT 'My Wishlist',
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_public   BOOLEAN     NOT NULL DEFAULT FALSE,
  share_token TEXT        UNIQUE,
  items       JSONB       NOT NULL DEFAULT '[]'::JSONB,
  product_id  UUID        REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user_id     ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_share_token ON wishlists(share_token);

-- ── Warehouses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  location   TEXT,
  country    TEXT,
  city       TEXT,
  address    TEXT,
  capacity   INTEGER,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_country ON warehouses(country);

-- ── Warehouse Inventory ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL DEFAULT 0,
  min_stock    INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product   ON warehouse_inventory(product_id);

-- ── Carrier Earnings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_earnings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  delivery_id      UUID REFERENCES carry_deliveries(id),
  carry_request_id UUID REFERENCES carry_requests(id),
  gross_amount     NUMERIC(10,2),
  base_amount      NUMERIC(10,2),
  bonus            NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','available','paid','withdrawn')),
  payment_method   TEXT,
  paid_at          TIMESTAMPTZ,
  withdrawn_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_earnings_carrier_id ON carrier_earnings(carrier_id);

-- ── Carrier Payments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id        UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  carry_request_id  UUID REFERENCES carry_requests(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL,
  bonus             NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount        NUMERIC(12,2) GENERATED ALWAYS AS (amount + bonus - platform_fee) STORED,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','processing','paid','failed','cancelled')),
  payment_method    TEXT,
  payment_reference TEXT,
  notes             TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_payments_carrier ON carrier_payments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_payments_status  ON carrier_payments(payment_status);

-- ── Trigger: update supplier rating on new review ──────────────────────────
CREATE OR REPLACE FUNCTION update_supplier_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM supplier_reviews
      WHERE supplier_id = NEW.supplier_id
    )
  WHERE id = NEW.supplier_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_supplier_rating ON supplier_reviews;
CREATE TRIGGER trg_update_supplier_rating
AFTER INSERT OR UPDATE ON supplier_reviews
FOR EACH ROW EXECUTE FUNCTION update_supplier_rating();
