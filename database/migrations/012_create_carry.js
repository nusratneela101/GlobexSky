/**
 * Migration 012: Carry service tables
 * Tables: carry_requests, carry_items
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS carry_requests (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      carrier_id      UUID REFERENCES carrier_profiles(id),
      flight_number   TEXT NOT NULL,
      departure_date  DATE NOT NULL,
      arrival_date    DATE,
      origin          TEXT NOT NULL,
      destination     TEXT NOT NULL,
      weight_capacity NUMERIC(8,2) NOT NULL,
      weight_used     NUMERIC(8,2) NOT NULL DEFAULT 0,
      notes           TEXT,
      status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active','full','cancelled','completed'
      )),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier ON carry_requests(carrier_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_carry_requests_status  ON carry_requests(status);`);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_carry_requests_route
      ON carry_requests(origin, destination);
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS carry_items (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
      sender_id        UUID REFERENCES auth.users(id),
      product_category TEXT NOT NULL,
      description      TEXT,
      weight_kg        NUMERIC(8,2) NOT NULL,
      payment_per_kg   NUMERIC(8,2) NOT NULL,
      total_payment    NUMERIC(10,2) NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending','confirmed','delivered','cancelled'
      )),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_carry_items_request ON carry_items(carry_request_id);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS carry_items;`);
  await executeSql(`DROP TABLE IF EXISTS carry_requests;`);
}
