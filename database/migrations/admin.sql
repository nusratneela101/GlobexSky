-- Admin Panel Migration
-- Creates tables for settings, admin roles, admin users, activity logs, and backups.

-- ─── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  group       TEXT NOT NULL DEFAULT 'general',
  type        TEXT NOT NULL DEFAULT 'string',  -- string | number | boolean | json
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settings_group_idx ON settings (group);

-- ─── Admin Roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Seed default roles
INSERT INTO admin_roles (name, permissions) VALUES
  ('super_admin',       '["*"]'),
  ('admin',             '["users.read","users.write","products.read","products.write","orders.read","orders.write","settings.read","settings.write"]'),
  ('marketing_manager', '["campaigns.read","campaigns.write","products.read","banners.read","banners.write","blog.read","blog.write"]'),
  ('support_agent',     '["users.read","orders.read","disputes.read","disputes.write","refunds.read","refunds.write"]'),
  ('inspector',         '["inspections.read","inspections.write","products.read","suppliers.read"]'),
  ('finance_manager',   '["transactions.read","refunds.read","refunds.write","reports.read"]')
ON CONFLICT (name) DO NOTHING;

-- ─── Admin Users (role assignments) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_users_role_id_idx ON admin_users (role_id);

-- ─── Admin Activity Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_activity_logs_admin_id_idx    ON admin_activity_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_activity_logs_resource_idx    ON admin_activity_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx  ON admin_activity_logs (created_at DESC);

-- ─── Backups ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename   TEXT NOT NULL,
  size       BIGINT NOT NULL DEFAULT 0,
  type       TEXT NOT NULL DEFAULT 'full',   -- full | incremental | schema
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | restoring
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backups_status_idx     ON backups (status);
CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups (created_at DESC);

-- ─── Seed default settings ────────────────────────────────────────────────────
INSERT INTO settings (key, value, group, type) VALUES
  -- General
  ('general.site_name',        'Globex Sky',              'general', 'string'),
  ('general.site_description', 'B2B/B2C Marketplace',     'general', 'string'),
  ('general.contact_email',    'support@globexsky.com',   'general', 'string'),
  ('general.contact_phone',    '',                        'general', 'string'),
  ('general.timezone',         'UTC',                     'general', 'string'),
  ('general.maintenance_mode', 'false',                   'general', 'boolean'),
  -- Security
  ('security.admin_2fa',       'false',   'security', 'boolean'),
  ('security.session_timeout', '3600',    'security', 'number'),
  ('security.captcha_enabled', 'false',   'security', 'boolean'),
  -- Feature toggles
  ('feature.user_registration', 'true',  'features', 'boolean'),
  ('feature.guest_checkout',    'true',  'features', 'boolean'),
  ('feature.reviews',           'true',  'features', 'boolean'),
  ('feature.wishlists',         'true',  'features', 'boolean'),
  ('feature.promotions',        'true',  'features', 'boolean')
ON CONFLICT (key) DO NOTHING;
