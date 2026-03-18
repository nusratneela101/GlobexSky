-- ─────────────────────────────────────────────────────────────────
-- Seed Data — Sample content for testing
-- ─────────────────────────────────────────────────────────────────

-- Categories
INSERT INTO categories (id, name, slug, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Electronics',    'electronics',    1),
  ('11111111-1111-1111-1111-111111111102', 'Fashion',         'fashion',         2),
  ('11111111-1111-1111-1111-111111111103', 'Home & Garden',   'home-garden',     3),
  ('11111111-1111-1111-1111-111111111104', 'Sports',          'sports',          4),
  ('11111111-1111-1111-1111-111111111105', 'Beauty',          'beauty',          5),
  ('11111111-1111-1111-1111-111111111106', 'Industrial',      'industrial',      6)
ON CONFLICT (id) DO NOTHING;

-- Supplier Plans
INSERT INTO supplier_plans (name, monthly_fee, commission_rate, sort_order, is_active) VALUES
  ('Free',       0,    8.0, 1, TRUE),
  ('Starter',    29,   6.0, 2, TRUE),
  ('Pro',        99,   4.5, 3, TRUE),
  ('Enterprise', 299,  3.0, 4, TRUE)
ON CONFLICT DO NOTHING;

-- Inspection Pricing
INSERT INTO inspection_pricing (type, name, price, rush_fee_percentage, is_active) VALUES
  ('pre_shipment',  'Pre-Shipment Inspection',    99,  50, TRUE),
  ('factory_audit', 'Factory Audit',             299,  50, TRUE),
  ('during_production', 'During Production Check', 149, 50, TRUE)
ON CONFLICT DO NOTHING;

-- Shipping Rates (sample)
INSERT INTO shipping_rates (destination_country, min_weight, max_weight, price_per_kg, base_fee, express_fee, fragile_fee, estimated_days_min, estimated_days_max) VALUES
  ('AE', 0,   5,   4.50, 8,  15, 3, 5,  10),
  ('AE', 5,   20,  4.00, 8,  15, 3, 5,  10),
  ('US', 0,   5,   7.00, 12, 25, 5, 10, 20),
  ('US', 5,   20,  6.50, 12, 25, 5, 10, 20),
  ('GB', 0,   5,   6.00, 10, 20, 4, 8,  15),
  ('CN', 0,   5,   3.00, 5,  10, 2, 3,  7),
  ('*',  0,   999, 8.00, 15, 30, 6, 14, 30)
ON CONFLICT DO NOTHING;

-- Carry Rates
INSERT INTO carry_rates (product_category, name, payment_per_kg, fragile_surcharge, is_active) VALUES
  ('electronics',    'Electronics',      12, 3, TRUE),
  ('fashion',        'Clothing & Fashion', 8, 1, TRUE),
  ('documents',      'Documents',         5, 0, TRUE),
  ('general',        'General Goods',     7, 2, TRUE)
ON CONFLICT DO NOTHING;

-- Commission Settings (default)
INSERT INTO commission_settings (type, rate_percentage, flat_fee, min_commission, is_active) VALUES
  ('default', 5.0, 0, 0.50, TRUE)
ON CONFLICT DO NOTHING;

-- Dropshipping Markup (global default)
INSERT INTO dropshipping_markup (type, markup_percentage, min_profit, is_active) VALUES
  ('global', 20, 2, TRUE)
ON CONFLICT DO NOTHING;

-- API Plans
INSERT INTO api_plans (name, monthly_cost, request_limit, rate_limit_per_minute, is_active) VALUES
  ('Free',       0,     1000,   10, TRUE),
  ('Basic',      29,    100000, 100, TRUE),
  ('Pro',        99,    1000000, 500, TRUE),
  ('Enterprise', 999,   -1,     2000, TRUE)
ON CONFLICT DO NOTHING;

-- Site Settings
INSERT INTO site_settings (key, value, type, category) VALUES
  ('site_name',        'GlobexSky',             'text',    'general'),
  ('site_email',       'support@globexsky.com', 'text',    'general'),
  ('maintenance_mode', 'false',                 'boolean', 'general'),
  ('default_currency', 'USD',                   'text',    'localization')
ON CONFLICT (key) DO NOTHING;

-- Feature Toggles
INSERT INTO feature_toggles (feature_name, is_enabled) VALUES
  ('livestreaming',   TRUE),
  ('dropshipping',    TRUE),
  ('api_platform',    TRUE),
  ('carry_service',   TRUE),
  ('parcel_service',  TRUE),
  ('rfq',             TRUE),
  ('inspections',     TRUE)
ON CONFLICT (feature_name) DO NOTHING;
