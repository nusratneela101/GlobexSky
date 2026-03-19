/**
 * Migration 003: Orders tables
 * Tables: orders, order_items
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      buyer_id            UUID NOT NULL REFERENCES auth.users(id),
      supplier_id         UUID REFERENCES supplier_profiles(id),
      status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending','confirmed','processing','shipped','delivered','cancelled','refunded'
      )),
      subtotal            NUMERIC(12,2) NOT NULL,
      shipping_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
      commission          NUMERIC(12,2) NOT NULL DEFAULT 0,
      total               NUMERIC(12,2) NOT NULL,
      payment_method      TEXT,
      payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
        'pending','paid','failed','refunded'
      )),
      shipping_address_id UUID REFERENCES addresses(id),
      tracking_number     TEXT,
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_orders_buyer_id    ON orders(buyer_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON orders(supplier_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS order_items (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id),
      variant_id UUID REFERENCES product_variants(id),
      quantity   INTEGER NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total      NUMERIC(12,2) NOT NULL
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS order_items;`);
  await executeSql(`DROP TABLE IF EXISTS orders;`);
}
