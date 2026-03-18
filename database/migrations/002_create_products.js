/**
 * Migration 002: Products & Categories tables
 * Tables: categories, products, product_variants, wishlists
 */

export async function up(executeSql) {
  await executeSql(`
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
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS products (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      supplier_id    UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
      title          TEXT NOT NULL,
      slug           TEXT UNIQUE NOT NULL,
      description    TEXT,
      specifications JSONB,
      images         TEXT[] DEFAULT '{}',
      price          NUMERIC(12,2) NOT NULL,
      moq            INTEGER NOT NULL DEFAULT 1,
      stock          INTEGER NOT NULL DEFAULT 0,
      category_id    UUID REFERENCES categories(id),
      status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','inactive','pending','banned')),
      featured       BOOLEAN NOT NULL DEFAULT FALSE,
      trending       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);`);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_products_fts
      ON products USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
  `);

  await executeSql(`
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
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS wishlists;`);
  await executeSql(`DROP TABLE IF EXISTS product_variants;`);
  await executeSql(`DROP TABLE IF EXISTS products;`);
  await executeSql(`DROP TABLE IF EXISTS categories;`);
}
