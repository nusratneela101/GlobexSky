/**
 * Migration 014: Warehouses tables
 * Tables: warehouses, warehouse_inventory
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name         TEXT NOT NULL,
      code         TEXT UNIQUE NOT NULL,
      address      TEXT NOT NULL,
      city         TEXT NOT NULL,
      country      TEXT NOT NULL,
      postal_code  TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      capacity_sqm NUMERIC(10,2),
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_warehouses_code    ON warehouses(code);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_warehouses_country ON warehouses(country);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS warehouse_inventory (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      product_id   UUID REFERENCES products(id),
      supplier_id  UUID REFERENCES supplier_profiles(id),
      sku          TEXT,
      quantity     INTEGER NOT NULL DEFAULT 0,
      reserved     INTEGER NOT NULL DEFAULT 0,
      location     TEXT,
      batch_number TEXT,
      received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse
      ON warehouse_inventory(warehouse_id);
  `);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product
      ON warehouse_inventory(product_id);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS warehouse_inventory;`);
  await executeSql(`DROP TABLE IF EXISTS warehouses;`);
}
