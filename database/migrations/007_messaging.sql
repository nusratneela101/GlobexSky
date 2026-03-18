-- ─────────────────────────────────────────────────────────────────
-- Migration 007: Messaging & Notifications
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids  UUID[] NOT NULL,
  type             TEXT NOT NULL DEFAULT 'buyer_supplier' CHECK (type IN ('buyer_supplier','support')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING gin(participant_ids);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  content         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','file','voice')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
