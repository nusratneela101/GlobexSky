-- ============================================================
-- Migration: Video Meetings Table
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id  UUID REFERENCES auth.users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  meeting_url     TEXT,
  room_code       TEXT UNIQUE,
  notes           TEXT,
  invitees        UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_organizer    ON meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_participant  ON meetings(participant_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled    ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status       ON meetings(status);
