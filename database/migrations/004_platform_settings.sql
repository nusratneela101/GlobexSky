-- ============================================================
-- Migration: 004_platform_settings.sql
-- Purpose  : Create the platform_settings table for storing
--            API keys and service configuration managed from
--            the Admin Panel with Test/Live mode support.
--            Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id            SERIAL PRIMARY KEY,
  category      VARCHAR(50)  NOT NULL,        -- e.g. 'supabase', 'stripe', 'openai', 'agora', 'smtp', 'bkash', 'nagad', 'general'
  setting_key   VARCHAR(100) NOT NULL,         -- e.g. 'SUPABASE_URL', 'STRIPE_SECRET_KEY'
  setting_value TEXT,                           -- the actual value (encrypted for secrets)
  mode          VARCHAR(10)  DEFAULT 'test'
                             CHECK (mode IN ('test', 'live')),
  is_active     BOOLEAN      DEFAULT TRUE,
  is_sensitive  BOOLEAN      DEFAULT FALSE,    -- if true, value is AES-256-CBC encrypted
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(category, setting_key, mode)
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION platform_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION platform_settings_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_mode     ON platform_settings(mode);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key      ON platform_settings(setting_key);

-- Row-Level Security (Supabase)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read settings"   ON platform_settings;
DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;

CREATE POLICY "Only admins can read settings"
  ON platform_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can modify settings"
  ON platform_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
