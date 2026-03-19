/**
 * Migration 011: Chat & Messaging tables
 * Tables: conversations, messages
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS conversations (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      participant_ids UUID[] NOT NULL,
      type            TEXT NOT NULL DEFAULT 'buyer_supplier' CHECK (type IN (
        'buyer_supplier','support','group'
      )),
      last_message_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_conversations_participants
      ON conversations USING gin(participant_ids);
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       UUID NOT NULL REFERENCES auth.users(id),
      content         TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN (
        'text','image','file','voice'
      )),
      attachments     TEXT[] DEFAULT '{}',
      read_at         TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);`);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS messages;`);
  await executeSql(`DROP TABLE IF EXISTS conversations;`);
}
