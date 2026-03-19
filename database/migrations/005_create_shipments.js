/**
 * Migration 005: Shipments (combined: carry + parcels)
 * Tables: carry_requests, carry_items, carry_rates, parcels, parcel_tracking_events
 * Note: carry_requests and parcels are split into dedicated migrations 012 and 013.
 *       This migration creates the shared shipping_rates configuration table.
 */

export async function up(executeSql) {
  await executeSql(`
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
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_shipping_rates_country ON shipping_rates(destination_country);
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS carry_rates (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_category  TEXT NOT NULL,
      name              TEXT,
      payment_per_kg    NUMERIC(8,2) NOT NULL,
      fragile_surcharge NUMERIC(8,2) DEFAULT 0,
      is_active         BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS carry_rates;`);
  await executeSql(`DROP TABLE IF EXISTS shipping_rates;`);
}
