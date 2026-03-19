/**
 * Migration 008: Refunds table
 * Tables: refunds
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS refunds (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id        UUID NOT NULL REFERENCES orders(id),
      dispute_id      UUID REFERENCES disputes(id),
      buyer_id        UUID NOT NULL REFERENCES auth.users(id),
      amount          NUMERIC(12,2) NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'USD',
      reason          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending','approved','rejected','processing','completed','failed'
      )),
      refund_method   TEXT,
      transaction_id  UUID REFERENCES transactions(id),
      notes           TEXT,
      processed_by    UUID REFERENCES auth.users(id),
      processed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_refunds_order   ON refunds(order_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_refunds_buyer   ON refunds(buyer_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_refunds_status  ON refunds(status);`);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS refunds;`);
}
