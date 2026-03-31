-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Master Database Migration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Click "+ New"
--   3. Copy-paste this ENTIRE file
--   4. Click "Run"
--   5. Done! All tables will be created.
--
-- SAFE TO RUN MULTIPLE TIMES — uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTENSIONS ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. CORE USER TABLES ──
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

-- ── 2b. CREATE_USERS (additional) ──
-- Migration 001: Users, User Profiles, and User Sessions
-- ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT,
  name           TEXT NOT NULL,
  phone          TEXT,
  avatar_url     TEXT,
  role           TEXT NOT NULL DEFAULT 'buyer'
                   CHECK (role IN ('buyer', 'supplier', 'admin', 'support')),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- User Profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio                       TEXT,
  address                   TEXT,
  city                      TEXT,
  country                   TEXT,
  timezone                  TEXT DEFAULT 'UTC',
  language_preference       TEXT DEFAULT 'en',
  notification_preferences  JSONB DEFAULT '{"email":true,"sms":false,"push":true}'::JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- User Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  device_info JSONB,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ── 3. CATEGORIES & PRODUCTS ──
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

-- ── 3b. CREATE_PRODUCTS ──
-- Migration 002: Products, Categories, Product Images, and Attributes
-- ─────────────────────────────────────────────────────────────────────

-- Categories table (self-referencing for hierarchy)
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url   TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug      ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  short_description TEXT,
  sku               TEXT UNIQUE,
  price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  sale_price        NUMERIC(12,2) CHECK (sale_price >= 0),
  cost_price        NUMERIC(12,2) CHECK (cost_price >= 0),
  stock_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  weight            NUMERIC(8,3),
  dimensions        JSONB,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_supplier_id  ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug         ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status       ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_featured  ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_fts          ON products
  USING gin(to_tsvector('english', name || ' ' || COALESCE(short_description, '') || ' ' || COALESCE(description, '')));

-- Product Images table
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt_text   TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_is_primary ON product_images(product_id, is_primary);

-- Product Attributes table
CREATE TABLE IF NOT EXISTS product_attributes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product_id ON product_attributes(product_id);

-- ── 4. SUPPLIER TABLES ──
-- Supplier Management & Verification Database Schema
-- Migration: supplier.sql

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Company Info
  company_name TEXT NOT NULL,
  business_type TEXT CHECK (business_type IN ('manufacturer','trading','manufacturer_trading','wholesaler','agent')),
  established_year INTEGER,
  description TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  -- Business Details
  employees TEXT,
  annual_revenue TEXT,
  production_capacity TEXT,
  export_markets TEXT,
  oem_odm TEXT,
  main_categories TEXT[] DEFAULT '{}',
  -- Documents
  business_license_url TEXT,
  registration_cert_url TEXT,
  certifications JSONB DEFAULT '[]',
  factory_photos JSONB DEFAULT '[]',
  -- Verification
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','under_review','verified','rejected','suspended')),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Membership
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free','basic','gold','platinum','diamond')),
  tier_expires_at TIMESTAMPTZ,
  -- Performance
  rating NUMERIC(3,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(14,2) DEFAULT 0,
  response_rate NUMERIC(5,2) DEFAULT 0,
  on_time_delivery_rate NUMERIC(5,2) DEFAULT 0,
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Supplier Products (extends products with supplier-specific fields)
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  -- Product fields (if not linked to existing product)
  name TEXT,
  description TEXT,
  category TEXT,
  images JSONB DEFAULT '[]',
  -- Pricing
  unit_price NUMERIC(12,2),
  bulk_price_tiers JSONB DEFAULT '[]', -- [{min_qty: 100, price: 8.50}, ...]
  moq INTEGER DEFAULT 1,
  unit TEXT DEFAULT 'piece',
  -- Specifications
  specifications JSONB DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  -- Availability
  stock_quantity INTEGER,
  lead_time_days INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Reviews
CREATE TABLE IF NOT EXISTS supplier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  shipping_rating INTEGER CHECK (shipping_rating BETWEEN 1 AND 5),
  photos JSONB DEFAULT '[]',
  is_verified BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Assessment / Scorecard
CREATE TABLE IF NOT EXISTS supplier_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  assessment_type TEXT DEFAULT 'periodic',
  quality_score NUMERIC(5,2),
  delivery_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  compliance_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_verification ON suppliers(verification_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_tier ON suppliers(tier);
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(rating);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_reviews_supplier ON supplier_reviews(supplier_id);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers
  USING GIN (to_tsvector('english', company_name || ' ' || COALESCE(description, '')));

-- Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_reviews ENABLE ROW LEVEL SECURITY;

-- Suppliers manage own profile
DROP POLICY IF EXISTS suppliers_own ON suppliers;
CREATE POLICY suppliers_own ON suppliers
  FOR ALL USING (user_id = auth.uid());

-- Verified suppliers are public
DROP POLICY IF EXISTS suppliers_public_verified ON suppliers;
CREATE POLICY suppliers_public_verified ON suppliers
  FOR SELECT USING (verification_status = 'verified' AND is_active = TRUE);

-- Suppliers manage own products
DROP POLICY IF EXISTS supplier_products_own ON supplier_products;
CREATE POLICY supplier_products_own ON supplier_products
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
  );

-- Active supplier products are public
DROP POLICY IF EXISTS supplier_products_public ON supplier_products;
CREATE POLICY supplier_products_public ON supplier_products
  FOR SELECT USING (is_active = TRUE);

-- Reviews are public readable
DROP POLICY IF EXISTS supplier_reviews_public ON supplier_reviews;
CREATE POLICY supplier_reviews_public ON supplier_reviews
  FOR SELECT USING (TRUE);

-- Buyers write own reviews
DROP POLICY IF EXISTS supplier_reviews_buyer_write ON supplier_reviews;
CREATE POLICY supplier_reviews_buyer_write ON supplier_reviews
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Function to update supplier rating after new review
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

CREATE TRIGGER trg_update_supplier_rating
AFTER INSERT OR UPDATE ON supplier_reviews
FOR EACH ROW EXECUTE FUNCTION update_supplier_rating();

-- ── 4b. CREATE_SUPPLIERS ──
-- Migration 008: Suppliers and Supplier Documents
-- ──────────────────────────────────────────────────

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name       TEXT NOT NULL,
  business_type       TEXT,
  registration_number TEXT,
  tax_id              TEXT,
  address             JSONB,
  bank_details        JSONB,
  commission_rate     NUMERIC(5,2) NOT NULL DEFAULT 5.00
                        CHECK (commission_rate BETWEEN 0 AND 100),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status  ON suppliers(status);

-- Supplier Documents table
CREATE TABLE IF NOT EXISTS supplier_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_status      ON supplier_documents(status);

-- ── 5. ORDERS ──
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

-- ── 5b. CREATE_ORDERS ──
-- Migration 003: Orders, Order Items, and Order Status History
-- ─────────────────────────────────────────────────────────────

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped',
                                       'delivered', 'cancelled', 'refunded', 'disputed')),
  total_amount     NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  payment_method   TEXT,
  payment_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  shipping_address JSONB,
  billing_address  JSONB,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id      ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id   ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  variant_id  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Order Status History table
CREATE TABLE IF NOT EXISTS order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  notes      TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id  ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

-- ── 5c. ORDERS extended ──
-- Enhanced Orders Migration
-- Adds order_number, billing_address, shipping_method, coupon tracking,
-- and order_timeline table

-- Extend orders table with new columns (safe to run on existing table)
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS order_number     VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_address_id UUID REFERENCES addresses(id),
  ADD COLUMN IF NOT EXISTS tax              NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS carrier          VARCHAR(100);

-- order_timeline: status history for each order
CREATE TABLE IF NOT EXISTS order_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(50) NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);

-- Row Level Security
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers can view their own order timeline" ON order_timeline;
CREATE POLICY "buyers can view their own order timeline"
  ON order_timeline FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

DROP POLICY IF EXISTS "admins can manage order timeline" ON order_timeline;
CREATE POLICY "admins can manage order timeline"
  ON order_timeline FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));


-- ── 6. SHIPMENTS ──
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

-- ── 6b. CREATE_SHIPMENTS ──
-- Migration 005: Shipments and Shipment Events
-- ──────────────────────────────────────────────

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  carrier            TEXT,
  tracking_number    TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery',
                                         'delivered', 'failed', 'returned')),
  estimated_delivery DATE,
  shipped_at         TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  shipping_address   JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id        ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status          ON shipments(status);

-- Shipment Events table
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

-- ── 7. PAYMENTS ──
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

-- ── 7b. CREATE_PAYMENTS ──
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

-- ── 7c. PAYMENTS extended ──
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

-- ── 8. PRICING ──
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

-- ── 8b. PRICING extended ──
-- ─────────────────────────────────────────────────────────────────
-- Migration: Pricing & Commission Management Tables
-- commission_settings, supplier_plans, inspection_pricing,
-- dropshipping_markup, carry_service_rates, parcel_pricing,
-- api_pricing_tiers
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commission_settings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           TEXT NOT NULL CHECK (type IN ('supplier','buyer','dropshipping','api','carry','parcel')),
  category       TEXT DEFAULT 'all',
  min_value      NUMERIC(12,2) DEFAULT 0,
  max_value      NUMERIC(12,2),
  rate           NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  min_commission NUMERIC(10,2) DEFAULT 0,
  max_commission NUMERIC(10,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  monthly_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  features        JSONB DEFAULT '[]',
  setup_fee       NUMERIC(10,2) DEFAULT 0,
  ai_budget       NUMERIC(10,2) DEFAULT 0,
  trial_days      INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  rush_fee_percent NUMERIC(5,2) DEFAULT 0,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dropshipping_markup (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category       TEXT NOT NULL DEFAULT 'all',
  min_price      NUMERIC(12,2) DEFAULT 0,
  max_price      NUMERIC(12,2),
  markup_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
  min_profit     NUMERIC(10,2) DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carry_service_rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     TEXT NOT NULL,
  subcategory  TEXT,
  rate_per_kg  NUMERIC(10,2) NOT NULL,
  min_charge   NUMERIC(10,2) DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_pricing (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country          TEXT NOT NULL DEFAULT 'all',
  min_weight       NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight       NUMERIC(8,2),
  rate_per_kg      NUMERIC(10,2) NOT NULL,
  base_fee         NUMERIC(10,2) DEFAULT 0,
  express_fee      NUMERIC(10,2) DEFAULT 0,
  economy_discount NUMERIC(5,2) DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_pricing_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  monthly_cost    NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_limit   INTEGER,
  rate_limit      INTEGER,
  features        JSONB DEFAULT '[]',
  commission_rate NUMERIC(5,4) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default supplier plans
INSERT INTO supplier_plans (name, monthly_fee, commission_rate, features, setup_fee, ai_budget, trial_days, sort_order)
VALUES
  ('Starter',     0,      0.08, '["10 products","Basic analytics","Standard support"]',       0,    0,    0,  1),
  ('Professional',49.99,  0.05, '["Unlimited products","Advanced analytics","Priority support","Verified badge"]', 9.99, 0, 14, 2),
  ('Enterprise',  199.99, 0.03, '["Unlimited products","AI recommendations","Dedicated manager","Custom integrations","AI ad budget $500/mo"]', 0, 500, 30, 3)
ON CONFLICT DO NOTHING;

-- Default commission settings
INSERT INTO commission_settings (type, category, min_value, rate, min_commission)
VALUES
  ('supplier', 'all',         0,    0.05, 1.00),
  ('supplier', 'electronics', 0,    0.04, 1.00),
  ('supplier', 'apparel',     0,    0.07, 0.50),
  ('dropshipping', 'all',     0,    0.03, 0.50),
  ('api',      'all',         0,    0.02, 0.00),
  ('carry',    'all',         0,    0.10, 2.00),
  ('parcel',   'all',         0,    0.08, 1.00)
ON CONFLICT DO NOTHING;

-- ── 9. CART ──
-- Shopping Cart Migration
-- Creates carts, cart_items, and coupons tables

CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES profiles(id),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  saved_for_later BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,
  discount_type  VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage','fixed')) DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order      NUMERIC(12,2),
  max_discount   NUMERIC(12,2),
  valid_from     TIMESTAMPTZ,
  valid_to       TIMESTAMPTZ,
  usage_limit    INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- Trigger: keep carts.updated_at in sync
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_cart_timestamp();

-- Row Level Security
ALTER TABLE carts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage their own cart" ON carts;
CREATE POLICY "users can manage their own cart"
  ON carts FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can manage their own cart items" ON cart_items;
CREATE POLICY "users can manage their own cart items"
  ON cart_items FOR ALL
  USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "coupons are readable by authenticated users" ON coupons;
CREATE POLICY "coupons are readable by authenticated users"
  ON coupons FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "only admins can manage coupons" ON coupons;
CREATE POLICY "only admins can manage coupons"
  ON coupons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── 10. RFQ ──
-- RFQ (Request for Quotation) System Database Schema
-- Migration: rfq.sql

-- RFQs
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  source_country TEXT,
  -- Quantity & Pricing
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT 'pieces',
  target_price NUMERIC(12,2),
  total_budget NUMERIC(12,2),
  -- Specifications
  specifications TEXT,
  sample_required TEXT DEFAULT 'no' CHECK (sample_required IN ('no','yes_free','yes_paid')),
  packaging TEXT,
  certifications TEXT[] DEFAULT '{}',
  required_delivery_date DATE,
  -- Deadline
  deadline DATE NOT NULL,
  -- Attachments
  attachments JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  remarks TEXT,
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','open','closed','awarded','cancelled')),
  -- Counters
  quotation_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotations (responses from suppliers)
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pricing
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2),
  moq INTEGER NOT NULL DEFAULT 1,
  -- Details
  lead_time INTEGER NOT NULL,
  -- ^ lead_time is in days (e.g. 25 = 25 days from order confirmation to shipment)
  payment_terms TEXT,
  sample TEXT DEFAULT 'no',
  custom_logo TEXT DEFAULT 'no',
  certifications TEXT[] DEFAULT '{}',
  warranty TEXT,
  shipping_methods TEXT[] DEFAULT '{}',
  notes TEXT NOT NULL,
  -- Attachments
  attachments JSONB DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected','negotiating')),
  -- Negotiation
  counter_price NUMERIC(12,2),
  counter_message TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

-- RFQ Messages (buyer-supplier negotiation)
CREATE TABLE IF NOT EXISTS rfq_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update quotation count
CREATE OR REPLACE FUNCTION update_rfq_quotation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rfqs SET quotation_count = quotation_count + 1 WHERE id = NEW.rfq_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rfqs SET quotation_count = GREATEST(0, quotation_count - 1) WHERE id = OLD.rfq_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rfq_quotation_count
AFTER INSERT OR DELETE ON quotations
FOR EACH ROW EXECUTE FUNCTION update_rfq_quotation_count();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category ON rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_deadline ON rfqs(deadline);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_rfq_id ON rfq_messages(rfq_id);

-- Row Level Security
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_messages ENABLE ROW LEVEL SECURITY;

-- Buyers manage own RFQs
DROP POLICY IF EXISTS rfqs_buyer_own ON rfqs;
CREATE POLICY rfqs_buyer_own ON rfqs
  FOR ALL USING (buyer_id = auth.uid());

-- Open RFQs visible to suppliers
DROP POLICY IF EXISTS rfqs_public_open ON rfqs;
CREATE POLICY rfqs_public_open ON rfqs
  FOR SELECT USING (status = 'open');

-- Suppliers manage own quotations
DROP POLICY IF EXISTS quotations_supplier_own ON quotations;
CREATE POLICY quotations_supplier_own ON quotations
  FOR ALL USING (supplier_id = auth.uid());

-- Buyer can see quotations on own RFQs
DROP POLICY IF EXISTS quotations_buyer_see ON quotations;
CREATE POLICY quotations_buyer_see ON quotations
  FOR SELECT USING (
    rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = auth.uid())
  );

-- Messages visible to participants
DROP POLICY IF EXISTS rfq_messages_visible ON rfq_messages;
CREATE POLICY rfq_messages_visible ON rfq_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = auth.uid()) OR
    quotation_id IN (SELECT id FROM quotations WHERE supplier_id = auth.uid())
  );

-- ── 11. MESSAGING / CHAT ──
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

-- ── 11b. CHAT extended ──
-- ============================================================
-- Migration: Chat & Messaging Tables
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids UUID[] NOT NULL,
  type            TEXT NOT NULL DEFAULT 'buyer_supplier'
                    CHECK (type IN ('buyer_supplier', 'support', 'group')),
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON conversations USING gin(participant_ids);

-- ── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  content         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'text'
                    CHECK (type IN ('text', 'image', 'file', 'voice')),
  file_url        TEXT,
  attachments     TEXT[] DEFAULT '{}',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  translated_content TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created      ON messages(created_at DESC);

-- ── 12. CMS ──
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

-- ── 12b. CMS extended ──
-- CMS Migration
-- Creates tables for static pages, banners, and blog posts.

-- ─── Pages ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  content          TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pages_slug_idx        ON pages (slug);
CREATE INDEX IF NOT EXISTS pages_published_idx   ON pages (is_published);

-- Seed default static pages
INSERT INTO pages (slug, title, content, is_published) VALUES
  ('home',          'Homepage',        '',   true),
  ('about',         'About Us',        '',   true),
  ('contact',       'Contact Us',      '',   true),
  ('privacy',       'Privacy Policy',  '',   true),
  ('terms',         'Terms of Service','',   true),
  ('faq',           'FAQ',             '',   true)
ON CONFLICT (slug) DO NOTHING;

-- ─── Banners ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link       TEXT,
  position   TEXT DEFAULT 'hero',   -- hero | sidebar | footer | popup
  start_date DATE,
  end_date   DATE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS banners_position_idx  ON banners (position);
CREATE INDEX IF NOT EXISTS banners_active_idx    ON banners (is_active);

-- ─── Blog Posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content        TEXT,
  author_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category       TEXT,
  tags           TEXT[],
  featured_image TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',   -- draft | published | scheduled | archived
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx      ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx    ON blog_posts (status);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx  ON blog_posts (category);
CREATE INDEX IF NOT EXISTS blog_posts_author_idx    ON blog_posts (author_id);

-- ─── Categories (products) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_slug_idx      ON categories (slug);
CREATE INDEX IF NOT EXISTS categories_active_idx    ON categories (is_active);

-- Seed default categories
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Electronics',        'electronics',        1),
  ('Clothing & Fashion', 'clothing-fashion',   2),
  ('Home & Garden',      'home-garden',        3),
  ('Industrial',         'industrial',         4),
  ('Food & Agriculture', 'food-agriculture',   5),
  ('Health & Beauty',    'health-beauty',      6),
  ('Toys & Sports',      'toys-sports',        7),
  ('Automotive',         'automotive',         8)
ON CONFLICT (slug) DO NOTHING;

-- ── 13. NOTIFICATIONS ──
-- ============================================================
-- Migration: Notifications Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info'
               CHECK (type IN ('info','success','warning','error','order','payment','shipment','message','promotion','system')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ── Notification Preferences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  order_updates   BOOLEAN NOT NULL DEFAULT TRUE,
  messages        BOOLEAN NOT NULL DEFAULT TRUE,
  promotions      BOOLEAN NOT NULL DEFAULT TRUE,
  system_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 13b. CREATE_NOTIFICATIONS ──
-- Migration 009: Notifications and Push Subscriptions
-- ──────────────────────────────────────────────────────

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type      ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Push Subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ── 14. REVIEWS ──
-- ============================================================
-- Migration: Reviews & Ratings Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id             UUID REFERENCES orders(id),
  rating               SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                TEXT,
  content              TEXT,
  photos               TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count        INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'published'
                         CHECK (status IN ('published', 'hidden', 'flagged')),
  seller_response      TEXT,
  seller_response_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating  ON reviews(product_id, rating);

-- ── Review Votes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);

-- ── Review Reports ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- ── 14b. CREATE_REVIEWS ──
-- Migration 006: Reviews and Review Images
-- ──────────────────────────────────────────

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating               SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                TEXT,
  body                 TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count        INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id   ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating     ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status     ON reviews(status);

-- Review Images table
CREATE TABLE IF NOT EXISTS review_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);

-- ── 15. REPORTS ──
-- ─────────────────────────────────────────────────────────────────
-- Migration: Financial Reports Tables
-- transactions, payouts, admin_settings
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('payment','refund','payout','commission','subscription','adjustment')),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL,
  fee         NUMERIC(10,2) DEFAULT 0,
  net_amount  NUMERIC(12,2),
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','cancelled')),
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order   ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT NOT NULL DEFAULT 'bank_transfer',
  type         TEXT NOT NULL DEFAULT 'supplier' CHECK (type IN ('supplier','carrier','affiliate')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  notes        TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_user    ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status  ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_type    ON payouts(type);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- Admin key-value settings store
CREATE TABLE IF NOT EXISTS admin_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default payout schedule setting
INSERT INTO admin_settings (key, value)
VALUES ('payout_schedule', '{"frequency":"weekly","day_of_week":5,"min_amount":50,"auto_process":false}')
ON CONFLICT (key) DO NOTHING;

-- ── 16. INSPECTIONS ──
-- Quality Inspection System Database Schema
-- Migration: inspections.sql

-- Inspectors
CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT NOT NULL,
  country TEXT,
  specializations TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0,
  total_inspections INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Requests
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  inspector_id UUID REFERENCES inspectors(id),
  -- Type
  type TEXT NOT NULL CHECK (type IN ('pre_production','during_production','pre_shipment','full_audit')),
  -- Factory / Supplier Info
  supplier_name TEXT NOT NULL,
  factory_address TEXT NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  -- Product Info
  product_name TEXT NOT NULL,
  product_category TEXT,
  quantity INTEGER,
  product_details TEXT,
  specifications TEXT,
  -- Scheduling
  preferred_date DATE,
  scheduled_date DATE,
  -- Pricing
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','payment_pending','scheduled','in_progress','completed','cancelled'
  )),
  -- Attachments
  attachments JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Reports
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE UNIQUE,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass','fail','conditional_pass')),
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  -- Findings
  units_sampled INTEGER,
  units_passed INTEGER,
  defect_rate NUMERIC(5,2),
  findings JSONB DEFAULT '[]',
  -- Media
  photos JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  -- Recommendations
  recommendations TEXT,
  inspector_notes TEXT,
  -- Report metadata
  report_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Timeline Events
CREATE TABLE IF NOT EXISTS inspection_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  description TEXT,
  photos JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Pricing Configuration
CREATE TABLE IF NOT EXISTS inspection_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  report_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inspections_buyer_id ON inspections(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspection ON inspection_reports(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_timeline_inspection ON inspection_timeline(inspection_id);

-- Row Level Security
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;

-- Buyers can see own inspections
DROP POLICY IF EXISTS inspections_buyer_own ON inspections;
CREATE POLICY inspections_buyer_own ON inspections
  FOR ALL USING (buyer_id = auth.uid());

-- Reports visible to buyer
DROP POLICY IF EXISTS inspection_reports_readable ON inspection_reports;
CREATE POLICY inspection_reports_readable ON inspection_reports
  FOR SELECT USING (
    inspection_id IN (SELECT id FROM inspections WHERE buyer_id = auth.uid())
  );

-- Seed inspection pricing
INSERT INTO inspection_pricing (type, price, duration_days, report_hours) VALUES
  ('pre_production', 199.00, 1, 24),
  ('during_production', 249.00, 2, 24),
  ('pre_shipment', 179.00, 1, 12),
  ('full_audit', 499.00, 3, 48)
ON CONFLICT (type) DO NOTHING;

-- Seed sample inspectors
INSERT INTO inspectors (name, location, country, specializations, rating, total_inspections) VALUES
  ('Zhang Wei', 'Shenzhen, Guangdong', 'CN', ARRAY['Electronics','Machinery'], 4.9, 148),
  ('Li Ming', 'Shanghai', 'CN', ARRAY['Clothing','Textiles','Accessories'], 4.8, 112),
  ('Wang Fang', 'Guangzhou', 'CN', ARRAY['Electronics','Consumer Goods'], 4.7, 89),
  ('Chen Jing', 'Yiwu', 'CN', ARRAY['Toys','Accessories','General Merchandise'], 4.6, 76),
  ('Ravi Kumar', 'Mumbai', 'IN', ARRAY['Textiles','Garments','Handicrafts'], 4.8, 94)
ON CONFLICT DO NOTHING;

-- ── 17. MEETINGS ──
-- ============================================================
-- Migration: Video Meetings Table
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id  UUID REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  meeting_url     TEXT,
  room_code       TEXT UNIQUE,
  notes           TEXT,
  invitees        UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_organizer    ON meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_participant  ON meetings(participant_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled    ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status       ON meetings(status);

-- ── 18. ADMIN ──
-- Admin Panel Migration
-- Creates tables for settings, admin roles, admin users, activity logs, and backups.

-- ─── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  group       TEXT NOT NULL DEFAULT 'general',
  type        TEXT NOT NULL DEFAULT 'string',  -- string | number | boolean | json
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settings_group_idx ON settings (group);

-- ─── Admin Roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Seed default roles
INSERT INTO admin_roles (name, permissions) VALUES
  ('super_admin',       '["*"]'),
  ('admin',             '["users.read","users.write","products.read","products.write","orders.read","orders.write","settings.read","settings.write"]'),
  ('marketing_manager', '["campaigns.read","campaigns.write","products.read","banners.read","banners.write","blog.read","blog.write"]'),
  ('support_agent',     '["users.read","orders.read","disputes.read","disputes.write","refunds.read","refunds.write"]'),
  ('inspector',         '["inspections.read","inspections.write","products.read","suppliers.read"]'),
  ('finance_manager',   '["transactions.read","refunds.read","refunds.write","reports.read"]')
ON CONFLICT (name) DO NOTHING;

-- ─── Admin Users (role assignments) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_users_role_id_idx ON admin_users (role_id);

-- ─── Admin Activity Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_activity_logs_admin_id_idx    ON admin_activity_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_activity_logs_resource_idx    ON admin_activity_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx  ON admin_activity_logs (created_at DESC);

-- ─── Backups ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename   TEXT NOT NULL,
  size       BIGINT NOT NULL DEFAULT 0,
  type       TEXT NOT NULL DEFAULT 'full',   -- full | incremental | schema
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | restoring
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backups_status_idx     ON backups (status);
CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups (created_at DESC);

-- ─── Seed default settings ────────────────────────────────────────────────────
INSERT INTO settings (key, value, group, type) VALUES
  -- General
  ('general.site_name',        'Globex Sky',              'general', 'string'),
  ('general.site_description', 'B2B/B2C Marketplace',     'general', 'string'),
  ('general.contact_email',    'support@globexsky.com',   'general', 'string'),
  ('general.contact_phone',    '',                        'general', 'string'),
  ('general.timezone',         'UTC',                     'general', 'string'),
  ('general.maintenance_mode', 'false',                   'general', 'boolean'),
  -- Security
  ('security.admin_2fa',       'false',   'security', 'boolean'),
  ('security.session_timeout', '3600',    'security', 'number'),
  ('security.captcha_enabled', 'false',   'security', 'boolean'),
  -- Feature toggles
  ('feature.user_registration', 'true',  'features', 'boolean'),
  ('feature.guest_checkout',    'true',  'features', 'boolean'),
  ('feature.reviews',           'true',  'features', 'boolean'),
  ('feature.wishlists',         'true',  'features', 'boolean'),
  ('feature.promotions',        'true',  'features', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- ── 19. CAMPAIGNS ──
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

-- ── 20. CARRY SERVICE ──
-- Carry Service Database Schema
-- Migration: carry.sql

-- Carrier Profiles
CREATE TABLE IF NOT EXISTS carrier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passport_url TEXT,
  id_doc_url TEXT,
  selfie_url TEXT,
  facial_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  rating NUMERIC(3,2) DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  total_earnings NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Carry Rates (per kg payment to carriers)
CREATE TABLE IF NOT EXISTS carry_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  payment_per_kg NUMERIC(8,2) NOT NULL,
  max_weight_kg NUMERIC(8,2),
  platform_fee_percent NUMERIC(5,2) DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Requests (trips offered by carriers)
CREATE TABLE IF NOT EXISTS carry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  flight_ticket_url TEXT,
  flight_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  arrival_date DATE,
  weight_capacity NUMERIC(8,2) NOT NULL,
  available_weight NUMERIC(8,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','full','in_transit','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Items (products assigned to a carry request)
CREATE TABLE IF NOT EXISTS carry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC(8,2) NOT NULL,
  payment_amount NUMERIC(10,2) NOT NULL,
  buyer_id UUID REFERENCES auth.users(id),
  booked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Deliveries
CREATE TABLE IF NOT EXISTS carry_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_phone TEXT,
  qr_code TEXT,
  delivery_receipt_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','collected','in_transit','delivered','failed')),
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carrier Earnings
CREATE TABLE IF NOT EXISTS carrier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES carry_deliveries(id),
  gross_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','paid')),
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON carrier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier_id ON carry_requests(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_status ON carry_requests(status);
CREATE INDEX IF NOT EXISTS idx_carry_items_request_id ON carry_items(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request_id ON carry_deliveries(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carrier_earnings_carrier_id ON carrier_earnings(carrier_id);

-- Row Level Security
ALTER TABLE carrier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_earnings ENABLE ROW LEVEL SECURITY;

-- Carrier can see own profile
DROP POLICY IF EXISTS carrier_own_profile ON carrier_profiles;
CREATE POLICY carrier_own_profile ON carrier_profiles
  FOR ALL USING (user_id = auth.uid());

-- Carriers can manage own requests
DROP POLICY IF EXISTS carrier_own_requests ON carry_requests;
CREATE POLICY carrier_own_requests ON carry_requests
  FOR ALL USING (
    carrier_id IN (SELECT id FROM carrier_profiles WHERE user_id = auth.uid())
  );

-- Carriers see own earnings
DROP POLICY IF EXISTS carrier_own_earnings ON carrier_earnings;
CREATE POLICY carrier_own_earnings ON carrier_earnings
  FOR SELECT USING (
    carrier_id IN (SELECT id FROM carrier_profiles WHERE user_id = auth.uid())
  );

-- Initial carry rates seed data
INSERT INTO carry_rates (product_category, payment_per_kg, max_weight_kg, platform_fee_percent) VALUES
  ('Electronics (Phones/Tablets)', 8.00, 5.00, 10),
  ('Clothing & Accessories', 5.00, 10.00, 10),
  ('Documents & Papers', 3.00, 1.00, 8),
  ('Cosmetics & Skincare', 6.00, 3.00, 10),
  ('Medicines & Supplements', 7.00, 2.00, 12),
  ('Jewelry & Accessories', 10.00, 1.00, 15),
  ('Books & Stationery', 3.50, 5.00, 8),
  ('Food & Snacks (sealed)', 4.00, 5.00, 10)
ON CONFLICT DO NOTHING;

-- ── 21. PARCEL ──
-- Parcel Service Database Schema
-- Migration: parcel.sql

-- Shipping Destinations (pricing per country)
CREATE TABLE IF NOT EXISTS shipping_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  min_weight_kg NUMERIC(8,2) DEFAULT 0.1,
  max_weight_kg NUMERIC(8,2) DEFAULT 30,
  base_fee NUMERIC(10,2) NOT NULL DEFAULT 10,
  rate_per_kg NUMERIC(10,2) NOT NULL DEFAULT 10,
  express_surcharge NUMERIC(10,2) DEFAULT 15,
  economy_discount_percent NUMERIC(5,2) DEFAULT 10,
  estimated_days_standard TEXT DEFAULT '7-14',
  estimated_days_express TEXT DEFAULT '3-5',
  is_restricted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code)
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  -- Destination
  destination_country TEXT NOT NULL,
  destination_country_code TEXT,
  destination_address TEXT NOT NULL,
  destination_city TEXT,
  destination_postal_code TEXT,
  -- Receiver
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT,
  receiver_email TEXT,
  -- Package Details
  package_type TEXT DEFAULT 'parcel' CHECK (package_type IN ('parcel','document','fragile','liquid')),
  weight_kg NUMERIC(8,2) NOT NULL,
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  declared_value NUMERIC(12,2),
  declared_contents TEXT,
  special_handling JSONB DEFAULT '[]',
  -- Shipping
  shipping_method TEXT DEFAULT 'standard' CHECK (shipping_method IN ('standard','express','economy')),
  carrier TEXT,
  tracking_number TEXT,
  -- Pricing
  base_fee NUMERIC(10,2) DEFAULT 0,
  weight_fee NUMERIC(10,2) DEFAULT 0,
  special_handling_fee NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','payment_pending','payment_confirmed',
    'received_at_warehouse','processing','customs_clearance',
    'in_transit','out_for_delivery','delivered','returned','cancelled'
  )),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- Sender info
  sender_courier TEXT,
  sender_tracking_no TEXT,
  courier_receipt_url TEXT,
  dispatched_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Shipment Timeline / Tracking Events
CREATE TABLE IF NOT EXISTS shipment_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT NOT NULL,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_reference ON shipments(reference_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment ON shipment_timeline(shipment_id);

-- Row Level Security
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_timeline ENABLE ROW LEVEL SECURITY;

-- Users can see own shipments
DROP POLICY IF EXISTS shipments_own ON shipments;
CREATE POLICY shipments_own ON shipments
  FOR ALL USING (user_id = auth.uid());

-- Timeline is readable by shipment owner
DROP POLICY IF EXISTS shipment_timeline_readable ON shipment_timeline;
CREATE POLICY shipment_timeline_readable ON shipment_timeline
  FOR SELECT USING (
    shipment_id IN (SELECT id FROM shipments WHERE user_id = auth.uid())
  );

-- Function to generate reference number
CREATE OR REPLACE FUNCTION generate_shipment_reference()
RETURNS TEXT AS $$
DECLARE
  ref TEXT;
BEGIN
  ref := 'GS-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('shipment_ref_seq')::TEXT, 5, '0');
  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Sequence for reference numbers
CREATE SEQUENCE IF NOT EXISTS shipment_ref_seq START 1;

-- Seed shipping destinations
INSERT INTO shipping_destinations (country, country_code, base_fee, rate_per_kg, express_surcharge, economy_discount_percent, estimated_days_standard, estimated_days_express) VALUES
  ('United Kingdom', 'GB', 10.00, 12.00, 15.00, 10, '7-10', '3-5'),
  ('United States', 'US', 12.00, 14.00, 20.00, 8, '8-12', '4-6'),
  ('Australia', 'AU', 15.00, 16.00, 25.00, 12, '10-14', '5-7'),
  ('United Arab Emirates', 'AE', 8.00, 10.00, 12.00, 5, '5-7', '2-3'),
  ('Canada', 'CA', 12.00, 13.00, 18.00, 8, '8-12', '4-6'),
  ('Germany', 'DE', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('France', 'FR', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('Malaysia', 'MY', 6.00, 8.00, 10.00, 5, '4-7', '2-3'),
  ('Singapore', 'SG', 6.00, 8.00, 10.00, 5, '3-5', '1-2'),
  ('Saudi Arabia', 'SA', 9.00, 11.00, 14.00, 6, '5-8', '2-4'),
  ('Qatar', 'QA', 9.00, 11.00, 14.00, 6, '5-7', '2-3'),
  ('Italy', 'IT', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('Japan', 'JP', 13.00, 14.00, 18.00, 8, '7-10', '3-5'),
  ('South Korea', 'KR', 11.00, 12.00, 16.00, 8, '6-9', '3-4'),
  ('Netherlands', 'NL', 11.00, 13.00, 16.00, 10, '7-10', '3-5')
ON CONFLICT (country_code) DO NOTHING;

-- ── 22. API PLATFORM ──
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

-- ── 23. ANALYTICS ──
-- Migration 010: Analytics — Product Views, Search Logs, and Feature Toggles
-- ─────────────────────────────────────────────────────────────────────────────

-- Product Views table
CREATE TABLE IF NOT EXISTS product_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_spent  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_user_id    ON product_views(user_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at  ON product_views(viewed_at DESC);

-- Search Logs table
CREATE TABLE IF NOT EXISTS search_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  query              TEXT NOT NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  searched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id    ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_searched_at ON search_logs(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_query       ON search_logs USING gin(to_tsvector('english', query));

-- Feature Toggles table
CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  conditions   JSONB,
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_toggles_feature_name ON feature_toggles(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_is_enabled   ON feature_toggles(is_enabled);

-- ── 24. PLATFORM SETTINGS ──
-- ============================================================
-- Migration: 004_platform_settings.sql
-- Purpose  : Create the platform_settings table for storing
--            API keys and service configuration managed from
--            the Admin Panel with Test/Live mode support.
--            Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id            SERIAL PRIMARY KEY,
  category      VARCHAR(50)  NOT NULL,        -- e.g. 'supabase', 'stripe', 'openai', 'agora', 'smtp', 'bkash', 'nagad', 'general'
  setting_key   VARCHAR(100) NOT NULL,         -- e.g. 'SUPABASE_URL', 'STRIPE_SECRET_KEY'
  setting_value TEXT,                           -- the actual value (encrypted for secrets)
  mode          VARCHAR(10)  DEFAULT 'test'
                             CHECK (mode IN ('test', 'live')),
  is_active     BOOLEAN      DEFAULT TRUE,
  is_sensitive  BOOLEAN      DEFAULT FALSE,    -- if true, value is AES-256-CBC encrypted
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(category, setting_key, mode)
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION platform_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION platform_settings_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_mode     ON platform_settings(mode);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key      ON platform_settings(setting_key);

-- Row-Level Security (Supabase)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read settings"   ON platform_settings;
DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;

DROP POLICY IF EXISTS "Only admins can read settings" ON platform_settings;
CREATE POLICY "Only admins can read settings"
  ON platform_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;
CREATE POLICY "Only admins can modify settings"
  ON platform_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ── 24b. ADD PLATFORM SETTINGS ──
-- Migration: add_platform_settings
-- Creates the platform_settings table for storing API keys and service
-- configuration managed through the Admin Panel UI.

CREATE TABLE IF NOT EXISTS platform_settings (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  category     TEXT        NOT NULL,                         -- 'stripe','paypal','bkash','nagad','supabase','openai','agora','smtp','general'
  setting_key  TEXT        NOT NULL,                         -- e.g. 'STRIPE_SECRET_KEY'
  setting_value TEXT,                                        -- AES-encrypted for sensitive values
  mode         TEXT        DEFAULT 'test'
                           CHECK (mode IN ('test', 'live')),
  is_active    BOOLEAN     DEFAULT TRUE,
  is_sensitive BOOLEAN     DEFAULT FALSE,                    -- TRUE = value is encrypted
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, setting_key, mode)
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION platform_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION platform_settings_updated_at();

-- Row-Level Security
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read settings"   ON platform_settings;
DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;

DROP POLICY IF EXISTS "Only admins can read settings" ON platform_settings;
CREATE POLICY "Only admins can read settings"
  ON platform_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;
CREATE POLICY "Only admins can modify settings"
  ON platform_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ── 25. PROMOTIONS ──
-- Migration 007: Promotions — Coupons, Flash Sales, and Campaigns
-- ─────────────────────────────────────────────────────────────────

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value      NUMERIC(12,2) NOT NULL CHECK (value > 0),
  min_order  NUMERIC(12,2) DEFAULT 0,
  max_uses   INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code      ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);

-- Flash Sales table
CREATE TABLE IF NOT EXISTS flash_sales (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_price NUMERIC(12,2) NOT NULL CHECK (original_price > 0),
  sale_price     NUMERIC(12,2) NOT NULL CHECK (sale_price > 0),
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  max_quantity   INTEGER,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flash_sales_price_check CHECK (sale_price < original_price),
  CONSTRAINT flash_sales_time_check  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_product_id ON flash_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_start_time ON flash_sales(start_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_end_time   ON flash_sales(end_time);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  conditions JSONB,
  rewards    JSONB,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaigns_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_is_active  ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date   ON campaigns(end_date);

-- ── 26. DYNAMIC FEATURES ──
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

-- ── 27. SUPPLIER SCORECARD ──
-- Migration 019: Supplier Scorecard & Badge Catalog tables
-- Creates supplier_scorecards (aggregate per-supplier scorecard) and badge_catalog (available badge types).

-- ─── Supplier Scorecards ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_scorecards (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           UUID         NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  quality_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  delivery_score        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (delivery_score BETWEEN 0 AND 100),
  communication_score   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (communication_score BETWEEN 0 AND 100),
  pricing_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pricing_score BETWEEN 0 AND 100),
  badges                JSONB        NOT NULL DEFAULT '[]',
  review_count          INTEGER      NOT NULL DEFAULT 0,
  last_evaluated_at     TIMESTAMPTZ  DEFAULT NOW(),
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_supplier_id ON supplier_scorecards(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_overall     ON supplier_scorecards(overall_score DESC);

-- ─── Badge Catalog ────────────────────────────────────────────────────────────
-- Stores the definition/catalog of available badges (not per-supplier awards).
CREATE TABLE IF NOT EXISTS badge_catalog (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT         NOT NULL,
  icon        VARCHAR(100) NOT NULL,
  criteria    JSONB        NOT NULL DEFAULT '{}',
  tier        VARCHAR(20)  NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badge_catalog_tier ON badge_catalog(tier);

-- ─── Seed default badge catalog entries ──────────────────────────────────────
INSERT INTO badge_catalog (name, description, icon, criteria, tier) VALUES
  ('Bronze Supplier',    'Achieved an overall score of 50+',           'fa-medal',         '{"overall_min": 50}',  'bronze'),
  ('Silver Supplier',    'Achieved an overall score of 65+',           'fa-award',         '{"overall_min": 65}',  'silver'),
  ('Gold Supplier',      'Achieved an overall score of 80+',           'fa-star',          '{"overall_min": 80}',  'gold'),
  ('Platinum Supplier',  'Achieved an overall score of 90+',           'fa-crown',         '{"overall_min": 90}',  'platinum'),
  ('Premium Quality',    'Quality score of 90 or above',               'fa-gem',           '{"quality_min": 90}',  'gold'),
  ('Fast Shipper',       'Delivery score of 90 or above',              'fa-shipping-fast', '{"delivery_min": 90}', 'silver'),
  ('Quick Responder',    'Communication score of 90 or above',         'fa-bolt',          '{"communication_min": 90}', 'silver'),
  ('Best Value',         'Pricing score of 90 or above',               'fa-tag',           '{"pricing_min": 90}',  'bronze')
ON CONFLICT DO NOTHING;

-- ── 28. COMPLETE FEATURES & ADMIN CONFIG ──
-- Migration: Complete Features & Admin Configuration
-- Creates the system_configs table for the Admin Configuration Panel.
-- Ensures all tables referenced by the 16 completed features exist.

-- ─── system_configs (Admin Configuration Panel) ─────────────────────────────

CREATE TABLE IF NOT EXISTS system_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key      TEXT NOT NULL UNIQUE,
  config_value    JSONB,
  config_group    TEXT NOT NULL DEFAULT 'general',
  is_secret       BOOLEAN NOT NULL DEFAULT false,
  is_live         BOOLEAN NOT NULL DEFAULT false,
  test_value      TEXT,
  live_value      TEXT,
  last_tested_at  TIMESTAMPTZ,
  test_status     TEXT NOT NULL DEFAULT 'untested'
                    CHECK (test_status IN ('untested', 'success', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_group ON system_configs(config_group);
CREATE INDEX IF NOT EXISTS idx_system_configs_key   ON system_configs(config_key);

-- ─── blog_posts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content         TEXT NOT NULL DEFAULT '',
  excerpt         TEXT,
  featured_image  TEXT,
  category        TEXT,
  tags            JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  published_at    TIMESTAMPTZ,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug     ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status   ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author   ON blog_posts(author_id);

-- Helper RPC for atomic view count increment
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts SET views_count = views_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- ─── templates (shared by email & sms templates) ───────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  category        TEXT,
  subject         TEXT,
  body            TEXT NOT NULL DEFAULT '',
  variables       JSONB DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

CREATE TABLE IF NOT EXISTS template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  subject         TEXT,
  body            TEXT,
  variables       JSONB DEFAULT '[]',
  changed_by      UUID REFERENCES auth.users(id),
  change_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);

-- ─── commissions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT DEFAULT 'percentage',
  category_id     UUID REFERENCES categories(id),
  min_order_value NUMERIC DEFAULT 0,
  max_order_value NUMERIC,
  rate_percent    NUMERIC NOT NULL DEFAULT 0,
  min_cap         NUMERIC,
  max_cap         NUMERIC,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_category ON commissions(category_id);

-- ─── subscription_plans ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL UNIQUE,
  price_monthly         NUMERIC NOT NULL DEFAULT 0,
  price_yearly          NUMERIC,
  currency              TEXT NOT NULL DEFAULT 'USD',
  features              JSONB DEFAULT '[]',
  max_products          INTEGER,
  max_orders_per_month  INTEGER,
  ai_marketing_budget   NUMERIC DEFAULT 0,
  analytics_level       TEXT DEFAULT 'basic',
  support_level         TEXT DEFAULT 'email',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  trial_days            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── saved_searches ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_searches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  query           TEXT NOT NULL,
  filters         JSONB DEFAULT '{}',
  name            TEXT,
  alert_enabled   BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- ─── search_history_items ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  query           TEXT NOT NULL,
  results_count   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history_items(user_id, created_at DESC);

-- Helper RPC for trending searches aggregation
CREATE OR REPLACE FUNCTION get_trending_searches(since_ts TIMESTAMPTZ, result_limit INTEGER)
RETURNS TABLE(query TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT sh.query, COUNT(*) as count
    FROM search_history_items sh
    WHERE sh.created_at >= since_ts
    GROUP BY sh.query
    ORDER BY count DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── gdpr_requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  type            TEXT NOT NULL CHECK (type IN ('export', 'deletion', 'correction')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  data_url        TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);

-- ─── vr_showrooms ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vr_showrooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  model_urls      JSONB DEFAULT '[]',
  thumbnail_url   TEXT,
  product_ids     JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'draft')),
  views           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── meetings ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           UUID NOT NULL REFERENCES auth.users(id),
  participant_ids   JSONB DEFAULT '[]',
  title             TEXT NOT NULL,
  description       TEXT,
  meeting_url       TEXT,
  agora_channel     TEXT,
  status            TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  duration_mins     INTEGER DEFAULT 30,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);

-- ── 29. SOCIAL AUTH ──
-- Social Authentication columns for the profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Unique constraints (allow NULL for users who haven't linked that provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_facebook_id ON profiles(facebook_id) WHERE facebook_id IS NOT NULL;

-- ── 30. ADDRESSES ──
-- Address Book Migration
-- Extends the existing addresses table with full_name, phone, address lines,
-- and separate default shipping/billing flags.

-- Add new columns to existing addresses table (idempotent)
ALTER TABLE IF EXISTS addresses
  ADD COLUMN IF NOT EXISTS full_name           VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone               VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address_line1       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_default_billing  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate existing data: copy street -> address_line1 where address_line1 is null
UPDATE addresses SET address_line1 = street WHERE address_line1 IS NULL AND street IS NOT NULL;
UPDATE addresses SET is_default_shipping = is_default, is_default_billing = is_default WHERE is_default = TRUE;

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION update_address_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_address_timestamp();


-- ── 31. ESCROW ──
-- ─────────────────────────────────────────────────────────────────
-- Escrow Payment System — Database Migration
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── escrow_transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL,
  buyer_id      UUID NOT NULL,
  supplier_id   UUID NOT NULL,
  amount        NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
  status        VARCHAR(20) NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  milestone_id  UUID,
  held_at       TIMESTAMPTZ,
  released_at   TIMESTAMPTZ,
  refunded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_order_id   ON escrow_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer_id   ON escrow_transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_supplier_id ON escrow_transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status     ON escrow_transactions (status);

-- ─── escrow_milestones ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_milestones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id    UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed', 'released')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow_id ON escrow_milestones (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status    ON escrow_milestones (status);

-- ─── escrow_audit_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id  UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  actor_id   UUID NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_escrow_id ON escrow_audit_log (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_actor_id  ON escrow_audit_log (actor_id);

-- ─── escrow_config ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_escrow_config_key ON escrow_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO escrow_config (key, value, description, is_encrypted)
VALUES
  ('escrow_enabled',        'true',   'Enable or disable the escrow system',              FALSE),
  ('hold_period_days',      '7',      'Number of days funds are held in escrow',          FALSE),
  ('platform_fee_percent',  '2.5',    'Platform fee percentage on escrow transactions',   FALSE),
  ('auto_release_enabled',  'true',   'Automatically release funds after hold period',    FALSE),
  ('auto_release_days',     '14',     'Days after which funds are auto-released',         FALSE),
  ('min_escrow_amount',     '10.00',  'Minimum transaction amount for escrow',            FALSE),
  ('payment_gateway',       'stripe', 'Active payment gateway (stripe / paypal)',         FALSE),
  ('gateway_mode',          'test',   'Gateway mode: test or live',                       FALSE),
  ('stripe_public_key',     '',       'Stripe publishable key',                           FALSE),
  ('stripe_secret_key',     '',       'Stripe secret key (encrypted at rest)',            TRUE),
  ('paypal_client_id',      '',       'PayPal client ID',                                 FALSE),
  ('paypal_client_secret',  '',       'PayPal client secret (encrypted at rest)',         TRUE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for escrow_transactions ──────────────────
CREATE OR REPLACE FUNCTION escrow_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_transactions_updated_at ON escrow_transactions;
CREATE TRIGGER trg_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_milestones_updated_at ON escrow_milestones;
CREATE TRIGGER trg_escrow_milestones_updated_at
  BEFORE UPDATE ON escrow_milestones
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_config_updated_at ON escrow_config;
CREATE TRIGGER trg_escrow_config_updated_at
  BEFORE UPDATE ON escrow_config
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

-- ── 32. IMAGE SEARCH ──
-- ─────────────────────────────────────────────────────────────────
-- AI Image Search System — Database Migration
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── image_search_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_history (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID,
  image_url         TEXT,
  search_type       TEXT    NOT NULL DEFAULT 'upload'
                              CHECK (search_type IN ('upload', 'camera', 'url')),
  results           JSONB   NOT NULL DEFAULT '[]',
  provider          TEXT,
  processing_time_ms INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_search_history_user_id    ON image_search_history (user_id);
CREATE INDEX IF NOT EXISTS idx_image_search_history_created_at ON image_search_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_search_history_provider   ON image_search_history (provider);

-- ─── image_search_config ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_config (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_image_search_config_key ON image_search_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO image_search_config (key, value, description, is_encrypted)
VALUES
  ('feature_enabled',        'false',        'Enable or disable AI image search feature',          FALSE),
  ('mode',                   'test',         'Operating mode: test or live',                       FALSE),
  ('primary_provider',       'openai',       'Primary AI provider: openai, google_vision, azure_cv, clarifai', FALSE),
  ('openai_api_key',         '',             'OpenAI API key (encrypted at rest)',                 TRUE),
  ('google_vision_api_key',  '',             'Google Cloud Vision API key (encrypted at rest)',    TRUE),
  ('azure_cv_endpoint',      '',             'Azure Computer Vision endpoint URL',                 FALSE),
  ('azure_cv_api_key',       '',             'Azure Computer Vision API key (encrypted at rest)',  TRUE),
  ('clarifai_api_key',       '',             'Clarifai API key (encrypted at rest)',               TRUE),
  ('max_results',            '20',           'Maximum number of similar products to return',       FALSE),
  ('min_confidence',         '0.7',          'Minimum confidence threshold for results (0–1)',     FALSE),
  ('max_file_size_mb',       '10',           'Maximum image file size in megabytes',               FALSE),
  ('allowed_formats',        'jpg,jpeg,png,webp', 'Comma-separated list of allowed image formats', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for image_search_config ──────────────────
CREATE OR REPLACE FUNCTION image_search_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_image_search_config_updated_at ON image_search_config;
CREATE TRIGGER trg_image_search_config_updated_at
  BEFORE UPDATE ON image_search_config
  FOR EACH ROW EXECUTE FUNCTION image_search_config_set_updated_at();

-- ── 33. CHAT TRANSLATION ──
-- ============================================================================
-- Chat Translation System — Database Migration
-- Tables: chat_translations, translation_cache, translation_config
-- ============================================================================

-- 1. Chat Translations — stores translated messages
CREATE TABLE IF NOT EXISTS chat_translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'google',
  confidence    NUMERIC(5,4) DEFAULT 0.0000,
  cached        BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_translations_message_id ON chat_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_translations_languages ON chat_translations(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_chat_translations_provider ON chat_translations(provider);

-- 2. Translation Cache — hash-based translation caching for performance
CREATE TABLE IF NOT EXISTS translation_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash       TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'google',
  hit_count       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '720 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache(text_hash, source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);

-- 3. Translation Config — admin-managed key-value configuration
CREATE TABLE IF NOT EXISTS translation_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_config_key ON translation_config(key);

-- 4. Default configuration values
INSERT INTO translation_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',         'false',  'Enable/disable chat translation feature', FALSE),
  ('mode',                    'test',   'Operating mode: test or live', FALSE),
  ('primary_provider',        'google', 'Primary translation provider (google, deepl, openai, azure, libre)', FALSE),
  ('google_translate_api_key','',       'Google Cloud Translation API key', TRUE),
  ('deepl_api_key',           '',       'DeepL API key', TRUE),
  ('openai_api_key',          '',       'OpenAI API key for translation', TRUE),
  ('azure_translator_key',    '',       'Azure Cognitive Services Translator key', TRUE),
  ('azure_translator_endpoint','',      'Azure Translator endpoint URL', FALSE),
  ('libre_translate_url',     'https://libretranslate.de', 'LibreTranslate API URL', FALSE),
  ('auto_detect_language',    'true',   'Automatically detect source language', FALSE),
  ('default_target_language',  'en',    'Default target language for translations', FALSE),
  ('cache_enabled',           'true',   'Enable translation caching', FALSE),
  ('cache_ttl_hours',         '720',    'Cache time-to-live in hours', FALSE),
  ('max_text_length',         '5000',   'Maximum text length for translation', FALSE),
  ('supported_languages',     'en,zh,ar,es,fr,de,ja,ko,pt,ru,hi,bn', 'Comma-separated list of supported language codes', FALSE),
  ('fallback_chain',          'google,deepl,openai,azure,libre', 'Provider fallback order', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── 34. PRODUCT COMPARISON ──
-- ============================================================
-- Product Comparison Tool — Database Migration
-- ============================================================

-- Table 1: product_comparisons
-- Stores comparison lists created by users (or guests).
CREATE TABLE IF NOT EXISTS product_comparisons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,   -- nullable for guests
  products     JSONB NOT NULL DEFAULT '[]',                         -- array of product_ids (UUIDs)
  name         TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT FALSE,
  share_token  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_comparisons_user_id      ON product_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_share_token  ON product_comparisons(share_token);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_is_public    ON product_comparisons(is_public);

-- Table 2: comparison_attributes
-- Defines which product attributes are shown per category in the comparison table.
CREATE TABLE IF NOT EXISTS comparison_attributes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID REFERENCES categories(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  attribute_key  TEXT NOT NULL,
  sort_order     INT  NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_attributes_category_id ON comparison_attributes(category_id);
CREATE INDEX IF NOT EXISTS idx_comparison_attributes_is_active   ON comparison_attributes(is_active);

-- Table 3: product_comparison_config
-- Admin-controlled platform settings for the comparison feature.
CREATE TABLE IF NOT EXISTS product_comparison_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_comparison_config_key ON product_comparison_config(key);

-- Seed default config values
INSERT INTO product_comparison_config (key, value, description) VALUES
  ('comparison_enabled',    'true',  'Enable or disable the product comparison feature'),
  ('max_products',          '5',     'Maximum number of products allowed in a single comparison'),
  ('sharing_enabled',       'true',  'Allow users to share comparisons via public link'),
  ('guest_comparison',      'true',  'Allow guests (unauthenticated users) to create comparisons'),
  ('mode',                  'live',  'Platform mode: live | test'),
  ('highlight_differences', 'true',  'Highlight differing attribute values between compared products')
ON CONFLICT (key) DO NOTHING;

-- ── 35. RECOMMENDATIONS ──
-- ─────────────────────────────────────────────────────────────────
-- AI Product Recommendations Engine — Database Migration
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── user_interactions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_interactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  product_id       UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view','click','cart','purchase','wishlist')),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id    ON user_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_product_id ON user_interactions (product_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type       ON user_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions (created_at);

-- ─── product_recommendations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_recommendations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL,
  product_id UUID NOT NULL,
  score      NUMERIC(5,4) NOT NULL DEFAULT 0,
  algorithm  TEXT NOT NULL DEFAULT 'hybrid',
  reason     TEXT,
  is_shown   BOOLEAN NOT NULL DEFAULT FALSE,
  is_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_recs_user_id    ON product_recommendations (user_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_product_id ON product_recommendations (product_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_score      ON product_recommendations (score DESC);
CREATE INDEX IF NOT EXISTS idx_product_recs_expires_at ON product_recommendations (expires_at);

-- ─── recommendation_config ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_recommendation_config_key ON recommendation_config (key);

-- ─── Seed default config values ──────────────────────────────────
INSERT INTO recommendation_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',                    'false',        'Enable or disable the recommendations engine',              FALSE),
  ('mode',                               'test',         'Operating mode: test or live',                              FALSE),
  ('algorithm',                          'hybrid',       'Algorithm: collaborative, content_based, hybrid, ai_powered', FALSE),
  ('ai_provider',                        'openai',       'AI provider: openai, azure, custom',                        FALSE),
  ('ai_api_key',                         '',             'AI provider API key (encrypted at rest)',                   TRUE),
  ('ai_endpoint',                        '',             'Custom AI endpoint URL (for azure or custom provider)',     FALSE),
  ('max_recommendations',                '12',           'Maximum number of recommendations to return per user',      FALSE),
  ('refresh_interval_hours',             '24',           'How often (hours) recommendations are regenerated',         FALSE),
  ('min_interactions_for_personalization','5',           'Minimum interactions needed before personalised recs fire', FALSE),
  ('enable_similar_products',            'true',         'Enable similar products widget',                            FALSE),
  ('enable_frequently_bought_together',  'true',         'Enable frequently bought together widget',                  FALSE),
  ('enable_trending',                    'true',         'Enable trending products widget',                           FALSE)
ON CONFLICT (key) DO NOTHING;

-- ─── updated_at trigger for recommendation_config ────────────────
CREATE OR REPLACE FUNCTION recommendation_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommendation_config_updated_at ON recommendation_config;
CREATE TRIGGER trg_recommendation_config_updated_at
  BEFORE UPDATE ON recommendation_config
  FOR EACH ROW EXECUTE FUNCTION recommendation_config_set_updated_at();

-- ── 36. RFQ MATCHING ──
-- Migration: RFQ Auto-Matching System
-- Tables: rfq_matches, rfq_marketplace, rfq_match_config

-- ─── rfq_matches ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id         UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL,
  match_score    NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_reasons  JSONB DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','notified','viewed','quoted','expired')),
  notified_at    TIMESTAMPTZ,
  viewed_at      TIMESTAMPTZ,
  quoted_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_matches_rfq_id     ON rfq_matches (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_supplier   ON rfq_matches (supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_score      ON rfq_matches (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_status     ON rfq_matches (status);

-- ─── rfq_marketplace ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_marketplace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id        UUID NOT NULL UNIQUE REFERENCES rfqs(id) ON DELETE CASCADE,
  is_public     BOOLEAN NOT NULL DEFAULT TRUE,
  category_id   UUID,
  tags          TEXT[] DEFAULT '{}',
  budget_range  TEXT,
  urgency       TEXT NOT NULL DEFAULT 'medium'
                  CHECK (urgency IN ('low','medium','high','urgent')),
  views_count   INTEGER NOT NULL DEFAULT 0,
  quotes_count  INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_rfq_id    ON rfq_marketplace (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_public    ON rfq_marketplace (is_public);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_category  ON rfq_marketplace (category_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_urgency   ON rfq_marketplace (urgency);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_expires   ON rfq_marketplace (expires_at);

-- ─── rfq_match_config ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_match_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_rfq_match_config_key ON rfq_match_config (key);

-- ─── Default configuration rows ──────────────────────────────────────────────
INSERT INTO rfq_match_config (key, value, description, is_encrypted) VALUES
  ('feature_enabled',        'false',    'Enable or disable the auto-matching feature',      FALSE),
  ('mode',                   'test',     'Operating mode: test or live',                     FALSE),
  ('matching_algorithm',     'weighted', 'Algorithm: weighted, ai_powered, or hybrid',       FALSE),
  ('weight_category_match',  '0.30',     'Score weight for category match (0-1)',             FALSE),
  ('weight_country_match',   '0.15',     'Score weight for country match (0-1)',              FALSE),
  ('weight_price_range',     '0.20',     'Score weight for price range alignment (0-1)',      FALSE),
  ('weight_rating',          '0.15',     'Score weight for supplier rating (0-1)',            FALSE),
  ('weight_response_rate',   '0.10',     'Score weight for supplier response rate (0-1)',     FALSE),
  ('weight_on_time_delivery','0.10',     'Score weight for on-time delivery rate (0-1)',      FALSE),
  ('min_match_score',        '0.5',      'Minimum score threshold to include a match',        FALSE),
  ('max_matches_per_rfq',    '20',       'Maximum supplier matches returned per RFQ',         FALSE),
  ('auto_notify_suppliers',  'true',     'Automatically notify matched suppliers',            FALSE),
  ('ai_provider',            'openai',   'AI provider for ai_powered/hybrid modes',           FALSE),
  ('ai_api_key',             '',         'API key for the AI provider (stored encrypted)',    TRUE),
  ('marketplace_enabled',    'true',     'Enable the public RFQ marketplace',                FALSE),
  ('rfq_expiry_days',        '30',       'Days until an RFQ marketplace listing expires',     FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── 37. OEM / CUSTOMIZATION ──
-- OEM / Product Customization Request System
-- Migration: oem_customization.sql

-- ─── customization_requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id         UUID NOT NULL,
  supplier_id      UUID,
  product_id       UUID,
  title            TEXT NOT NULL,
  description      TEXT,
  specifications   JSONB DEFAULT '{}',
  attachments      TEXT[] DEFAULT '{}',
  quantity         INTEGER,
  target_price     NUMERIC(12,2),
  target_date      DATE,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','quoted','accepted','in_production','completed','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_buyer_id    ON customization_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_cr_supplier_id ON customization_requests (supplier_id);
CREATE INDEX IF NOT EXISTS idx_cr_status      ON customization_requests (status);

-- ─── customization_quotes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL,
  unit_price     NUMERIC(12,2) NOT NULL,
  total_price    NUMERIC(12,2) NOT NULL,
  moq            INTEGER,
  lead_time_days INTEGER,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','expired')),
  valid_until    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cq_request_id  ON customization_quotes (request_id);
CREATE INDEX IF NOT EXISTS idx_cq_supplier_id ON customization_quotes (supplier_id);

-- ─── customization_messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  message     TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_request_id ON customization_messages (request_id);

-- ─── customization_config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- Default config values
INSERT INTO customization_config (key, value, description) VALUES
  ('feature_enabled',               'false', 'Enable or disable the OEM customization feature'),
  ('mode',                          'test',  'Operational mode: test or live'),
  ('max_attachments',               '10',    'Maximum number of file attachments per request'),
  ('max_file_size_mb',              '25',    'Maximum file size in MB per attachment'),
  ('auto_notify_matching_suppliers','true',  'Automatically notify matching suppliers when a request is submitted'),
  ('quote_expiry_days',             '14',    'Number of days until a submitted quote expires'),
  ('max_quotes_per_request',        '10',    'Maximum number of quotes allowed per customization request')
ON CONFLICT (key) DO NOTHING;

-- ── 38. SAMPLE ORDERS ──
-- Migration: Sample Order System
-- Creates tables: sample_orders, sample_order_config

-- ─── sample_orders ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sample_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id           UUID NOT NULL,
  supplier_id        UUID NOT NULL,
  product_id         UUID NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1,
  message            TEXT,
  shipping_address_id UUID,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','shipped','delivered','reviewed')),
  tracking_number    TEXT,
  cost               NUMERIC(10,2) DEFAULT 0,
  is_free            BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_notes     TEXT,
  buyer_feedback     TEXT,
  buyer_rating       SMALLINT CHECK (buyer_rating BETWEEN 1 AND 5),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_orders_buyer_id    ON sample_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_supplier_id ON sample_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_product_id  ON sample_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_status      ON sample_orders (status);

-- ─── sample_order_config ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sample_order_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- Default configuration rows
INSERT INTO sample_order_config (key, value, description) VALUES
  ('max_samples_per_buyer',            '3',     'Maximum number of sample orders a buyer can have open at one time'),
  ('max_samples_per_product',          '1',     'Maximum number of samples a buyer can request per product'),
  ('free_sample_eligible_min_order',   '500',   'Minimum cumulative order value (USD) for free sample eligibility'),
  ('auto_approve_verified_suppliers',  'false', 'Automatically approve sample requests for verified suppliers'),
  ('sample_request_cooldown_days',     '30',    'Days a buyer must wait before requesting another sample from the same supplier'),
  ('feature_enabled',                  'false', 'Master switch to enable or disable the sample order feature'),
  ('mode',                             'test',  'Operating mode: test or live')
ON CONFLICT (key) DO NOTHING;

-- ── 39. TEAM MANAGEMENT ──
-- ─── Sub-Accounts & Team Management ────────────────────────────────────────
-- Migration: team_management.sql
-- Creates: teams, team_members, team_invitations, team_permissions,
--          team_activity_log, team_config

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── teams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  logo_url     TEXT,
  max_members  INTEGER NOT NULL DEFAULT 5,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

-- ─── team_members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')) DEFAULT 'member',
  status      TEXT NOT NULL CHECK (status IN ('invited','active','suspended','removed')) DEFAULT 'invited',
  invited_by  UUID REFERENCES users(id),
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id   ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id   ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status    ON team_members(status);

-- ─── team_invitations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','manager','member','viewer')) DEFAULT 'member',
  token      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','cancelled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token   ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email   ON team_invitations(email);

-- ─── team_permissions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')),
  resource   TEXT NOT NULL,
  actions    TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, role, resource)
);

CREATE INDEX IF NOT EXISTS idx_team_permissions_team_id ON team_permissions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_permissions_role    ON team_permissions(role);

-- ─── team_activity_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_log_team_id    ON team_activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_user_id    ON team_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_created_at ON team_activity_log(created_at DESC);

-- ─── team_config ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);

-- ─── Default config values ────────────────────────────────────────────────────
INSERT INTO team_config (key, value, description) VALUES
  ('feature_enabled',              'false',                   'Master switch to enable/disable Team Management feature'),
  ('mode',                         'test',                    'Operating mode: test or live'),
  ('max_teams_per_user',           '3',                       'Maximum number of teams a single user can own'),
  ('max_members_per_team',         '10',                      'Maximum members allowed per team'),
  ('default_member_role',          'member',                  'Default role assigned to newly invited members'),
  ('invitation_expiry_hours',      '72',                      'Hours before an invitation token expires'),
  ('enable_activity_log',          'true',                    'Record team activity events to team_activity_log'),
  ('enable_permission_customization', 'true',                 'Allow per-team custom permission overrides'),
  ('allowed_roles',                'owner,admin,manager,member,viewer', 'Comma-separated list of available member roles')
ON CONFLICT (key) DO NOTHING;

-- ─── Default global permissions (team_id = NULL → platform defaults) ──────────
INSERT INTO team_permissions (team_id, role, resource, actions) VALUES
  -- owner: all resources, all actions
  (NULL, 'owner',   'teams',    ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'orders',   ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'products', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'messages', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'members',  ARRAY['view','create','edit','delete','manage']),
  -- admin: all resources, all actions except delete team
  (NULL, 'admin',   'teams',    ARRAY['view','create','edit','manage']),
  (NULL, 'admin',   'orders',   ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'products', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'messages', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'members',  ARRAY['view','create','edit','delete','manage']),
  -- manager: orders/products/messages → view/create/edit
  (NULL, 'manager', 'orders',   ARRAY['view','create','edit']),
  (NULL, 'manager', 'products', ARRAY['view','create','edit']),
  (NULL, 'manager', 'messages', ARRAY['view','create','edit']),
  -- member: orders/products → view/create
  (NULL, 'member',  'orders',   ARRAY['view','create']),
  (NULL, 'member',  'products', ARRAY['view','create']),
  -- viewer: all resources → view only
  (NULL, 'viewer',  'teams',    ARRAY['view']),
  (NULL, 'viewer',  'orders',   ARRAY['view']),
  (NULL, 'viewer',  'products', ARRAY['view']),
  (NULL, 'viewer',  'messages', ARRAY['view']),
  (NULL, 'viewer',  'members',  ARRAY['view'])
ON CONFLICT (team_id, role, resource) DO NOTHING;

-- ── 40. TRADE ASSURANCE ──
-- =============================================================================
-- Trade Assurance / Buyer Protection System
-- Migration: trade_assurance.sql
-- =============================================================================

-- ─── trade_assurance_policies ────────────────────────────────────────────────
-- Policy definitions: coverage %, max claim amount, duration, terms

CREATE TABLE IF NOT EXISTS trade_assurance_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  coverage_pct    NUMERIC(5,2) NOT NULL DEFAULT 100.00,  -- e.g. 100.00 = 100%
  max_amount      NUMERIC(14,2) NOT NULL DEFAULT 50000.00,
  duration_days   INTEGER NOT NULL DEFAULT 90,           -- claim window in days
  terms           TEXT,                                  -- policy terms/conditions
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_claims ───────────────────────────────────────────────────
-- Buyer claims against an order

CREATE TABLE IF NOT EXISTS trade_assurance_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES trade_assurance_policies(id),
  order_id        UUID NOT NULL,
  buyer_id        UUID NOT NULL,
  supplier_id     UUID,
  claim_amount    NUMERIC(14,2) NOT NULL,
  reason          TEXT NOT NULL,
  description     TEXT,
  evidence_urls   JSONB DEFAULT '[]',                    -- array of file/image URLs
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','under_review','approved','rejected','resolved','closed')),
  resolution      TEXT,
  resolution_amount NUMERIC(14,2),
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  is_test_mode    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_deposits ────────────────────────────────────────────────
-- Supplier security deposits held by the platform

CREATE TABLE IF NOT EXISTS trade_assurance_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','released','forfeited','refunded')),
  reference       TEXT,
  notes           TEXT,
  released_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── trade_assurance_config ───────────────────────────────────────────────────
-- Admin-configurable settings for Trade Assurance

CREATE TABLE IF NOT EXISTS trade_assurance_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     TEXT NOT NULL UNIQUE,
  value                   TEXT NOT NULL,
  description             TEXT,
  updated_by              UUID,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO trade_assurance_config (key, value, description) VALUES
  ('enabled',               'true',   'Master toggle: enable or disable Trade Assurance'),
  ('mode',                  'test',   'Operating mode: test or live'),
  ('coverage_pct',          '100',    'Default coverage percentage (0-100)'),
  ('max_claim_amount',      '50000',  'Maximum claim amount in USD'),
  ('claim_window_days',     '90',     'Days after delivery within which a claim can be filed'),
  ('auto_approve_threshold','500',    'Claims up to this USD amount are auto-approved'),
  ('deposit_required_pct',  '5',      'Supplier deposit as % of annual GMV'),
  ('currency',              'USD',    'Default currency for Trade Assurance transactions')
ON CONFLICT (key) DO NOTHING;

-- ── 41. MISSING TABLES ──
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

-- ── 42. ADDITIONAL TABLES ──
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Additional Tables
-- Pure SQL reference — executed via 016_additional_tables.js
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shipping & Logistics ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  weight           NUMERIC(8,2) NOT NULL,
  unit_value       NUMERIC(12,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_products_request ON carry_products(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_products_product ON carry_products(product_id);

CREATE TABLE IF NOT EXISTS carry_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  delivery_status  TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending','in_transit','out_for_delivery','delivered','failed','returned'
  )),
  qr_code          TEXT,
  photos           TEXT[] DEFAULT '{}',
  signature        TEXT,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request ON carry_deliveries(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_deliveries_status  ON carry_deliveries(delivery_status);

CREATE TABLE IF NOT EXISTS parcel_shipments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id             UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  receiver_name         TEXT NOT NULL,
  receiver_phone        TEXT,
  receiver_email        TEXT,
  receiver_address      TEXT NOT NULL,
  receiver_city         TEXT,
  receiver_country      CHAR(2) NOT NULL,
  package_description   TEXT,
  weight                NUMERIC(8,2) NOT NULL,
  length_cm             NUMERIC(8,2),
  width_cm              NUMERIC(8,2),
  height_cm             NUMERIC(8,2),
  declared_value        NUMERIC(12,2),
  reference_number      TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','picked_up','in_transit','customs','delivered','returned','cancelled'
  )),
  shipping_fee          NUMERIC(12,2),
  insurance_fee         NUMERIC(12,2) DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_shipments_sender ON parcel_shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_status ON parcel_shipments(status);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_ref    ON parcel_shipments(reference_number);

CREATE TABLE IF NOT EXISTS carrier_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  carry_request_id UUID REFERENCES carry_requests(id) ON DELETE SET NULL,
  amount           NUMERIC(12,2) NOT NULL,
  bonus            NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(12,2) GENERATED ALWAYS AS (amount + bonus - platform_fee) STORED,
  payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending','processing','paid','failed','cancelled'
  )),
  payment_method    TEXT,
  payment_reference TEXT,
  notes             TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_payments_carrier ON carrier_payments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_payments_status  ON carrier_payments(payment_status);

-- ── AI & Analytics ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  algorithm   TEXT NOT NULL DEFAULT 'collaborative_filtering',
  score       NUMERIC(5,4),
  context     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user    ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires ON ai_recommendations(expires_at);

CREATE TABLE IF NOT EXISTS fraud_checks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  risk_score     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  flags          JSONB DEFAULT '[]',
  decision       TEXT NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow','review','block')),
  reviewed_by    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_checks_transaction ON fraud_checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_user        ON fraud_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_decision    ON fraud_checks(decision);

CREATE TABLE IF NOT EXISTS search_analytics (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query              TEXT NOT NULL,
  user_id            UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  filters_applied    JSONB DEFAULT '{}',
  session_id         TEXT,
  ip_address         INET,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user  ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_ts    ON search_analytics(timestamp);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  session_id     TEXT NOT NULL,
  messages_json  JSONB NOT NULL DEFAULT '[]',
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  escalated      BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_to   UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  language       TEXT NOT NULL DEFAULT 'en',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_convos_user    ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_convos_session ON chatbot_conversations(session_id);

CREATE TABLE IF NOT EXISTS chatbot_training_data (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  language   TEXT NOT NULL DEFAULT 'en',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  priority   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_training_category ON chatbot_training_data(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_training_language ON chatbot_training_data(language);

-- ── Trade & Finance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_finance_applications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  supplier_id   UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('letter_of_credit','bank_guarantee','trade_insurance','factoring')),
  amount        NUMERIC(15,2) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','under_review','approved','rejected','active','expired'
  )),
  documents     JSONB DEFAULT '[]',
  notes         TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_finance_buyer    ON trade_finance_applications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_supplier ON trade_finance_applications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_status   ON trade_finance_applications(status);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  supplier_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  amount       NUMERIC(15,2) NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  status       TEXT NOT NULL DEFAULT 'holding' CHECK (status IN (
    'holding','released','refunded','disputed','cancelled'
  )),
  milestone    TEXT,
  held_at      TIMESTAMPTZ,
  released_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_order  ON escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer  ON escrow_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_transactions(status);

CREATE TABLE IF NOT EXISTS currency_rates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  rate          NUMERIC(18,8) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'system',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_currency_rates_pair    ON currency_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_updated ON currency_rates(updated_at);

-- ── Advertising & Campaigns ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advertisements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('banner','sidebar','featured','popup','email')),
  position    TEXT,
  title       TEXT,
  image_url   TEXT,
  link_url    TEXT,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','active','paused','expired','rejected'
  )),
  clicks      BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_supplier ON advertisements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_status   ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_dates    ON advertisements(start_date, end_date);

CREATE TABLE IF NOT EXISTS sponsored_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  cpc_bid      NUMERIC(10,4) NOT NULL DEFAULT 0,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent        NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  impressions  BIGINT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','exhausted','cancelled')),
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_products_product ON sponsored_products(product_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_products_status  ON sponsored_products(status);

CREATE TABLE IF NOT EXISTS flash_sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  description      TEXT,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  product_ids      UUID[] DEFAULT '{}',
  quantity_limit   INTEGER,
  banner_url       TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','active','ended','cancelled'
  )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_times  ON flash_sales(start_time, end_time);

CREATE TABLE IF NOT EXISTS flash_sale_products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id  UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_price NUMERIC(12,2) NOT NULL,
  sale_price     NUMERIC(12,2) NOT NULL,
  quantity_limit INTEGER,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale    ON flash_sale_products(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_product ON flash_sale_products(product_id);

-- ── Membership & Loyalty ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  points           BIGINT NOT NULL DEFAULT 0,
  tier             TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  lifetime_points  BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','adjust','bonus')),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_txns_user  ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_order ON loyalty_transactions(order_id);

CREATE TABLE IF NOT EXISTS supplier_memberships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  tier          TEXT NOT NULL CHECK (tier IN ('basic','standard','pro','enterprise')),
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  price         NUMERIC(12,2) NOT NULL,
  features_json JSONB DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  auto_renew    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_memberships_supplier ON supplier_memberships(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_memberships_active   ON supplier_memberships(is_active);

-- ── Communication ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id              UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  last_message_at       TIMESTAMPTZ,
  unread_count_buyer    INTEGER NOT NULL DEFAULT 0,
  unread_count_supplier INTEGER NOT NULL DEFAULT 0,
  is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer    ON chat_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_supplier ON chat_rooms(supplier_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg ON chat_rooms(last_message_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  message         TEXT,
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','file','audio','video','system')),
  file_url        TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  read_at         TIMESTAMPTZ,
  translated_text JSONB DEFAULT '{}',
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room    ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender  ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS video_meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  title           TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','ongoing','completed','cancelled','no_show'
  )),
  meeting_url     TEXT,
  recording_url   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_meetings_organizer ON video_meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_scheduled ON video_meetings(scheduled_at);

-- ── Inspection ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspectors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  name            TEXT NOT NULL,
  location        TEXT,
  country         CHAR(2),
  specialization  TEXT[] DEFAULT '{}',
  certification   TEXT,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspectors_user    ON inspectors(user_id);
CREATE INDEX IF NOT EXISTS idx_inspectors_country ON inspectors(country);

-- ── Live Streaming ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_streams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  stream_key    TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','live','ended','cancelled'
  )),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  viewer_count  INTEGER NOT NULL DEFAULT 0,
  peak_viewers  INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  price         NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_supplier ON live_streams(supplier_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status   ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_featured ON live_streams(featured);

CREATE TABLE IF NOT EXISTS live_stream_products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id     UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  special_price NUMERIC(12,2),
  featured_at   TIMESTAMPTZ,
  sold_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(stream_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_products_stream  ON live_stream_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_products_product ON live_stream_products(product_id);

CREATE TABLE IF NOT EXISTS live_stream_chat (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id  UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON live_stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_ts     ON live_stream_chat(timestamp);

-- ── Audit & System ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id       UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address     INET,
  user_agent     TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin  ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts     ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_by  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key      ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

CREATE TABLE IF NOT EXISTS backup_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename     TEXT NOT NULL,
  size         BIGINT,
  type         TEXT NOT NULL DEFAULT 'full' CHECK (type IN ('full','incremental','schema_only')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  download_url TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_status  ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created ON backup_records(created_at);

-- ── 43. ADD MISSING TABLES ──
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

-- ── 44. RLS POLICIES (003) ──
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Row Level Security Policies for additional tables
-- Pure SQL reference — executed via 017_rls_policies.js
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE carry_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_shipments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_checks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_training_data      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points             ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspectors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_chat           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_records             ENABLE ROW LEVEL SECURITY;

-- ── carry_products ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass carry_products" ON carry_products;
CREATE POLICY "Service role bypass carry_products"
  ON carry_products USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Carriers view own carry products" ON carry_products;
CREATE POLICY "Carriers view own carry products"
  ON carry_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carry_requests cr
      WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
    )
  );

-- ── carry_deliveries ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass carry_deliveries" ON carry_deliveries;
CREATE POLICY "Service role bypass carry_deliveries"
  ON carry_deliveries USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Carriers manage own carry deliveries" ON carry_deliveries;
CREATE POLICY "Carriers manage own carry deliveries"
  ON carry_deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM carry_requests cr
      WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
    )
  );

-- ── parcel_shipments ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass parcel_shipments" ON parcel_shipments;
CREATE POLICY "Service role bypass parcel_shipments"
  ON parcel_shipments USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Senders view own parcel shipments" ON parcel_shipments;
CREATE POLICY "Senders view own parcel shipments"
  ON parcel_shipments FOR SELECT
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders create parcel shipments" ON parcel_shipments;
CREATE POLICY "Senders create parcel shipments"
  ON parcel_shipments FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ── carrier_payments ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass carrier_payments" ON carrier_payments;
CREATE POLICY "Service role bypass carrier_payments"
  ON carrier_payments USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Carriers view own payments" ON carrier_payments;
CREATE POLICY "Carriers view own payments"
  ON carrier_payments FOR SELECT
  USING (auth.uid() = carrier_id);

-- ── ai_recommendations ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass ai_recommendations" ON ai_recommendations;
CREATE POLICY "Service role bypass ai_recommendations"
  ON ai_recommendations USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own recommendations" ON ai_recommendations;
CREATE POLICY "Users view own recommendations"
  ON ai_recommendations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ── fraud_checks ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass fraud_checks" ON fraud_checks;
CREATE POLICY "Service role bypass fraud_checks"
  ON fraud_checks USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins view fraud checks" ON fraud_checks;
CREATE POLICY "Admins view fraud checks"
  ON fraud_checks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── search_analytics ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass search_analytics" ON search_analytics;
CREATE POLICY "Service role bypass search_analytics"
  ON search_analytics USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins view search analytics" ON search_analytics;
CREATE POLICY "Admins view search analytics"
  ON search_analytics FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Anyone can insert search analytics" ON search_analytics;
CREATE POLICY "Anyone can insert search analytics"
  ON search_analytics FOR INSERT
  WITH CHECK (TRUE);

-- ── chatbot_conversations ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass chatbot_conversations" ON chatbot_conversations;
CREATE POLICY "Service role bypass chatbot_conversations"
  ON chatbot_conversations USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own chatbot conversations" ON chatbot_conversations;
CREATE POLICY "Users view own chatbot conversations"
  ON chatbot_conversations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users manage own chatbot conversations" ON chatbot_conversations;
CREATE POLICY "Users manage own chatbot conversations"
  ON chatbot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── chatbot_training_data ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass chatbot_training_data" ON chatbot_training_data;
CREATE POLICY "Service role bypass chatbot_training_data"
  ON chatbot_training_data USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public can read active chatbot training data" ON chatbot_training_data;
CREATE POLICY "Public can read active chatbot training data"
  ON chatbot_training_data FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins manage chatbot training data" ON chatbot_training_data;
CREATE POLICY "Admins manage chatbot training data"
  ON chatbot_training_data FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── trade_finance_applications ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass trade_finance_applications" ON trade_finance_applications;
CREATE POLICY "Service role bypass trade_finance_applications"
  ON trade_finance_applications USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Buyers and suppliers view own trade finance" ON trade_finance_applications;
CREATE POLICY "Buyers and suppliers view own trade finance"
  ON trade_finance_applications FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

DROP POLICY IF EXISTS "Buyers create trade finance applications" ON trade_finance_applications;
CREATE POLICY "Buyers create trade finance applications"
  ON trade_finance_applications FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ── escrow_transactions ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass escrow_transactions" ON escrow_transactions;
CREATE POLICY "Service role bypass escrow_transactions"
  ON escrow_transactions USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Buyers and suppliers view own escrow" ON escrow_transactions;
CREATE POLICY "Buyers and suppliers view own escrow"
  ON escrow_transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

-- ── currency_rates ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass currency_rates" ON currency_rates;
CREATE POLICY "Service role bypass currency_rates"
  ON currency_rates USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read currency rates" ON currency_rates;
CREATE POLICY "Public read currency rates"
  ON currency_rates FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage currency rates" ON currency_rates;
CREATE POLICY "Admins manage currency rates"
  ON currency_rates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── advertisements ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass advertisements" ON advertisements;
CREATE POLICY "Service role bypass advertisements"
  ON advertisements USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view active advertisements" ON advertisements;
CREATE POLICY "Public view active advertisements"
  ON advertisements FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Suppliers manage own advertisements" ON advertisements;
CREATE POLICY "Suppliers manage own advertisements"
  ON advertisements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── sponsored_products ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass sponsored_products" ON sponsored_products;
CREATE POLICY "Service role bypass sponsored_products"
  ON sponsored_products USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view active sponsored products" ON sponsored_products;
CREATE POLICY "Public view active sponsored products"
  ON sponsored_products FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Suppliers manage own sponsored products" ON sponsored_products;
CREATE POLICY "Suppliers manage own sponsored products"
  ON sponsored_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── flash_sales ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass flash_sales" ON flash_sales;
CREATE POLICY "Service role bypass flash_sales"
  ON flash_sales USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view active flash sales" ON flash_sales;
CREATE POLICY "Public view active flash sales"
  ON flash_sales FOR SELECT
  USING (status IN ('scheduled', 'active'));

DROP POLICY IF EXISTS "Admins manage flash sales" ON flash_sales;
CREATE POLICY "Admins manage flash sales"
  ON flash_sales FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── flash_sale_products ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass flash_sale_products" ON flash_sale_products;
CREATE POLICY "Service role bypass flash_sale_products"
  ON flash_sale_products USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view flash sale products" ON flash_sale_products;
CREATE POLICY "Public view flash sale products"
  ON flash_sale_products FOR SELECT
  USING (TRUE);

-- ── loyalty_points ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass loyalty_points" ON loyalty_points;
CREATE POLICY "Service role bypass loyalty_points"
  ON loyalty_points USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own loyalty points" ON loyalty_points;
CREATE POLICY "Users view own loyalty points"
  ON loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

-- ── loyalty_transactions ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass loyalty_transactions" ON loyalty_transactions;
CREATE POLICY "Service role bypass loyalty_transactions"
  ON loyalty_transactions USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Users view own loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── supplier_memberships ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass supplier_memberships" ON supplier_memberships;
CREATE POLICY "Service role bypass supplier_memberships"
  ON supplier_memberships USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Suppliers view own memberships" ON supplier_memberships;
CREATE POLICY "Suppliers view own memberships"
  ON supplier_memberships FOR SELECT
  USING (auth.uid() = supplier_id);

-- ── chat_rooms ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass chat_rooms" ON chat_rooms;
CREATE POLICY "Service role bypass chat_rooms"
  ON chat_rooms USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Participants view own chat rooms" ON chat_rooms;
CREATE POLICY "Participants view own chat rooms"
  ON chat_rooms FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

DROP POLICY IF EXISTS "Buyers create chat rooms" ON chat_rooms;
CREATE POLICY "Buyers create chat rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ── chat_messages ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass chat_messages" ON chat_messages;
CREATE POLICY "Service role bypass chat_messages"
  ON chat_messages USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Room participants view messages" ON chat_messages;
CREATE POLICY "Room participants view messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.buyer_id = auth.uid() OR cr.supplier_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Room participants send messages" ON chat_messages;
CREATE POLICY "Room participants send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.buyer_id = auth.uid() OR cr.supplier_id = auth.uid())
    )
  );

-- ── video_meetings ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass video_meetings" ON video_meetings;
CREATE POLICY "Service role bypass video_meetings"
  ON video_meetings USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Organizers manage own meetings" ON video_meetings;
CREATE POLICY "Organizers manage own meetings"
  ON video_meetings FOR ALL
  USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Participants view meetings" ON video_meetings;
CREATE POLICY "Participants view meetings"
  ON video_meetings FOR SELECT
  USING (auth.uid() = ANY(participant_ids));

-- ── inspectors ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass inspectors" ON inspectors;
CREATE POLICY "Service role bypass inspectors"
  ON inspectors USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view available inspectors" ON inspectors;
CREATE POLICY "Public view available inspectors"
  ON inspectors FOR SELECT
  USING (is_available = TRUE);

DROP POLICY IF EXISTS "Inspectors manage own profile" ON inspectors;
CREATE POLICY "Inspectors manage own profile"
  ON inspectors FOR ALL
  USING (auth.uid() = user_id);

-- ── live_streams ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass live_streams" ON live_streams;
CREATE POLICY "Service role bypass live_streams"
  ON live_streams USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view live and scheduled streams" ON live_streams;
CREATE POLICY "Public view live and scheduled streams"
  ON live_streams FOR SELECT
  USING (status IN ('live','scheduled'));

DROP POLICY IF EXISTS "Suppliers manage own streams" ON live_streams;
CREATE POLICY "Suppliers manage own streams"
  ON live_streams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── live_stream_products ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass live_stream_products" ON live_stream_products;
CREATE POLICY "Service role bypass live_stream_products"
  ON live_stream_products USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public view live stream products" ON live_stream_products;
CREATE POLICY "Public view live stream products"
  ON live_stream_products FOR SELECT
  USING (TRUE);

-- ── live_stream_chat ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass live_stream_chat" ON live_stream_chat;
CREATE POLICY "Service role bypass live_stream_chat"
  ON live_stream_chat USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read live stream chat" ON live_stream_chat;
CREATE POLICY "Public read live stream chat"
  ON live_stream_chat FOR SELECT
  USING (is_deleted = FALSE);

DROP POLICY IF EXISTS "Authenticated users send stream chat" ON live_stream_chat;
CREATE POLICY "Authenticated users send stream chat"
  ON live_stream_chat FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ── audit_logs ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass audit_logs" ON audit_logs;
CREATE POLICY "Service role bypass audit_logs"
  ON audit_logs USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins view audit logs" ON audit_logs;
CREATE POLICY "Admins view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── system_settings ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass system_settings" ON system_settings;
CREATE POLICY "Service role bypass system_settings"
  ON system_settings USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read system settings" ON system_settings;
CREATE POLICY "Public read system settings"
  ON system_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage system settings" ON system_settings;
CREATE POLICY "Admins manage system settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── backup_records ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role bypass backup_records" ON backup_records;
CREATE POLICY "Service role bypass backup_records"
  ON backup_records USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins view backup records" ON backup_records;
CREATE POLICY "Admins view backup records"
  ON backup_records FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── 44b. RLS POLICIES (011) ──
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
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access (used by backend)
DROP POLICY IF EXISTS "Service role bypass profiles" ON profiles;
CREATE POLICY "Service role bypass profiles"
  ON profiles USING (auth.role() = 'service_role');

-- ─── addresses ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own addresses" ON addresses;
CREATE POLICY "Users manage own addresses"
  ON addresses USING (auth.uid() = user_id);

-- ─── products (public read) ──────────────────────────────────────
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products"
  ON products FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Suppliers manage own products" ON products;
CREATE POLICY "Suppliers manage own products"
  ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── wishlists ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own wishlists" ON wishlists;
CREATE POLICY "Users manage own wishlists"
  ON wishlists USING (auth.uid() = user_id);

-- ─── orders ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers see own orders" ON orders;
CREATE POLICY "Buyers see own orders"
  ON orders FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Suppliers see their orders" ON orders;
CREATE POLICY "Suppliers see their orders"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── transactions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own transactions" ON transactions;
CREATE POLICY "Users see own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

-- ─── notifications ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
CREATE POLICY "Users manage own notifications"
  ON notifications USING (auth.uid() = user_id);

-- ─── parcels ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Senders see own parcels" ON parcels;
CREATE POLICY "Senders see own parcels"
  ON parcels USING (auth.uid() = sender_id);

-- ─── rfqs ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers manage own RFQs" ON rfqs;
CREATE POLICY "Buyers manage own RFQs"
  ON rfqs USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Suppliers view open RFQs" ON rfqs;
CREATE POLICY "Suppliers view open RFQs"
  ON rfqs FOR SELECT USING (status = 'open');

-- ─── api_keys ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own API keys" ON api_keys;
CREATE POLICY "Users manage own API keys"
  ON api_keys USING (auth.uid() = user_id);

-- ─── webhooks ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own webhooks" ON webhooks;
CREATE POLICY "Users manage own webhooks"
  ON webhooks USING (auth.uid() = user_id);

-- ── 45. SEED DATA (optional — uncomment to run) ──
/*
-- SEED DATA: Remove the /* and */ delimiters to run seed data
-- ─────────────────────────────────────────────────────────────────
-- Seed Data — Sample content for testing
-- ─────────────────────────────────────────────────────────────────

-- Categories
INSERT INTO categories (id, name, slug, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Electronics',    'electronics',    1),
  ('11111111-1111-1111-1111-111111111102', 'Fashion',         'fashion',         2),
  ('11111111-1111-1111-1111-111111111103', 'Home & Garden',   'home-garden',     3),
  ('11111111-1111-1111-1111-111111111104', 'Sports',          'sports',          4),
  ('11111111-1111-1111-1111-111111111105', 'Beauty',          'beauty',          5),
  ('11111111-1111-1111-1111-111111111106', 'Industrial',      'industrial',      6)
ON CONFLICT (id) DO NOTHING;

-- Supplier Plans
INSERT INTO supplier_plans (name, monthly_fee, commission_rate, sort_order, is_active) VALUES
  ('Free',       0,    8.0, 1, TRUE),
  ('Starter',    29,   6.0, 2, TRUE),
  ('Pro',        99,   4.5, 3, TRUE),
  ('Enterprise', 299,  3.0, 4, TRUE)
ON CONFLICT DO NOTHING;

-- Inspection Pricing
INSERT INTO inspection_pricing (type, name, price, rush_fee_percentage, is_active) VALUES
  ('pre_shipment',  'Pre-Shipment Inspection',    99,  50, TRUE),
  ('factory_audit', 'Factory Audit',             299,  50, TRUE),
  ('during_production', 'During Production Check', 149, 50, TRUE)
ON CONFLICT DO NOTHING;

-- Shipping Rates (sample)
INSERT INTO shipping_rates (destination_country, min_weight, max_weight, price_per_kg, base_fee, express_fee, fragile_fee, estimated_days_min, estimated_days_max) VALUES
  ('AE', 0,   5,   4.50, 8,  15, 3, 5,  10),
  ('AE', 5,   20,  4.00, 8,  15, 3, 5,  10),
  ('US', 0,   5,   7.00, 12, 25, 5, 10, 20),
  ('US', 5,   20,  6.50, 12, 25, 5, 10, 20),
  ('GB', 0,   5,   6.00, 10, 20, 4, 8,  15),
  ('CN', 0,   5,   3.00, 5,  10, 2, 3,  7),
  ('*',  0,   999, 8.00, 15, 30, 6, 14, 30)
ON CONFLICT DO NOTHING;

-- Carry Rates
INSERT INTO carry_rates (product_category, name, payment_per_kg, fragile_surcharge, is_active) VALUES
  ('electronics',    'Electronics',      12, 3, TRUE),
  ('fashion',        'Clothing & Fashion', 8, 1, TRUE),
  ('documents',      'Documents',         5, 0, TRUE),
  ('general',        'General Goods',     7, 2, TRUE)
ON CONFLICT DO NOTHING;

-- Commission Settings (default)
INSERT INTO commission_settings (type, rate_percentage, flat_fee, min_commission, is_active) VALUES
  ('default', 5.0, 0, 0.50, TRUE)
ON CONFLICT DO NOTHING;

-- Dropshipping Markup (global default)
INSERT INTO dropshipping_markup (type, markup_percentage, min_profit, is_active) VALUES
  ('global', 20, 2, TRUE)
ON CONFLICT DO NOTHING;

-- API Plans
INSERT INTO api_plans (name, monthly_cost, request_limit, rate_limit_per_minute, is_active) VALUES
  ('Free',       0,     1000,   10, TRUE),
  ('Basic',      29,    100000, 100, TRUE),
  ('Pro',        99,    1000000, 500, TRUE),
  ('Enterprise', 999,   -1,     2000, TRUE)
ON CONFLICT DO NOTHING;

-- Site Settings
INSERT INTO site_settings (key, value, type, category) VALUES
  ('site_name',        'GlobexSky',             'text',    'general'),
  ('site_email',       'support@globexsky.com', 'text',    'general'),
  ('maintenance_mode', 'false',                 'boolean', 'general'),
  ('default_currency', 'USD',                   'text',    'localization')
ON CONFLICT (key) DO NOTHING;

-- Feature Toggles
INSERT INTO feature_toggles (feature_name, is_enabled) VALUES
  ('livestreaming',   TRUE),
  ('dropshipping',    TRUE),
  ('api_platform',    TRUE),
  ('carry_service',   TRUE),
  ('parcel_service',  TRUE),
  ('rfq',             TRUE),
  ('inspections',     TRUE)
ON CONFLICT (feature_name) DO NOTHING;

*/
