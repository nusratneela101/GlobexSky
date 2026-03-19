/**
 * Migration 007: Disputes table
 * Tables: disputes, dispute_messages
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS disputes (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id      UUID NOT NULL REFERENCES orders(id),
      buyer_id      UUID NOT NULL REFERENCES auth.users(id),
      supplier_id   UUID REFERENCES supplier_profiles(id),
      type          TEXT NOT NULL CHECK (type IN (
        'not_received','damaged','not_as_described','wrong_item','other'
      )),
      status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open','under_review','resolved','closed','escalated'
      )),
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      evidence      TEXT[] DEFAULT '{}',
      resolution    TEXT,
      resolved_by   UUID REFERENCES auth.users(id),
      resolved_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_disputes_order    ON disputes(order_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_disputes_buyer    ON disputes(buyer_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_disputes_status   ON disputes(status);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS dispute_messages (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
      sender_id   UUID NOT NULL REFERENCES auth.users(id),
      content     TEXT NOT NULL,
      attachments TEXT[] DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS dispute_messages;`);
  await executeSql(`DROP TABLE IF EXISTS disputes;`);
}
