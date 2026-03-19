/**
 * Migration 009: RFQ (Request for Quotation) tables
 * Tables: rfqs, rfq_quotes
 */

export async function up(executeSql) {
  await executeSql(`
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
      status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open','quoted','negotiating','closed'
      )),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_rfqs_buyer  ON rfqs(buyer_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);`);

  await executeSql(`
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
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq      ON rfq_quotes(rfq_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier ON rfq_quotes(supplier_id);`);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS rfq_quotes;`);
  await executeSql(`DROP TABLE IF EXISTS rfqs;`);
}
