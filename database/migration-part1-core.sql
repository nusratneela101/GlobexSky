-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Migration Part 1: Core (Extensions, Users, Products)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run order: part1 → part2 → part3 → part4
-- Safe to run multiple times — uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users (standalone auth system, separate from Supabase auth) ─────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                TEXT        UNIQUE NOT NULL,
  password_hash        TEXT,
  first_name           TEXT,
  last_name            TEXT,
  name                 TEXT,
  phone                TEXT,
  avatar_url           TEXT,
  role                 TEXT        NOT NULL DEFAULT 'buyer'
                         CHECK (role IN ('buyer','supplier','carrier','admin','super_admin','inspector','employee','support')),
  status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive','suspended','banned','pending_verification')),
  email_verified       BOOLEAN     NOT NULL DEFAULT FALSE,
  phone_verified       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_banned            BOOLEAN     NOT NULL DEFAULT FALSE,
  ban_reason           TEXT,
  two_factor_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  language             TEXT        NOT NULL DEFAULT 'en',
  currency             TEXT        NOT NULL DEFAULT 'USD',
  timezone             TEXT        NOT NULL DEFAULT 'UTC',
  last_login_at        TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status    ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- ── User Profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio                      TEXT,
  company_name             TEXT,
  company_type             TEXT,
  address                  TEXT,
  city                     TEXT,
  country                  TEXT,
  website                  TEXT,
  description              TEXT,
  timezone                 TEXT DEFAULT 'UTC',
  language_preference      TEXT DEFAULT 'en',
  verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  verification_level       TEXT NOT NULL DEFAULT 'none'
                             CHECK (verification_level IN ('none','basic','advanced','premium')),
  notification_preferences JSONB DEFAULT '{"email":true,"sms":false,"push":true}'::JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ── User Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT,
  token       TEXT UNIQUE,
  device_info JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token      ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ── Login History ──────────────────────────────────────────────────────────
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

-- ── Profiles (extends Supabase auth.users) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  avatar_url          TEXT,
  phone               TEXT,
  company_name        TEXT,
  role                TEXT NOT NULL DEFAULT 'buyer'
                        CHECK (role IN ('admin','buyer','supplier','carrier','inspector')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN ('unverified','pending','verified')),
  language            TEXT NOT NULL DEFAULT 'en',
  currency            TEXT NOT NULL DEFAULT 'USD',
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON profiles(role);

-- ── Addresses ───────────────────────────────────────────────────────────────
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

-- ── Supplier Profiles ───────────────────────────────────────────────────────
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

-- ── Carrier Profiles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passport_url      TEXT,
  id_doc_url        TEXT,
  selfie_url        TEXT,
  passport_number   TEXT,
  passport_verified BOOLEAN NOT NULL DEFAULT FALSE,
  facial_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','suspended','rejected')),
  rating            NUMERIC(3,2) DEFAULT 0,
  total_trips       INTEGER NOT NULL DEFAULT 0,
  total_earnings    NUMERIC(12,2) NOT NULL DEFAULT 0,
  success_rate      NUMERIC(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON carrier_profiles(user_id);

-- ── Categories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,
  description     TEXT,
  image_url       TEXT,
  icon            TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_categories_slug      ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- ── Products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id      UUID          REFERENCES users(id) ON DELETE SET NULL,
  category_id      UUID          REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id   UUID          REFERENCES categories(id) ON DELETE SET NULL,
  title            TEXT          NOT NULL,
  name             TEXT,
  slug             TEXT          UNIQUE NOT NULL,
  description      TEXT,
  specifications   JSONB         NOT NULL DEFAULT '{}'::JSONB,
  images           JSONB         NOT NULL DEFAULT '[]'::JSONB,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  base_price       NUMERIC(14,4),
  currency         TEXT          NOT NULL DEFAULT 'USD',
  moq              INTEGER       NOT NULL DEFAULT 1,
  min_order_qty    INTEGER       NOT NULL DEFAULT 1,
  max_order_qty    INTEGER,
  unit             TEXT          NOT NULL DEFAULT 'piece',
  stock            INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_quantity   INTEGER       NOT NULL DEFAULT 0,
  lead_time        INTEGER       DEFAULT 7,
  status           TEXT          NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','pending','active','approved','rejected','inactive','banned')),
  rejection_reason TEXT,
  featured         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_featured      BOOLEAN       NOT NULL DEFAULT FALSE,
  trending         BOOLEAN       NOT NULL DEFAULT FALSE,
  sku              TEXT          UNIQUE,
  weight           NUMERIC(8,3),
  dimensions       JSONB,
  origin_country   TEXT,
  hs_code          TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_supplier_id  ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug         ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status       ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_featured  ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_sku          ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_fts          ON products USING gin(
  to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,''))
);

-- ── Product Variants ───────────────────────────────────────────────────────
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

-- ── Product Images ─────────────────────────────────────────────────────────
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

-- ── Product Attributes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_attributes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product_id ON product_attributes(product_id);
