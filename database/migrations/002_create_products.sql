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
