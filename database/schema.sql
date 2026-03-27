-- ─────────────────────────────────────────────────────────────────
-- Migration 001: Users & Auth tables
-- ─────────────────────────────────────────────────────────────────

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  avatar_url          TEXT,
  phone               TEXT,
  company_name        TEXT,
  role                TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','buyer','supplier','carrier','inspector')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified')),
  language            TEXT NOT NULL DEFAULT 'en',
  currency            TEXT NOT NULL DEFAULT 'USD',
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON profiles(role);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT DEFAULT 'Home',
  street      TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT,
  country     TEXT NOT NULL,
  postal_code TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Supplier Profiles
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  business_type     TEXT,
  country           TEXT,
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  rating            NUMERIC(3,2) DEFAULT 0,
  response_rate     NUMERIC(5,2) DEFAULT 0,
  on_time_delivery  NUMERIC(5,2) DEFAULT 0,
  membership_tier   TEXT DEFAULT 'basic',
  commission_rate   NUMERIC(5,2) DEFAULT 5.00,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carrier Profiles
CREATE TABLE IF NOT EXISTS carrier_profiles (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passport_number    TEXT,
  passport_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  facial_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  total_trips        INTEGER NOT NULL DEFAULT 0,
  total_earnings     NUMERIC(12,2) NOT NULL DEFAULT 0,
  success_rate       NUMERIC(5,2) DEFAULT 0,
  rating             NUMERIC(3,2) DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─────────────────────────────────────────────────────────────────
-- Migration 002: Products & Categories
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  parent_id  UUID REFERENCES categories(id),
  image_url  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent  ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug    ON categories(slug);

CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  specifications  JSONB,
  images          TEXT[] DEFAULT '{}',
  price           NUMERIC(12,2) NOT NULL,
  moq             INTEGER NOT NULL DEFAULT 1,
  stock           INTEGER NOT NULL DEFAULT 0,
  category_id     UUID REFERENCES categories(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','inactive','pending','banned')),
  featured        BOOLEAN NOT NULL DEFAULT FALSE,
  trending        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_supplier  ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(slug);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE TABLE IF NOT EXISTS product_variants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sku        TEXT,
  price      NUMERIC(12,2),
  stock      INTEGER NOT NULL DEFAULT 0,
  attributes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  images        TEXT[] DEFAULT '{}',
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
-- ─────────────────────────────────────────────────────────────────
-- Migration 003: Orders
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id            UUID NOT NULL REFERENCES auth.users(id),
  supplier_id         UUID REFERENCES supplier_profiles(id),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  subtotal            NUMERIC(12,2) NOT NULL,
  shipping_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL,
  payment_method      TEXT,
  payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  shipping_address_id UUID REFERENCES addresses(id),
  tracking_number     TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id    ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity   INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total      NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
-- ─────────────────────────────────────────────────────────────────
-- Migration 004: Shipments (Carry + Parcel)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id      UUID REFERENCES carrier_profiles(id),
  flight_number   TEXT NOT NULL,
  departure_date  DATE NOT NULL,
  arrival_date    DATE,
  origin          TEXT NOT NULL,
  destination     TEXT NOT NULL,
  weight_capacity NUMERIC(8,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','full','cancelled','completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carry_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id  UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_category  TEXT NOT NULL,
  weight_kg         NUMERIC(8,2) NOT NULL,
  payment_per_kg    NUMERIC(8,2) NOT NULL,
  total_payment     NUMERIC(10,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','received','processing','shipped','in_transit','customs','delivered')),
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
-- ─────────────────────────────────────────────────────────────────
-- Migration 006: Pricing & Commission Settings
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_settings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           TEXT NOT NULL CHECK (type IN ('category','order_value','default')),
  category_id    UUID REFERENCES categories(id),
  min_value      NUMERIC(12,2),
  max_value      NUMERIC(12,2),
  rate_percentage NUMERIC(5,2) NOT NULL DEFAULT 5,
  flat_fee       NUMERIC(8,2) NOT NULL DEFAULT 0,
  min_commission NUMERIC(8,2),
  max_commission NUMERIC(8,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  monthly_fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate      NUMERIC(5,2) NOT NULL DEFAULT 5,
  features             JSONB,
  ai_marketing_budget  NUMERIC(10,2) DEFAULT 0,
  setup_fee            NUMERIC(10,2) DEFAULT 0,
  trial_days           INTEGER DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_pricing (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                TEXT NOT NULL,
  name                TEXT NOT NULL,
  price               NUMERIC(10,2) NOT NULL,
  rush_fee_percentage NUMERIC(5,2) DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dropshipping_markup (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type               TEXT NOT NULL CHECK (type IN ('global','category','price_range')),
  category_id        UUID REFERENCES categories(id),
  min_price          NUMERIC(10,2),
  max_price          NUMERIC(10,2),
  markup_percentage  NUMERIC(5,2) NOT NULL DEFAULT 20,
  min_profit         NUMERIC(8,2) DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_country  TEXT NOT NULL,
  min_weight           NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight           NUMERIC(8,2) NOT NULL DEFAULT 999,
  price_per_kg         NUMERIC(8,2) NOT NULL,
  base_fee             NUMERIC(8,2) NOT NULL DEFAULT 0,
  express_fee          NUMERIC(8,2) DEFAULT 0,
  fragile_fee          NUMERIC(8,2) DEFAULT 0,
  insurance_percentage NUMERIC(5,2) DEFAULT 1,
  estimated_days_min   INTEGER DEFAULT 7,
  estimated_days_max   INTEGER DEFAULT 14,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS carry_rates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_category  TEXT NOT NULL,
  name              TEXT,
  payment_per_kg    NUMERIC(8,2) NOT NULL,
  fragile_surcharge NUMERIC(8,2) DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS api_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  monthly_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_limit        INTEGER NOT NULL DEFAULT 1000,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  features             JSONB,
  commission_rate      NUMERIC(5,2) DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS advertising_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             TEXT NOT NULL,
  name             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  duration_options JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);
-- ─────────────────────────────────────────────────────────────────
-- Migration 007: Messaging & Notifications
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids  UUID[] NOT NULL,
  type             TEXT NOT NULL DEFAULT 'buyer_supplier' CHECK (type IN ('buyer_supplier','support')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING gin(participant_ids);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  content         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','file','voice')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
-- ─────────────────────────────────────────────────────────────────
-- Migration 008: CMS (Pages, Banners, Blog, FAQs, Email Templates)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  content    TEXT,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link       TEXT,
  position   TEXT,
  start_date TIMESTAMPTZ,
  end_date   TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content        TEXT,
  author_id      UUID REFERENCES auth.users(id),
  category       TEXT,
  tags           TEXT[] DEFAULT '{}',
  featured_image TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug   ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

CREATE TABLE IF NOT EXISTS email_templates (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT UNIQUE NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS faqs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS site_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  type       TEXT DEFAULT 'text',
  category   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Livestreams
CREATE TABLE IF NOT EXISTS livestreams (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID REFERENCES supplier_profiles(id),
  title        TEXT NOT NULL,
  description  TEXT,
  thumbnail    TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─────────────────────────────────────────────────────────────────
-- Migration 009: API Platform (API Keys, Logs, Webhooks)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key       TEXT UNIQUE NOT NULL,
  plan_id       UUID REFERENCES api_plans(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  requests_used INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user   ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key    ON api_keys(api_key);

CREATE TABLE IF NOT EXISTS api_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  method        TEXT NOT NULL,
  status_code   INTEGER,
  response_time INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_key  ON api_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_date ON api_logs(created_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  secret     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
-- ─────────────────────────────────────────────────────────────────
-- Migration 011: Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks          ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access (used by backend)
CREATE POLICY "Service role bypass profiles"
  ON profiles USING (auth.role() = 'service_role');

-- ─── addresses ───────────────────────────────────────────────────
CREATE POLICY "Users manage own addresses"
  ON addresses USING (auth.uid() = user_id);

-- ─── products (public read) ──────────────────────────────────────
CREATE POLICY "Public can view active products"
  ON products FOR SELECT USING (status = 'active');

CREATE POLICY "Suppliers manage own products"
  ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── wishlists ───────────────────────────────────────────────────
CREATE POLICY "Users manage own wishlists"
  ON wishlists USING (auth.uid() = user_id);

-- ─── orders ──────────────────────────────────────────────────────
CREATE POLICY "Buyers see own orders"
  ON orders FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Suppliers see their orders"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── transactions ────────────────────────────────────────────────
CREATE POLICY "Users see own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

-- ─── notifications ───────────────────────────────────────────────
CREATE POLICY "Users manage own notifications"
  ON notifications USING (auth.uid() = user_id);

-- ─── parcels ─────────────────────────────────────────────────────
CREATE POLICY "Senders see own parcels"
  ON parcels USING (auth.uid() = sender_id);

-- ─── rfqs ────────────────────────────────────────────────────────
CREATE POLICY "Buyers manage own RFQs"
  ON rfqs USING (auth.uid() = buyer_id);

CREATE POLICY "Suppliers view open RFQs"
  ON rfqs FOR SELECT USING (status = 'open');

-- ─── api_keys ────────────────────────────────────────────────────
CREATE POLICY "Users manage own API keys"
  ON api_keys USING (auth.uid() = user_id);

-- ─── webhooks ────────────────────────────────────────────────────
CREATE POLICY "Users manage own webhooks"
  ON webhooks USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Migration 012: Dispute & Return/Refund System
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('item_not_received','item_not_as_described','damaged','wrong_item','other')),
  reason      TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','escalated','resolved','closed')),
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dispute_id   UUID REFERENCES disputes(id) ON DELETE SET NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_disputes_user_id    ON disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id   ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id    ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status      ON refunds(status);

-- ─── RLS ──────────────────────────────────────────────────────────
ALTER TABLE disputes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers manage own disputes"
  ON disputes USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all disputes"
  ON disputes USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Dispute participants can view messages"
  ON dispute_messages FOR SELECT USING (
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM disputes d WHERE d.id = dispute_id AND d.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Dispute participants can insert messages"
  ON dispute_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM disputes d WHERE d.id = dispute_id AND d.user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY "Buyers see own refunds"
  ON refunds FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  );

CREATE POLICY "Admins manage all refunds"
  ON refunds USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ─── Platform Settings (API Key / Service Configuration) ──────────────────────
-- Stores API keys and service config managed from the Admin Panel.
-- Supports Test/Live mode per service category.

CREATE TABLE IF NOT EXISTS platform_settings (
  id            SERIAL PRIMARY KEY,
  category      VARCHAR(50)  NOT NULL,
  setting_key   VARCHAR(100) NOT NULL,
  setting_value TEXT,
  mode          VARCHAR(10)  DEFAULT 'test'
                             CHECK (mode IN ('test', 'live')),
  is_active     BOOLEAN      DEFAULT TRUE,
  is_sensitive  BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(category, setting_key, mode)
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_mode     ON platform_settings(mode);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key      ON platform_settings(setting_key);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read settings"   ON platform_settings;
DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;

CREATE POLICY "Only admins can read settings"
  ON platform_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can modify settings"
  ON platform_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ─── Newsletter Subscribers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode      VARCHAR(128) NOT NULL UNIQUE,
  barcode_type VARCHAR(30)  NOT NULL DEFAULT 'EAN-13',
  product_id   UUID         REFERENCES products(id) ON DELETE SET NULL,
  name         VARCHAR(255),
  description  TEXT,
  metadata     JSONB        DEFAULT '{}',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_barcode_products_barcode     ON barcode_products(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_products_product_id  ON barcode_products(product_id);

-- ─── Admin Custom Styles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_custom_styles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           UUID        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reviewer_id           UUID        REFERENCES profiles(user_id) ON DELETE SET NULL,
  quality_score         NUMERIC(3,1) NOT NULL CHECK (quality_score BETWEEN 0 AND 5),
  delivery_score        NUMERIC(3,1) NOT NULL CHECK (delivery_score BETWEEN 0 AND 5),
  communication_score   NUMERIC(3,1) NOT NULL CHECK (communication_score BETWEEN 0 AND 5),
  price_score           NUMERIC(3,1) NOT NULL CHECK (price_score BETWEEN 0 AND 5),
  overall_score         NUMERIC(3,1) NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
  review_text           TEXT,
  order_id              UUID         REFERENCES orders(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_supplier_id ON supplier_scores(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_reviewer_id ON supplier_scores(reviewer_id);

-- ─── Supplier Badges ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_badges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
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
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  contract_type    VARCHAR(20)  NOT NULL CHECK (contract_type IN ('forward', 'option', 'swap')),
  base_currency    CHAR(3)      NOT NULL,
  quote_currency   CHAR(3)      NOT NULL,
  notional_amount  NUMERIC(18,4) NOT NULL,
  contract_rate    NUMERIC(18,6) NOT NULL,
  spot_rate        NUMERIC(18,6),
  settlement_date  DATE         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'active', 'closed', 'expired', 'cancelled')),
  hedging_ratio    NUMERIC(5,4) DEFAULT 1.0,
  pnl              NUMERIC(18,4),
  metadata         JSONB        DEFAULT '{}',
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_user_id    ON currency_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_status     ON currency_contracts(status);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_settlement ON currency_contracts(settlement_date);

-- ─── Containers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS containers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number   VARCHAR(20)  NOT NULL UNIQUE,
  type               VARCHAR(30)  NOT NULL,
  size               VARCHAR(10)  NOT NULL,
  status             VARCHAR(30)  NOT NULL DEFAULT 'booked',
  origin_port        VARCHAR(100) NOT NULL,
  destination_port   VARCHAR(100) NOT NULL,
  carrier            VARCHAR(100),
  vessel_name        VARCHAR(100),
  voyage_number      VARCHAR(50),
  eta                TIMESTAMPTZ,
  etd                TIMESTAMPTZ,
  current_location   VARCHAR(200),
  booking_reference  VARCHAR(50),
  supplier_id        UUID         REFERENCES suppliers(id) ON DELETE SET NULL,
  buyer_id           UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  metadata           JSONB        DEFAULT '{}',
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_containers_container_number ON containers(container_number);
CREATE INDEX IF NOT EXISTS idx_containers_status           ON containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_booking_ref      ON containers(booking_reference);

-- ─── Freight Bookings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freight_bookings (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference   VARCHAR(50)  NOT NULL UNIQUE,
  shipper_id          UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  consignee_id        UUID         REFERENCES profiles(user_id) ON DELETE SET NULL,
  freight_type        VARCHAR(10)  NOT NULL CHECK (freight_type IN ('FCL', 'LCL', 'AIR', 'RAIL')),
  container_id        UUID         REFERENCES containers(id) ON DELETE SET NULL,
  origin              VARCHAR(200) NOT NULL,
  destination         VARCHAR(200) NOT NULL,
  cargo_description   TEXT         NOT NULL,
  weight_kg           NUMERIC(10,2),
  volume_cbm          NUMERIC(10,3),
  incoterms           VARCHAR(10),
  estimated_cost      NUMERIC(12,2),
  actual_cost         NUMERIC(12,2),
  status              VARCHAR(30)  NOT NULL DEFAULT 'pending',
  pickup_date         DATE,
  delivery_date       DATE,
  tracking_events     JSONB        DEFAULT '[]',
  metadata            JSONB        DEFAULT '{}',
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_shipper_id        ON freight_bookings(shipper_id);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_status            ON freight_bookings(status);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_booking_reference ON freight_bookings(booking_reference);
