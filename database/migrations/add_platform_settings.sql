-- Migration: add_platform_settings
-- Creates the platform_settings table for storing API keys and service
-- configuration managed through the Admin Panel UI.

CREATE TABLE IF NOT EXISTS platform_settings (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  category     TEXT        NOT NULL,                         -- 'stripe','paypal','bkash','nagad','supabase','openai','agora','smtp','general'
  setting_key  TEXT        NOT NULL,                         -- e.g. 'STRIPE_SECRET_KEY'
  setting_value TEXT,                                        -- AES-encrypted for sensitive values
  mode         TEXT        DEFAULT 'test'
                           CHECK (mode IN ('test', 'live')),
  is_active    BOOLEAN     DEFAULT TRUE,
  is_sensitive BOOLEAN     DEFAULT FALSE,                    -- TRUE = value is encrypted
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, setting_key, mode)
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

-- Row-Level Security
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read settings"   ON platform_settings;
DROP POLICY IF EXISTS "Only admins can modify settings" ON platform_settings;

CREATE POLICY "Only admins can read settings"
  ON platform_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can modify settings"
  ON platform_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
