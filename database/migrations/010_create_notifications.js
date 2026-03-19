/**
 * Migration 010: Notifications table
 * Tables: notifications
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'info' CHECK (type IN (
        'info','success','warning','error','order','payment','shipment','dispute','system'
      )),
      read       BOOLEAN NOT NULL DEFAULT FALSE,
      link       TEXT,
      metadata   JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
  `);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS notifications;`);
}
