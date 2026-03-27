-- ─── Sub-Accounts & Team Management ────────────────────────────────────────
-- Migration: team_management.sql
-- Creates: teams, team_members, team_invitations, team_permissions,
--          team_activity_log, team_config

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── teams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  logo_url     TEXT,
  max_members  INTEGER NOT NULL DEFAULT 5,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

-- ─── team_members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')) DEFAULT 'member',
  status      TEXT NOT NULL CHECK (status IN ('invited','active','suspended','removed')) DEFAULT 'invited',
  invited_by  UUID REFERENCES users(id),
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id   ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id   ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status    ON team_members(status);

-- ─── team_invitations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','manager','member','viewer')) DEFAULT 'member',
  token      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','cancelled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token   ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email   ON team_invitations(email);

-- ─── team_permissions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')),
  resource   TEXT NOT NULL,
  actions    TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, role, resource)
);

CREATE INDEX IF NOT EXISTS idx_team_permissions_team_id ON team_permissions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_permissions_role    ON team_permissions(role);

-- ─── team_activity_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_log_team_id    ON team_activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_user_id    ON team_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_created_at ON team_activity_log(created_at DESC);

-- ─── team_config ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);

-- ─── Default config values ────────────────────────────────────────────────────
INSERT INTO team_config (key, value, description) VALUES
  ('feature_enabled',              'false',                   'Master switch to enable/disable Team Management feature'),
  ('mode',                         'test',                    'Operating mode: test or live'),
  ('max_teams_per_user',           '3',                       'Maximum number of teams a single user can own'),
  ('max_members_per_team',         '10',                      'Maximum members allowed per team'),
  ('default_member_role',          'member',                  'Default role assigned to newly invited members'),
  ('invitation_expiry_hours',      '72',                      'Hours before an invitation token expires'),
  ('enable_activity_log',          'true',                    'Record team activity events to team_activity_log'),
  ('enable_permission_customization', 'true',                 'Allow per-team custom permission overrides'),
  ('allowed_roles',                'owner,admin,manager,member,viewer', 'Comma-separated list of available member roles')
ON CONFLICT (key) DO NOTHING;

-- ─── Default global permissions (team_id = NULL → platform defaults) ──────────
INSERT INTO team_permissions (team_id, role, resource, actions) VALUES
  -- owner: all resources, all actions
  (NULL, 'owner',   'teams',    ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'orders',   ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'products', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'messages', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'owner',   'members',  ARRAY['view','create','edit','delete','manage']),
  -- admin: all resources, all actions except delete team
  (NULL, 'admin',   'teams',    ARRAY['view','create','edit','manage']),
  (NULL, 'admin',   'orders',   ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'products', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'messages', ARRAY['view','create','edit','delete','manage']),
  (NULL, 'admin',   'members',  ARRAY['view','create','edit','delete','manage']),
  -- manager: orders/products/messages → view/create/edit
  (NULL, 'manager', 'orders',   ARRAY['view','create','edit']),
  (NULL, 'manager', 'products', ARRAY['view','create','edit']),
  (NULL, 'manager', 'messages', ARRAY['view','create','edit']),
  -- member: orders/products → view/create
  (NULL, 'member',  'orders',   ARRAY['view','create']),
  (NULL, 'member',  'products', ARRAY['view','create']),
  -- viewer: all resources → view only
  (NULL, 'viewer',  'teams',    ARRAY['view']),
  (NULL, 'viewer',  'orders',   ARRAY['view']),
  (NULL, 'viewer',  'products', ARRAY['view']),
  (NULL, 'viewer',  'messages', ARRAY['view']),
  (NULL, 'viewer',  'members',  ARRAY['view'])
ON CONFLICT (team_id, role, resource) DO NOTHING;
