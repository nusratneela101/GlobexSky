-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Migration Part 4: Admin, CMS & Extended Features
-- (CMS, Admin, Analytics, Inspections, Trade, Teams, and more)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER migration-part3-features.sql
-- Safe to run multiple times — uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── CMS: Pages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug             TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  content          TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_slug      ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_published ON pages(is_published);

INSERT INTO pages (slug, title, content, is_published) VALUES
  ('home',    'Homepage',         '', true),
  ('about',   'About Us',         '', true),
  ('contact', 'Contact Us',       '', true),
  ('privacy', 'Privacy Policy',   '', true),
  ('terms',   'Terms of Service', '', true),
  ('faq',     'FAQ',              '', true)
ON CONFLICT (slug) DO NOTHING;

-- ── CMS: Banners ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link       TEXT,
  position   TEXT DEFAULT 'hero',
  start_date DATE,
  end_date   DATE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position);
CREATE INDEX IF NOT EXISTS idx_banners_active   ON banners(is_active);

-- ── CMS: Blog Posts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  excerpt        TEXT,
  featured_image TEXT,
  category       TEXT,
  tags           JSONB DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','archived')),
  published_at   TIMESTAMPTZ,
  views_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug     ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status   ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author   ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);

CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts SET views_count = views_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- ── CMS: Email Templates ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT UNIQUE NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'
);

-- ── CMS: Templates (shared email/sms) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email','sms')),
  category   TEXT,
  subject    TEXT,
  body       TEXT NOT NULL DEFAULT '',
  variables  JSONB DEFAULT '[]',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);

CREATE TABLE IF NOT EXISTS template_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id    UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  subject        TEXT,
  body           TEXT,
  variables      JSONB DEFAULT '[]',
  changed_by     UUID REFERENCES auth.users(id),
  change_note    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);

-- ── CMS: FAQs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faqs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── CMS: Site Settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  type       TEXT DEFAULT 'text',
  category   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CMS: Feature Toggles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name TEXT UNIQUE NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  conditions   JSONB,
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_toggles_feature_name ON feature_toggles(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_is_enabled   ON feature_toggles(is_enabled);

-- ── CMS: Newsletter Subscribers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  name            VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','unsubscribed','bounced')),
  preferences     JSONB DEFAULT '{}',
  subscribed_at   TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email  ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);

-- ── Admin: Settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  "group"    TEXT NOT NULL DEFAULT 'general',
  type       TEXT NOT NULL DEFAULT 'string',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_group ON settings("group");

INSERT INTO settings (key, value, "group", type) VALUES
  ('general.site_name',        'Globex Sky',           'general', 'string'),
  ('general.site_description', 'B2B/B2C Marketplace',  'general', 'string'),
  ('general.support_email',    'support@globexsky.com','general', 'string'),
  ('general.currency',         'USD',                  'general', 'string')
ON CONFLICT (key) DO NOTHING;

-- ── Admin: Admin Settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_settings (key, value) VALUES
  ('payout_schedule', '{"frequency":"weekly","day_of_week":5,"min_amount":50,"auto_process":false}')
ON CONFLICT (key) DO NOTHING;

-- ── Admin: Roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_roles (name, permissions) VALUES
  ('super_admin',       '["*"]'),
  ('admin',             '["users.read","users.write","products.read","products.write","orders.read","orders.write","settings.read","settings.write"]'),
  ('marketing_manager', '["campaigns.read","campaigns.write","products.read","banners.read","banners.write","blog.read","blog.write"]'),
  ('support_agent',     '["users.read","orders.read","disputes.read","disputes.write","refunds.read","refunds.write"]'),
  ('inspector',         '["inspections.read","inspections.write","products.read","suppliers.read"]'),
  ('finance_manager',   '["transactions.read","refunds.read","refunds.write","reports.read"]')
ON CONFLICT (name) DO NOTHING;

-- ── Admin: Admin Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON admin_users(role_id);

-- ── Admin: Activity Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_id    ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_resource    ON admin_activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at  ON admin_activity_logs(created_at DESC);

-- ── Admin: Custom Styles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_custom_styles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  category   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Admin: System Configs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_configs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key     TEXT NOT NULL UNIQUE,
  config_value   JSONB,
  config_group   TEXT NOT NULL DEFAULT 'general',
  is_secret      BOOLEAN NOT NULL DEFAULT FALSE,
  is_live        BOOLEAN NOT NULL DEFAULT FALSE,
  test_value     TEXT,
  live_value     TEXT,
  last_tested_at TIMESTAMPTZ,
  test_status    TEXT NOT NULL DEFAULT 'untested'
                   CHECK (test_status IN ('untested','success','failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_group ON system_configs(config_group);
CREATE INDEX IF NOT EXISTS idx_system_configs_key   ON system_configs(config_key);

-- ── Admin: System Settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_by  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key      ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- ── Admin: Platform Settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category      VARCHAR(50) NOT NULL,
  setting_key   VARCHAR(100) NOT NULL,
  setting_value TEXT,
  mode          VARCHAR(10) DEFAULT 'test' CHECK (mode IN ('test','live')),
  is_active     BOOLEAN DEFAULT TRUE,
  is_sensitive  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, setting_key, mode)
);

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

CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_mode     ON platform_settings(mode);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key      ON platform_settings(setting_key);

-- ── Admin: Audit Logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id       UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address     INET,
  user_agent     TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin  ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts     ON audit_logs(timestamp);

-- ── Admin: Backups ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename     TEXT NOT NULL,
  size         BIGINT,
  type         TEXT NOT NULL DEFAULT 'full' CHECK (type IN ('full','incremental','schema_only')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  download_url TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_status  ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created ON backup_records(created_at);

-- ── Pricing: Commission Settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category   TEXT UNIQUE NOT NULL DEFAULT 'default',
  rate       NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  min_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_fee    NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pricing: Commissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'flat' CHECK (type IN ('category','tiered','flat','percentage')),
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  min_order_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_order_value NUMERIC(14,2),
  rate_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_cap         NUMERIC(14,2),
  max_cap         NUMERIC(14,2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_category_id ON commissions(category_id);
CREATE INDEX IF NOT EXISTS idx_commissions_is_active   ON commissions(is_active);

-- ── Pricing: Subscription Plans ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT UNIQUE NOT NULL,
  price_monthly        NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly         NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'USD',
  features             JSONB NOT NULL DEFAULT '{}'::JSONB,
  max_products         INTEGER,
  max_orders_per_month INTEGER,
  ai_marketing_budget  NUMERIC(10,2) NOT NULL DEFAULT 0,
  analytics_level      TEXT NOT NULL DEFAULT 'basic',
  support_level        TEXT NOT NULL DEFAULT 'email',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  trial_days           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_name      ON subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

-- ── Pricing: Advertising / API ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertising_pricing (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placement          TEXT UNIQUE NOT NULL,
  price_per_day      NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_week     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_month    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_plans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT UNIQUE NOT NULL,
  requests_per_day INTEGER NOT NULL DEFAULT 1000,
  price_monthly    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_pricing_tiers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name         TEXT UNIQUE NOT NULL,
  requests_per_month INTEGER NOT NULL DEFAULT 10000,
  price_monthly     NUMERIC(10,2) NOT NULL DEFAULT 0,
  overage_per_1000  NUMERIC(10,4) DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pricing: Dropshipping / Parcel ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dropshipping_markup (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category       TEXT UNIQUE NOT NULL DEFAULT 'default',
  markup_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_pricing (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weight_from_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
  weight_to_kg   NUMERIC(8,2) NOT NULL DEFAULT 1,
  base_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_kg   NUMERIC(10,2) NOT NULL DEFAULT 0,
  zone           TEXT DEFAULT 'default',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Shipping: Rates & Destinations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_rates (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_country  TEXT NOT NULL,
  min_weight           NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_weight           NUMERIC(8,2) NOT NULL DEFAULT 999,
  price_per_kg         NUMERIC(8,2) NOT NULL,
  base_fee             NUMERIC(8,2) NOT NULL DEFAULT 0,
  express_fee          NUMERIC(8,2) DEFAULT 0,
  fragile_fee          NUMERIC(8,2) DEFAULT 0,
  insurance_percentage NUMERIC(5,2) DEFAULT 1,
  estimated_days_min   INTEGER DEFAULT 7,
  estimated_days_max   INTEGER DEFAULT 14,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS shipping_destinations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country                  TEXT NOT NULL,
  country_code             TEXT NOT NULL,
  is_active                BOOLEAN DEFAULT TRUE,
  min_weight_kg            NUMERIC(8,2) DEFAULT 0.1,
  max_weight_kg            NUMERIC(8,2) DEFAULT 30,
  base_fee                 NUMERIC(10,2) NOT NULL DEFAULT 10,
  rate_per_kg              NUMERIC(10,2) NOT NULL DEFAULT 10,
  express_surcharge        NUMERIC(10,2) DEFAULT 15,
  economy_discount_percent NUMERIC(5,2) DEFAULT 10,
  estimated_days_standard  TEXT DEFAULT '7-14',
  estimated_days_express   TEXT DEFAULT '3-5',
  is_restricted            BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code)
);

-- ── Inspectors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspectors (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  location         TEXT NOT NULL,
  country          TEXT,
  specializations  TEXT[] DEFAULT '{}',
  certifications   TEXT[] DEFAULT '{}',
  rating           NUMERIC(3,2) DEFAULT 0,
  total_inspections INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  bio              TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspectors_user     ON inspectors(user_id);
CREATE INDEX IF NOT EXISTS idx_inspectors_country  ON inspectors(country);
CREATE INDEX IF NOT EXISTS idx_inspectors_active   ON inspectors(is_active);

-- ── Inspections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number  TEXT UNIQUE,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id),
  inspector_id    UUID REFERENCES inspectors(id),
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN (
    'pre_production','during_production','pre_shipment','full_audit',
    'final_random','container_loading'
  )),
  supplier_name   TEXT,
  factory_address TEXT,
  contact_person  TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  product_name    TEXT,
  product_category TEXT,
  quantity        INTEGER,
  specifications  TEXT,
  preferred_date  DATE,
  scheduled_date  DATE,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  rush_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(10,2) NOT NULL DEFAULT 0,
  pricing         JSONB,
  payment_status  TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','payment_pending','scheduled','in_progress','completed','cancelled'
  )),
  result          TEXT CHECK (result IN ('pass','fail','conditional')),
  report          JSONB,
  photos          JSONB NOT NULL DEFAULT '[]'::JSONB,
  attachments     JSONB DEFAULT '[]',
  notes           TEXT,
  location        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_buyer_id     ON inspections(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_supplier_id  ON inspections(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status       ON inspections(status);

-- ── Inspection Reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_reports (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id  UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE UNIQUE,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass','fail','conditional_pass')),
  quality_score  INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  units_sampled  INTEGER,
  units_passed   INTEGER,
  defect_rate    NUMERIC(5,2),
  findings       JSONB DEFAULT '[]',
  photos         JSONB DEFAULT '[]',
  videos         JSONB DEFAULT '[]',
  recommendations TEXT,
  inspector_notes TEXT,
  report_pdf_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspection ON inspection_reports(inspection_id);

-- ── Inspection Timeline ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_timeline (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  description   TEXT,
  photos        JSONB DEFAULT '[]',
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_timeline_inspection ON inspection_timeline(inspection_id);

-- ── Inspection Pricing ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_pricing (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL UNIQUE,
  price         NUMERIC(10,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  report_hours  INTEGER NOT NULL DEFAULT 24,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO inspection_pricing (type, price, duration_days, report_hours) VALUES
  ('pre_production',      199.00, 1, 24),
  ('during_production',   249.00, 2, 24),
  ('pre_shipment',        179.00, 1, 12),
  ('full_audit',          499.00, 3, 48)
ON CONFLICT (type) DO NOTHING;

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id   UUID REFERENCES auth.users(id),
  participant_ids  JSONB DEFAULT '[]',
  title            TEXT NOT NULL,
  description      TEXT,
  meeting_url      TEXT,
  agora_channel    TEXT,
  room_code        TEXT UNIQUE,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes            TEXT,
  invitees         UUID[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_organizer  ON meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled  ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status     ON meetings(status);

-- ── VR Showrooms ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vr_showrooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  model_urls    JSONB DEFAULT '[]',
  thumbnail_url TEXT,
  product_ids   JSONB DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','draft')),
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vr_showrooms_seller ON vr_showrooms(seller_id);
CREATE INDEX IF NOT EXISTS idx_vr_showrooms_status ON vr_showrooms(status);

-- ── Video Meetings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  title           TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','ongoing','completed','cancelled','no_show'
  )),
  meeting_url     TEXT,
  recording_url   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_meetings_organizer ON video_meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_scheduled ON video_meetings(scheduled_at);

-- ── Live Streams ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_streams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  stream_key    TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','live','ended','cancelled'
  )),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  viewer_count  INTEGER NOT NULL DEFAULT 0,
  peak_viewers  INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  price         NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_supplier ON live_streams(supplier_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status   ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_featured ON live_streams(featured);

CREATE TABLE IF NOT EXISTS live_stream_products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id     UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  special_price NUMERIC(12,2),
  featured_at   TIMESTAMPTZ,
  sold_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(stream_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_products_stream  ON live_stream_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_products_product ON live_stream_products(product_id);

CREATE TABLE IF NOT EXISTS live_stream_chat (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id  UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON live_stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_ts     ON live_stream_chat(timestamp);

-- ── Livestreams (simple CMS variant) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS livestreams (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID REFERENCES supplier_profiles(id),
  title        TEXT NOT NULL,
  description  TEXT,
  thumbnail    TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trade Shows ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_shows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title        TEXT NOT NULL,
  description  TEXT,
  start_date   TIMESTAMPTZ NOT NULL,
  end_date     TIMESTAMPTZ NOT NULL,
  type         TEXT NOT NULL DEFAULT 'virtual'
                 CHECK (type IN ('virtual','physical','hybrid')),
  booth_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_booths   INTEGER NOT NULL DEFAULT 0,
  booths_sold  INTEGER NOT NULL DEFAULT 0 CHECK (booths_sold >= 0),
  status       TEXT NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming','live','ended')),
  banner_image TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_shows_organizer_id ON trade_shows(organizer_id);
CREATE INDEX IF NOT EXISTS idx_trade_shows_status       ON trade_shows(status);
CREATE INDEX IF NOT EXISTS idx_trade_shows_start_date   ON trade_shows(start_date);

-- ── Trade Assurance ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_assurance_policies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  coverage_pct  NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  max_amount    NUMERIC(14,2) NOT NULL DEFAULT 50000.00,
  duration_days INTEGER NOT NULL DEFAULT 90,
  terms         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_assurance_claims (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id         UUID REFERENCES trade_assurance_policies(id),
  order_id          UUID NOT NULL,
  buyer_id          UUID NOT NULL,
  supplier_id       UUID,
  claim_amount      NUMERIC(14,2) NOT NULL,
  reason            TEXT NOT NULL,
  description       TEXT,
  evidence_urls     JSONB DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','under_review','approved','rejected','resolved','closed')),
  resolution        TEXT,
  resolution_amount NUMERIC(14,2),
  resolved_by       UUID,
  resolved_at       TIMESTAMPTZ,
  is_test_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_assurance_deposits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  status      TEXT NOT NULL DEFAULT 'held'
                CHECK (status IN ('held','released','forfeited','refunded')),
  reference   TEXT,
  notes       TEXT,
  released_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_assurance_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO trade_assurance_config (key, value, description) VALUES
  ('enabled',               'true',  'Master toggle: enable or disable Trade Assurance'),
  ('mode',                  'test',  'Operating mode: test or live'),
  ('coverage_pct',          '100',   'Default coverage percentage (0-100)'),
  ('max_claim_amount',      '50000', 'Maximum claim amount in USD'),
  ('claim_window_days',     '90',    'Days after delivery within which a claim can be filed'),
  ('auto_approve_threshold','500',   'Claims up to this USD amount are auto-approved'),
  ('deposit_required_pct',  '5',     'Supplier deposit as % of annual GMV'),
  ('currency',              'USD',   'Default currency for Trade Assurance transactions')
ON CONFLICT (key) DO NOTHING;

-- ── Trade Finance ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_finance_applications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('letter_of_credit','bank_guarantee','trade_insurance','factoring')),
  amount      NUMERIC(15,2) NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','under_review','approved','rejected','active','expired'
  )),
  documents   JSONB DEFAULT '[]',
  notes       TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_finance_buyer    ON trade_finance_applications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_supplier ON trade_finance_applications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_status   ON trade_finance_applications(status);

-- ── Teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  logo_url    TEXT,
  max_members INTEGER NOT NULL DEFAULT 5,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

CREATE TABLE IF NOT EXISTS team_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner','admin','manager','member','viewer')),
  status     TEXT NOT NULL DEFAULT 'invited'
               CHECK (status IN ('invited','active','suspended','removed')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status  ON team_members(status);

CREATE TABLE IF NOT EXISTS team_invitations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('admin','manager','member','viewer')),
  token      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token   ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email   ON team_invitations(email);

CREATE TABLE IF NOT EXISTS team_permissions (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id  UUID REFERENCES teams(id) ON DELETE CASCADE,
  role     TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')),
  resource TEXT NOT NULL,
  actions  TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE(team_id, role, resource)
);

CREATE TABLE IF NOT EXISTS team_activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_id   UUID,
  target_type TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_team_id   ON team_activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_actor_id  ON team_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created_at ON team_activity_log(created_at DESC);

CREATE TABLE IF NOT EXISTS team_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Support Tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  subject     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','urgent')),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user     ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  message     TEXT NOT NULL,
  attachments TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_sender ON support_ticket_messages(sender_id);

-- ── Customization Requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customization_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id       UUID NOT NULL,
  supplier_id    UUID,
  product_id     UUID,
  title          TEXT NOT NULL,
  description    TEXT,
  specifications JSONB DEFAULT '{}',
  attachments    TEXT[] DEFAULT '{}',
  quantity       INTEGER,
  target_price   NUMERIC(12,2),
  target_date    DATE,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','quoted','accepted','in_production','completed','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_buyer_id    ON customization_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cr_supplier_id ON customization_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_cr_status      ON customization_requests(status);

CREATE TABLE IF NOT EXISTS customization_quotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id     UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL,
  unit_price     NUMERIC(12,2) NOT NULL,
  total_price    NUMERIC(12,2) NOT NULL,
  moq            INTEGER,
  lead_time_days INTEGER,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','expired')),
  valid_until    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cq_request_id  ON customization_quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_cq_supplier_id ON customization_quotes(supplier_id);

CREATE TABLE IF NOT EXISTS customization_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  message     TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_request_id ON customization_messages(request_id);

CREATE TABLE IF NOT EXISTS customization_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

INSERT INTO customization_config (key, value, description) VALUES
  ('feature_enabled',                'false', 'Enable or disable the OEM customization feature'),
  ('mode',                           'test',  'Operational mode: test or live'),
  ('max_attachments',                '10',    'Maximum number of file attachments per request'),
  ('max_file_size_mb',               '25',    'Maximum file size in MB per attachment'),
  ('auto_notify_matching_suppliers', 'true',  'Automatically notify matching suppliers on submit'),
  ('quote_expiry_days',              '14',    'Number of days until a submitted quote expires'),
  ('max_quotes_per_request',         '10',    'Maximum number of quotes allowed per request')
ON CONFLICT (key) DO NOTHING;

-- ── Sample Orders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sample_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id            UUID NOT NULL,
  supplier_id         UUID NOT NULL,
  product_id          UUID NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  message             TEXT,
  shipping_address_id UUID,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','shipped','delivered','reviewed')),
  tracking_number     TEXT,
  cost                NUMERIC(10,2) DEFAULT 0,
  is_free             BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_notes      TEXT,
  buyer_feedback      TEXT,
  buyer_rating        SMALLINT CHECK (buyer_rating BETWEEN 1 AND 5),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_orders_buyer_id    ON sample_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_supplier_id ON sample_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_product_id  ON sample_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_status      ON sample_orders(status);

CREATE TABLE IF NOT EXISTS sample_order_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

INSERT INTO sample_order_config (key, value, description) VALUES
  ('max_samples_per_buyer',           '3',     'Maximum number of sample orders a buyer can have open'),
  ('max_samples_per_product',         '1',     'Maximum number of samples a buyer can request per product'),
  ('free_sample_eligible_min_order',  '500',   'Minimum cumulative order value (USD) for free sample eligibility'),
  ('auto_approve_verified_suppliers', 'false', 'Automatically approve sample requests for verified suppliers'),
  ('sample_request_cooldown_days',    '30',    'Days a buyer must wait before requesting another sample'),
  ('feature_enabled',                 'false', 'Master switch to enable or disable sample orders'),
  ('mode',                            'test',  'Operating mode: test or live')
ON CONFLICT (key) DO NOTHING;

-- ── Loyalty ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  points          BIGINT NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'bronze'
                    CHECK (tier IN ('bronze','silver','gold','platinum')),
  lifetime_points BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','adjust','bonus')),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_txns_user  ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_order ON loyalty_transactions(order_id);

-- ── Supplier Memberships ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_memberships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  tier          TEXT NOT NULL CHECK (tier IN ('basic','standard','pro','enterprise')),
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  price         NUMERIC(12,2) NOT NULL,
  features_json JSONB DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  auto_renew    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_memberships_supplier ON supplier_memberships(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_memberships_active   ON supplier_memberships(is_active);

-- ── Supplier Scores & Badges ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_scores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reviewer_id         UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  quality_score       NUMERIC(3,1) NOT NULL CHECK (quality_score BETWEEN 0 AND 5),
  delivery_score      NUMERIC(3,1) NOT NULL CHECK (delivery_score BETWEEN 0 AND 5),
  communication_score NUMERIC(3,1) NOT NULL CHECK (communication_score BETWEEN 0 AND 5),
  price_score         NUMERIC(3,1) NOT NULL CHECK (price_score BETWEEN 0 AND 5),
  overall_score       NUMERIC(3,1) NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
  review_text         TEXT,
  order_id            UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_scores_supplier_id ON supplier_scores(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_reviewer_id ON supplier_scores(reviewer_id);

CREATE TABLE IF NOT EXISTS supplier_scorecards (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id           UUID NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  quality_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  delivery_score        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (delivery_score BETWEEN 0 AND 100),
  communication_score   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (communication_score BETWEEN 0 AND 100),
  pricing_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pricing_score BETWEEN 0 AND 100),
  badges                JSONB NOT NULL DEFAULT '[]',
  review_count          INTEGER NOT NULL DEFAULT 0,
  last_evaluated_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_supplier_id ON supplier_scorecards(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scorecards_overall     ON supplier_scorecards(overall_score DESC);

CREATE TABLE IF NOT EXISTS badge_catalog (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon        VARCHAR(100) NOT NULL,
  criteria    JSONB NOT NULL DEFAULT '{}',
  tier        VARCHAR(20) NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badge_catalog_tier ON badge_catalog(tier);

INSERT INTO badge_catalog (name, description, icon, criteria, tier) VALUES
  ('Bronze Supplier',   'Achieved an overall score of 50+',   'fa-medal',         '{"overall_min": 50}',         'bronze'),
  ('Silver Supplier',   'Achieved an overall score of 65+',   'fa-award',         '{"overall_min": 65}',         'silver'),
  ('Gold Supplier',     'Achieved an overall score of 80+',   'fa-star',          '{"overall_min": 80}',         'gold'),
  ('Platinum Supplier', 'Achieved an overall score of 90+',   'fa-crown',         '{"overall_min": 90}',         'platinum'),
  ('Premium Quality',   'Quality score of 90 or above',       'fa-gem',           '{"quality_min": 90}',         'gold'),
  ('Fast Shipper',      'Delivery score of 90 or above',      'fa-shipping-fast', '{"delivery_min": 90}',        'silver'),
  ('Quick Responder',   'Communication score of 90 or above', 'fa-bolt',          '{"communication_min": 90}',   'silver'),
  ('Best Value',        'Pricing score of 90 or above',       'fa-tag',           '{"pricing_min": 90}',         'bronze')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS supplier_badges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  badge_type   VARCHAR(50) NOT NULL,
  badge_name   VARCHAR(100) NOT NULL,
  awarded_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  criteria_met JSONB DEFAULT '{}',
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_badges_supplier_id ON supplier_badges(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_badges_type        ON supplier_badges(badge_type);

CREATE TABLE IF NOT EXISTS supplier_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID UNIQUE NOT NULL,
  plan_name     TEXT NOT NULL DEFAULT 'basic'
                  CHECK (plan_name IN ('basic','standard','premium','enterprise')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_plans_supplier_id ON supplier_plans(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_plans_is_active   ON supplier_plans(is_active);

-- ── Currency ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_rates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  rate          NUMERIC(18,8) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'system',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_currency_rates_pair    ON currency_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_updated ON currency_rates(updated_at);

CREATE TABLE IF NOT EXISTS currency_contracts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  contract_type   VARCHAR(20) NOT NULL CHECK (contract_type IN ('forward','option','swap')),
  base_currency   CHAR(3) NOT NULL,
  quote_currency  CHAR(3) NOT NULL,
  notional_amount NUMERIC(18,4) NOT NULL,
  contract_rate   NUMERIC(18,6) NOT NULL,
  spot_rate       NUMERIC(18,6),
  settlement_date DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','closed','expired','cancelled')),
  hedging_ratio   NUMERIC(5,4) DEFAULT 1.0,
  pnl             NUMERIC(18,4),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currency_contracts_user_id    ON currency_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_status     ON currency_contracts(status);
CREATE INDEX IF NOT EXISTS idx_currency_contracts_settlement ON currency_contracts(settlement_date);

-- ── Advertisements & Sponsored Products ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertisements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('banner','sidebar','featured','popup','email')),
  position    TEXT,
  title       TEXT,
  image_url   TEXT,
  link_url    TEXT,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','active','paused','expired','rejected'
  )),
  clicks      BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_supplier ON advertisements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_status   ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_dates    ON advertisements(start_date, end_date);

CREATE TABLE IF NOT EXISTS sponsored_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  cpc_bid      NUMERIC(10,4) NOT NULL DEFAULT 0,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent        NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  impressions  BIGINT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','exhausted','cancelled')),
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_products_product ON sponsored_products(product_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_products_status  ON sponsored_products(status);

-- ── Dropshipping ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dropshipping_products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID NOT NULL,
  original_product_id UUID,
  seller_id           UUID NOT NULL,
  markup_percent      NUMERIC(5,2) NOT NULL DEFAULT 20,
  selling_price       NUMERIC(12,2),
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','sold_out')),
  imported_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dropshipping_products_seller   ON dropshipping_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_dropshipping_products_supplier ON dropshipping_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dropshipping_products_status   ON dropshipping_products(status);

-- ── GDPR Requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('export','deletion','correction','portability')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','rejected')),
  data_url     TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user   ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type   ON gdpr_requests(type);

-- ── Analytics: Search & Product Views ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_searches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  query         TEXT NOT NULL,
  filters       JSONB DEFAULT '{}',
  name          TEXT,
  alert_enabled BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

CREATE TABLE IF NOT EXISTS search_history_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  query         TEXT NOT NULL,
  results_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history_items(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION get_trending_searches(since_ts TIMESTAMPTZ, result_limit INTEGER)
RETURNS TABLE(query TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT sh.query, COUNT(*) as count
    FROM search_history_items sh
    WHERE sh.created_at >= since_ts
    GROUP BY sh.query
    ORDER BY count DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS product_views (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_spent INTEGER
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_user_id    ON product_views(user_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at  ON product_views(viewed_at DESC);

CREATE TABLE IF NOT EXISTS search_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  query              TEXT NOT NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  searched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id     ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_searched_at ON search_logs(searched_at DESC);

CREATE TABLE IF NOT EXISTS search_analytics (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query              TEXT NOT NULL,
  user_id            UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  filters_applied    JSONB DEFAULT '{}',
  session_id         TEXT,
  ip_address         INET,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user  ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_ts    ON search_analytics(timestamp);

-- ── Carrier Products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'USD',
  weight_limit     NUMERIC(8,2),
  route_from       TEXT,
  route_to         TEXT,
  available_from   DATE,
  available_to     DATE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_products_carrier ON carrier_products(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_products_active  ON carrier_products(is_active);

-- ── API Keys & Webhooks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key        TEXT UNIQUE NOT NULL,
  plan_id        UUID REFERENCES api_plans(id),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  requests_used  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key  ON api_keys(api_key);

CREATE TABLE IF NOT EXISTS api_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  method        TEXT NOT NULL,
  status_code   INTEGER,
  response_time INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_key  ON api_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_date ON api_logs(created_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  secret     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── AI & Chatbot ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  algorithm   TEXT NOT NULL DEFAULT 'collaborative_filtering',
  score       NUMERIC(5,4),
  context     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user    ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires ON ai_recommendations(expires_at);

CREATE TABLE IF NOT EXISTS fraud_checks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  risk_score     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  flags          JSONB DEFAULT '[]',
  decision       TEXT NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow','review','block')),
  reviewed_by    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_checks_transaction ON fraud_checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_user        ON fraud_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_decision    ON fraud_checks(decision);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  session_id    TEXT NOT NULL,
  messages_json JSONB NOT NULL DEFAULT '[]',
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  escalated     BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_to  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  language      TEXT NOT NULL DEFAULT 'en',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_convos_user    ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_convos_session ON chatbot_conversations(session_id);

CREATE TABLE IF NOT EXISTS chatbot_training_data (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  language   TEXT NOT NULL DEFAULT 'en',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  priority   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_training_category ON chatbot_training_data(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_training_language ON chatbot_training_data(language);

-- ── Barcode Products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barcode_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode      VARCHAR(128) NOT NULL UNIQUE,
  barcode_type VARCHAR(30) NOT NULL DEFAULT 'EAN-13',
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barcode_products_barcode     ON barcode_products(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_products_product_id  ON barcode_products(product_id);

-- ── Import/Export Jobs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_export_jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type              VARCHAR(10) NOT NULL CHECK (type IN ('import','export')),
  entity_type       VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','failed')),
  file_url          TEXT,
  total_records     INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records    INTEGER DEFAULT 0,
  errors            JSONB DEFAULT '[]',
  created_by        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_export_jobs_status     ON import_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_created_by ON import_export_jobs(created_by);

-- ── Containers & Freight ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS containers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_number  VARCHAR(20) NOT NULL UNIQUE,
  type              VARCHAR(30) NOT NULL,
  size              VARCHAR(10) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'booked',
  origin_port       VARCHAR(100) NOT NULL,
  destination_port  VARCHAR(100) NOT NULL,
  carrier           VARCHAR(100),
  vessel_name       VARCHAR(100),
  voyage_number     VARCHAR(50),
  eta               TIMESTAMPTZ,
  etd               TIMESTAMPTZ,
  current_location  VARCHAR(200),
  booking_reference VARCHAR(50),
  supplier_id       UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  buyer_id          UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_containers_container_number ON containers(container_number);
CREATE INDEX IF NOT EXISTS idx_containers_status           ON containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_booking_ref      ON containers(booking_reference);

CREATE TABLE IF NOT EXISTS freight_bookings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(50) NOT NULL UNIQUE,
  shipper_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  consignee_id      UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  freight_type      VARCHAR(10) NOT NULL CHECK (freight_type IN ('FCL','LCL','AIR','RAIL')),
  container_id      UUID REFERENCES containers(id) ON DELETE SET NULL,
  origin            VARCHAR(200) NOT NULL,
  destination       VARCHAR(200) NOT NULL,
  cargo_description TEXT NOT NULL,
  weight_kg         NUMERIC(10,2),
  volume_cbm        NUMERIC(10,3),
  incoterms         VARCHAR(10),
  estimated_cost    NUMERIC(12,2),
  actual_cost       NUMERIC(12,2),
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  pickup_date       DATE,
  delivery_date     DATE,
  tracking_events   JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freight_bookings_shipper_id        ON freight_bookings(shipper_id);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_status            ON freight_bookings(status);
CREATE INDEX IF NOT EXISTS idx_freight_bookings_booking_reference ON freight_bookings(booking_reference);

-- ── Social Auth: Extend Profiles ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id      VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_id    VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider  VARCHAR(50) DEFAULT 'email';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_id
  ON profiles(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_facebook_id
  ON profiles(facebook_id) WHERE facebook_id IS NOT NULL;

-- ── Address Book: Extend Addresses ───────────────────────────────────────────
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS full_name           VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone               VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address_line1       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_default_billing  BOOLEAN NOT NULL DEFAULT FALSE;
