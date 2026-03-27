-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Complete Database Schema
-- All tables required for the full platform. Run via:
--   cd backend && npm run migrate
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────
-- CORE: Users & Auth
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('buyer','supplier','carrier','admin','inspector')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','suspended','banned','pending_verification')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  language      TEXT NOT NULL DEFAULT 'en',
  currency      TEXT NOT NULL DEFAULT 'USD',
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name       TEXT,
  company_type       TEXT,
  country            TEXT,
  city               TEXT,
  address            TEXT,
  website            TEXT,
  description        TEXT,
  verified           BOOLEAN NOT NULL DEFAULT FALSE,
  verification_level TEXT NOT NULL DEFAULT 'none'
                       CHECK (verification_level IN ('none','basic','advanced','premium')),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id   ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token     ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires   ON user_sessions(expires_at);

-- ─────────────────────────────────────────────────────────────────
-- PRODUCTS & CATEGORIES
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  image_url   TEXT,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  description    TEXT,
  specifications JSONB DEFAULT '{}',
  images         JSONB DEFAULT '[]',
  base_price     NUMERIC(14,4) NOT NULL CHECK (base_price >= 0),
  currency       TEXT NOT NULL DEFAULT 'USD',
  moq            INTEGER NOT NULL DEFAULT 1,
  stock          INTEGER NOT NULL DEFAULT 0,
  lead_time      INTEGER DEFAULT 7,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending','active','rejected','banned')),
  featured       BOOLEAN NOT NULL DEFAULT FALSE,
  trending       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_supplier  ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured  ON products(featured) WHERE featured = TRUE;

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sku        TEXT UNIQUE,
  price      NUMERIC(14,4) NOT NULL CHECK (price >= 0),
  stock      INTEGER NOT NULL DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         TEXT,
  comment       TEXT,
  images        JSONB DEFAULT '[]',
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published'
                  CHECK (status IN ('published','hidden','pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user    ON product_reviews(user_id);

-- ─────────────────────────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number     TEXT UNIQUE NOT NULL,
  buyer_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','processing','shipped',
                                       'delivered','cancelled','refunded','disputed')),
  subtotal         NUMERIC(14,4) NOT NULL DEFAULT 0,
  shipping_cost    NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax              NUMERIC(14,4) NOT NULL DEFAULT 0,
  discount         NUMERIC(14,4) NOT NULL DEFAULT 0,
  total            NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'USD',
  shipping_address JSONB DEFAULT '{}',
  billing_address  JSONB DEFAULT '{}',
  payment_method   TEXT,
  payment_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','failed','refunded','partial')),
  tracking_number  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer    ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number   ON orders(order_number);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(14,4) NOT NULL,
  total_price NUMERIC(14,4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);

-- ─────────────────────────────────────────────────────────────────
-- SHIPMENT / CARRY
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_number    TEXT,
  departure_city   TEXT NOT NULL,
  arrival_city     TEXT NOT NULL,
  departure_date   DATE NOT NULL,
  arrival_date     DATE NOT NULL,
  available_weight NUMERIC(8,2) NOT NULL CHECK (available_weight > 0),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','full','cancelled','completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier ON carry_requests(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_status  ON carry_requests(status);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_category TEXT,
  weight           NUMERIC(8,2) NOT NULL CHECK (weight > 0),
  payment_per_kg   NUMERIC(10,4) NOT NULL,
  total_payment    NUMERIC(14,4) NOT NULL,
  pickup_status    TEXT NOT NULL DEFAULT 'pending'
                     CHECK (pickup_status IN ('pending','picked_up','failed')),
  delivery_status  TEXT NOT NULL DEFAULT 'pending'
                     CHECK (delivery_status IN ('pending','delivered','failed')),
  qr_code          TEXT,
  delivery_proof   JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request ON carry_deliveries(carry_request_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parcel_shipments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_number TEXT UNIQUE NOT NULL,
  sender_address   JSONB DEFAULT '{}',
  receiver_address JSONB DEFAULT '{}',
  package_details  JSONB DEFAULT '{}',
  weight           NUMERIC(8,2) NOT NULL CHECK (weight > 0),
  dimensions       JSONB DEFAULT '{}',
  declared_value   NUMERIC(14,4),
  shipping_method  TEXT,
  carrier_name     TEXT,
  tracking_number  TEXT,
  status           TEXT NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created','pickup_scheduled','in_transit',
                                       'out_for_delivery','delivered','failed','returned')),
  pricing          JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_shipments_sender    ON parcel_shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_reference ON parcel_shipments(reference_number);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipping_rates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_country TEXT NOT NULL,
  min_weight          NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight          NUMERIC(8,2) NOT NULL DEFAULT 999999,
  price_per_kg        NUMERIC(10,4) NOT NULL,
  base_fee            NUMERIC(10,4) NOT NULL DEFAULT 0,
  express_surcharge   NUMERIC(10,4) NOT NULL DEFAULT 0,
  economy_discount    NUMERIC(5,4)  NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_country ON shipping_rates(destination_country);

-- ─────────────────────────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id               UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type                   TEXT NOT NULL CHECK (type IN ('payment','refund','payout','adjustment')),
  amount                 NUMERIC(14,4) NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'USD',
  payment_method         TEXT,
  payment_gateway        TEXT,
  gateway_transaction_id TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','completed','failed','refunded','cancelled')),
  metadata               JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order   ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  supplier_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_amount      NUMERIC(14,4) NOT NULL,
  commission_rate   NUMERIC(5,4) NOT NULL,
  commission_amount NUMERIC(14,4) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_records_supplier ON commission_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_order    ON commission_records(order_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_payouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount         NUMERIC(14,4) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','completed','failed')),
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payouts_supplier ON supplier_payouts(supplier_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carrier_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  delivery_id  UUID REFERENCES carry_deliveries(id) ON DELETE SET NULL,
  amount       NUMERIC(14,4) NOT NULL,
  bonus        NUMERIC(14,4) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(14,4) NOT NULL DEFAULT 0,
  net_amount   NUMERIC(14,4) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_payments_carrier  ON carrier_payments(carrier_id);

-- ─────────────────────────────────────────────────────────────────
-- COMMUNICATION
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids  JSONB NOT NULL DEFAULT '[]',
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text','image','file','system')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  data       JSONB DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read    ON notifications(read_at) WHERE read_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- SUPPLIER PLANS & SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT UNIQUE NOT NULL,
  monthly_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate     NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  features            JSONB DEFAULT '{}',
  ai_marketing_budget NUMERIC(10,2) NOT NULL DEFAULT 0,
  setup_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id     UUID NOT NULL REFERENCES supplier_plans(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','cancelled','expired','paused')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_supplier ON supplier_subscriptions(supplier_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL CHECK (type IN ('category','order_value','global')),
  reference_id    UUID,
  commission_rate NUMERIC(5,4) NOT NULL,
  min_commission  NUMERIC(10,4),
  max_commission  NUMERIC(10,4),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────
-- QUALITY INSPECTION
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspection_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','scheduled','in_progress','completed','cancelled')),
  scheduled_date DATE,
  inspector_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  price          NUMERIC(10,2),
  report         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_requests_buyer    ON inspection_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_supplier ON inspection_requests(supplier_id);

-- ─────────────────────────────────────────────────────────────────
-- MARKETING
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  discount_type  TEXT CHECK (discount_type IN ('percentage','fixed','free_shipping')),
  discount_value NUMERIC(10,4),
  start_date     TIMESTAMPTZ,
  end_date       TIMESTAMPTZ,
  products       JSONB DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','paused','ended')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advertisements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('featured','banner','sponsored')),
  position    TEXT,
  price       NUMERIC(10,2),
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ,
  content     JSONB DEFAULT '{}',
  clicks      INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','paused','ended','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_supplier ON advertisements(supplier_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percentage','fixed','free_shipping')),
  value      NUMERIC(10,4) NOT NULL,
  min_order  NUMERIC(14,4),
  max_uses   INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────
-- RFQ (Request for Quotation)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfq_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  specifications JSONB DEFAULT '{}',
  attachments    JSONB DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','closed','awarded','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer ON rfq_requests(buyer_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfq_quotations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id      UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price       NUMERIC(14,4),
  moq         INTEGER,
  lead_time   INTEGER,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','rejected','countered')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_quotations_rfq      ON rfq_quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotations_supplier ON rfq_quotations(supplier_id);

-- ─────────────────────────────────────────────────────────────────
-- WISHLIST & CART
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Wishlist',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wishlist_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items(wishlist_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cart_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- ─────────────────────────────────────────────────────────────────
-- API PLATFORM
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  api_key          TEXT UNIQUE NOT NULL,
  plan             TEXT NOT NULL DEFAULT 'free'
                     CHECK (plan IN ('free','basic','pro','enterprise')),
  requests_count   BIGINT NOT NULL DEFAULT 0,
  requests_limit   INTEGER NOT NULL DEFAULT 1000,
  webhook_urls     JSONB DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','suspended','revoked')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_clients_user ON api_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_api_clients_key  ON api_clients(api_key);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID REFERENCES api_clients(id) ON DELETE SET NULL,
  endpoint      TEXT NOT NULL,
  method        TEXT NOT NULL,
  status_code   SMALLINT,
  response_time INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_client  ON api_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);

-- ─────────────────────────────────────────────────────────────────
-- LOYALTY
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earned','redeemed','expired','adjusted')),
  description TEXT,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT UNIQUE NOT NULL,
  min_points INTEGER NOT NULL,
  benefits   JSONB DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────
-- LIVE STREAMING
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_streams (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','live','ended','cancelled')),
  scheduled_at   TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  viewer_count   INTEGER NOT NULL DEFAULT 0,
  recording_url  TEXT,
  price          NUMERIC(10,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_supplier ON live_streams(supplier_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status   ON live_streams(status);

-- ─────────────────────────────────────────────────────────────────
-- TRADE SHOWS
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_shows (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'virtual' CHECK (type IN ('virtual','physical','hybrid')),
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming','active','ended','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_show_booths (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id     UUID NOT NULL REFERENCES trade_shows(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','premium','platinum')),
  price       NUMERIC(10,2),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_show_booths_show     ON trade_show_booths(show_id);
CREATE INDEX IF NOT EXISTS idx_trade_show_booths_supplier ON trade_show_booths(supplier_id);

-- ─────────────────────────────────────────────────────────────────
-- SYSTEM
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  group      TEXT NOT NULL DEFAULT 'general',
  type       TEXT NOT NULL DEFAULT 'string'
               CHECK (type IN ('string','number','boolean','json')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key   ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_group ON settings(group);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS languages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  native_name TEXT NOT NULL,
  direction   TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS currencies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  exchange_rate NUMERIC(14,6) NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject     TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','urgent')),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  content          TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published','archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  content      TEXT,
  excerpt      TEXT,
  cover_image  TEXT,
  category     TEXT,
  tags         JSONB DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug   ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- ─────────────────────────────────────────────────────────────────
-- UPDATED-AT TRIGGERS
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_profiles','orders','settings',
    'support_tickets','pages','cart_items'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;
