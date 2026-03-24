-- ============================================================
-- Migration: 001_add_missing_tables.sql
-- Purpose  : Ensure all tables required by backend/models/ exist
--            and have the correct columns.
--            Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Extensions (idempotent)
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- 1. USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                TEXT        UNIQUE NOT NULL,
  password_hash        TEXT,
  first_name           TEXT,
  last_name            TEXT,
  phone                TEXT,
  role                 TEXT        NOT NULL DEFAULT 'buyer'
                         CHECK (role IN ('buyer','supplier','carrier','admin')),
  avatar_url           TEXT,
  is_verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_banned            BOOLEAN     NOT NULL DEFAULT FALSE,
  ban_reason           TEXT,
  two_factor_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing from an earlier migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified         BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned           BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled  BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- ──────────────────────────────────────────────────────────────
-- 2. LOGIN HISTORY  (required by User.getLoginHistory)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_history (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address  INET,
  user_agent  TEXT,
  success     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id    ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at);

-- ──────────────────────────────────────────────────────────────
-- 3. CATEGORIES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,
  parent_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,
  description     TEXT,
  image_url       TEXT,
  icon            TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon            TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order      INTEGER      NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_slug      ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- ──────────────────────────────────────────────────────────────
-- 4. PRODUCTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id      UUID          REFERENCES users(id) ON DELETE SET NULL,
  title            TEXT          NOT NULL,
  slug             TEXT          UNIQUE NOT NULL,
  description      TEXT,
  category_id      UUID          REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id   UUID          REFERENCES categories(id) ON DELETE SET NULL,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency         TEXT          NOT NULL DEFAULT 'USD',
  min_order_qty    INTEGER       NOT NULL DEFAULT 1 CHECK (min_order_qty >= 1),
  max_order_qty    INTEGER,
  unit             TEXT          NOT NULL DEFAULT 'piece',
  images           JSONB         NOT NULL DEFAULT '[]'::JSONB,
  specifications   JSONB         NOT NULL DEFAULT '{}'::JSONB,
  status           TEXT          NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','pending','approved','rejected')),
  rejection_reason TEXT,
  is_featured      BOOLEAN       NOT NULL DEFAULT FALSE,
  stock_quantity   INTEGER       NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sku              TEXT          UNIQUE,
  weight           NUMERIC(8,3),
  dimensions       JSONB,
  origin_country   TEXT,
  hs_code          TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS title            TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id   UUID          REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency         TEXT          NOT NULL DEFAULT 'USD';
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_qty    INTEGER       NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_order_qty    INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit             TEXT          NOT NULL DEFAULT 'piece';
ALTER TABLE products ADD COLUMN IF NOT EXISTS images           JSONB         NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications   JSONB         NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_country   TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hs_code          TEXT;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id  ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug         ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status       ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_featured  ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_sku          ON products(sku);

-- ──────────────────────────────────────────────────────────────
-- 5. ORDERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number       TEXT          UNIQUE NOT NULL,
  buyer_id           UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id        UUID          REFERENCES users(id) ON DELETE SET NULL,
  items              JSONB         NOT NULL DEFAULT '[]'::JSONB,
  subtotal           NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax                NUMERIC(14,2) NOT NULL DEFAULT 0,
  total              NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency           TEXT          NOT NULL DEFAULT 'USD',
  status             TEXT          NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','disputed')),
  shipping_address   JSONB,
  billing_address    JSONB,
  payment_method     TEXT,
  payment_status     TEXT          NOT NULL DEFAULT 'unpaid'
                       CHECK (payment_status IN ('unpaid','paid','refunded','partially_refunded')),
  tracking_number    TEXT,
  estimated_delivery DATE,
  notes              TEXT,
  parent_order_id    UUID          REFERENCES orders(id) ON DELETE SET NULL,
  merged_from        JSONB,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number     TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items            JSONB         NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost    NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax              NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency         TEXT          NOT NULL DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address  JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status   TEXT          NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id  UUID          REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_from      JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id      ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id   ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number  ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at);

-- Order timeline events
CREATE TABLE IF NOT EXISTS order_timeline (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL,
  note        TEXT,
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);

-- ──────────────────────────────────────────────────────────────
-- 6. SUPPLIERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID          UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name            TEXT          NOT NULL,
  business_type           TEXT,
  registration_number     TEXT,
  country                 TEXT,
  city                    TEXT,
  address                 TEXT,
  verification_status     TEXT          NOT NULL DEFAULT 'unverified'
                            CHECK (verification_status IN ('unverified','pending','verified','pro')),
  verification_documents  JSONB         NOT NULL DEFAULT '[]'::JSONB,
  plan_type               TEXT          NOT NULL DEFAULT 'free'
                            CHECK (plan_type IN ('free','basic','professional','enterprise')),
  plan_expires_at         TIMESTAMPTZ,
  score                   NUMERIC(4,2)  NOT NULL DEFAULT 0,
  badges                  JSONB         NOT NULL DEFAULT '[]'::JSONB,
  response_rate           NUMERIC(5,2)  NOT NULL DEFAULT 0,
  on_time_delivery_rate   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  quality_score           NUMERIC(4,2)  NOT NULL DEFAULT 0,
  total_transactions      INTEGER       NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verification_status    TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verification_documents JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS plan_type              TEXT NOT NULL DEFAULT 'free';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS plan_expires_at        TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS score                  NUMERIC(4,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS badges                 JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS response_rate          NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS on_time_delivery_rate  NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS quality_score          NUMERIC(4,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS total_transactions     INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id             ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_verification_status ON suppliers(verification_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_plan_type           ON suppliers(plan_type);

-- ──────────────────────────────────────────────────────────────
-- 7. COMMISSIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL,
  type            TEXT          NOT NULL DEFAULT 'flat'
                    CHECK (type IN ('category','tiered','flat')),
  category_id     UUID          REFERENCES categories(id) ON DELETE SET NULL,
  min_order_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_order_value NUMERIC(14,2),
  rate_percent    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  min_cap         NUMERIC(14,2),
  max_cap         NUMERIC(14,2),
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_category_id ON commissions(category_id);
CREATE INDEX IF NOT EXISTS idx_commissions_is_active   ON commissions(is_active);

-- ──────────────────────────────────────────────────────────────
-- 8. SUBSCRIPTION PLANS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT          UNIQUE NOT NULL
                          CHECK (name IN ('basic','professional','enterprise')),
  price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              TEXT          NOT NULL DEFAULT 'USD',
  features              JSONB         NOT NULL DEFAULT '{}'::JSONB,
  max_products          INTEGER,
  max_orders_per_month  INTEGER,
  ai_marketing_budget   NUMERIC(10,2) NOT NULL DEFAULT 0,
  analytics_level       TEXT          NOT NULL DEFAULT 'basic',
  support_level         TEXT          NOT NULL DEFAULT 'email',
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  trial_days            INTEGER       NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_name      ON subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

-- ──────────────────────────────────────────────────────────────
-- 9. INSPECTIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number  TEXT          UNIQUE NOT NULL,
  buyer_id        UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id     UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
  order_id        UUID          REFERENCES orders(id) ON DELETE SET NULL,
  type            TEXT          NOT NULL
                    CHECK (type IN ('pre_shipment','during_production','final_random','container_loading')),
  status          TEXT          NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','scheduled','in_progress','completed','cancelled')),
  inspector_id    UUID          REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date  TIMESTAMPTZ,
  location        TEXT,
  pricing         JSONB,
  rush_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(10,2) NOT NULL DEFAULT 0,
  report          JSONB,
  photos          JSONB         NOT NULL DEFAULT '[]'::JSONB,
  result          TEXT          CHECK (result IN ('pass','fail','conditional')),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS request_number  TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS rush_fee        NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS total_cost      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS pricing         JSONB;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS result         TEXT CHECK (result IN ('pass','fail','conditional'));

CREATE INDEX IF NOT EXISTS idx_inspections_buyer_id     ON inspections(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_supplier_id  ON inspections(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status       ON inspections(status);

-- ──────────────────────────────────────────────────────────────
-- 10. RFQs (Requests for Quotation)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfqs (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number          TEXT          UNIQUE NOT NULL,
  buyer_id            UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title               TEXT          NOT NULL,
  description         TEXT,
  category_id         UUID          REFERENCES categories(id) ON DELETE SET NULL,
  quantity            NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit                TEXT          NOT NULL DEFAULT 'piece',
  target_price        NUMERIC(12,2),
  currency            TEXT          NOT NULL DEFAULT 'USD',
  specifications      JSONB         NOT NULL DEFAULT '{}'::JSONB,
  attachments         JSONB         NOT NULL DEFAULT '[]'::JSONB,
  status              TEXT          NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','closed','awarded')),
  deadline            TIMESTAMPTZ,
  quotations_count    INTEGER       NOT NULL DEFAULT 0,
  awarded_supplier_id UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS rfq_number          TEXT;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS target_price        NUMERIC(12,2);
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS currency            TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS specifications      JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS attachments         JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS deadline            TIMESTAMPTZ;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS quotations_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS awarded_supplier_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id    ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status      ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category_id ON rfqs(category_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_deadline    ON rfqs(deadline);

-- ──────────────────────────────────────────────────────────────
-- 11. QUOTATIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id          UUID          NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id     UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT          NOT NULL DEFAULT 'USD',
  min_order_qty   INTEGER       NOT NULL DEFAULT 1,
  lead_time_days  INTEGER       NOT NULL DEFAULT 0,
  validity_days   INTEGER       NOT NULL DEFAULT 30,
  notes           TEXT,
  attachments     JSONB         NOT NULL DEFAULT '[]'::JSONB,
  status          TEXT          NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','accepted','rejected','withdrawn')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id      ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status      ON quotations(status);

-- ──────────────────────────────────────────────────────────────
-- 12. WISHLISTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT 'My Wishlist',
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_public   BOOLEAN     NOT NULL DEFAULT FALSE,
  share_token TEXT        UNIQUE,
  items       JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user_id     ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_share_token ON wishlists(share_token);

-- ──────────────────────────────────────────────────────────────
-- 13. NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  message    TEXT,
  data       JSONB       NOT NULL DEFAULT '{}'::JSONB,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  channel    TEXT        NOT NULL DEFAULT 'in_app'
               CHECK (channel IN ('in_app','email','sms','push')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data    JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel TEXT  NOT NULL DEFAULT 'in_app';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ──────────────────────────────────────────────────────────────
-- 14. BLOG POSTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title          TEXT        NOT NULL,
  slug           TEXT        UNIQUE NOT NULL,
  content        TEXT,
  excerpt        TEXT,
  featured_image TEXT,
  category       TEXT,
  tags           JSONB       NOT NULL DEFAULT '[]'::JSONB,
  status         TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','archived')),
  published_at   TIMESTAMPTZ,
  views_count    INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id    ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug         ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status       ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category     ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags         ON blog_posts USING gin(tags);

-- ──────────────────────────────────────────────────────────────
-- 15. CARRIER PRODUCTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_products (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT          NOT NULL,
  category             TEXT          NOT NULL,
  rate_per_kg          NUMERIC(10,4) NOT NULL DEFAULT 0,
  min_weight           NUMERIC(8,3),
  max_weight           NUMERIC(8,3),
  bonus_rate           NUMERIC(10,4) NOT NULL DEFAULT 0,
  surge_multiplier     NUMERIC(5,4)  NOT NULL DEFAULT 1,
  platform_fee_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_products_category  ON carrier_products(category);
CREATE INDEX IF NOT EXISTS idx_carrier_products_is_active ON carrier_products(is_active);

-- ──────────────────────────────────────────────────────────────
-- 16. FEATURE TOGGLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_toggles (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key         TEXT        UNIQUE NOT NULL,
  name                TEXT        NOT NULL,
  description         TEXT,
  is_enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
  environment         TEXT        NOT NULL DEFAULT 'production',
  percentage_rollout  INTEGER     NOT NULL DEFAULT 100
                        CHECK (percentage_rollout BETWEEN 0 AND 100),
  allowed_roles       JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_toggles_feature_key  ON feature_toggles(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_is_enabled   ON feature_toggles(is_enabled);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_environment  ON feature_toggles(environment);

-- ──────────────────────────────────────────────────────────────
-- 17. TRADE SHOWS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_shows (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id  UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title         TEXT          NOT NULL,
  description   TEXT,
  start_date    TIMESTAMPTZ   NOT NULL,
  end_date      TIMESTAMPTZ   NOT NULL,
  type          TEXT          NOT NULL DEFAULT 'virtual'
                  CHECK (type IN ('virtual','physical','hybrid')),
  booth_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_booths    INTEGER       NOT NULL DEFAULT 0,
  booths_sold   INTEGER       NOT NULL DEFAULT 0
                  CHECK (booths_sold >= 0),
  status        TEXT          NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','live','ended')),
  banner_image  TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE trade_shows ADD COLUMN IF NOT EXISTS booth_price  NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE trade_shows ADD COLUMN IF NOT EXISTS max_booths   INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE trade_shows ADD COLUMN IF NOT EXISTS booths_sold  INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE trade_shows ADD COLUMN IF NOT EXISTS banner_image TEXT;

CREATE INDEX IF NOT EXISTS idx_trade_shows_organizer_id ON trade_shows(organizer_id);
CREATE INDEX IF NOT EXISTS idx_trade_shows_status       ON trade_shows(status);
CREATE INDEX IF NOT EXISTS idx_trade_shows_start_date   ON trade_shows(start_date);
