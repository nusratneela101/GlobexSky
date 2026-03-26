-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Initial Seed Data
-- Run via: cd backend && npm run seed
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Languages
-- ─────────────────────────────────────────────────────────────────
INSERT INTO languages (code, name, native_name, direction, is_active) VALUES
  ('en', 'English',    'English',    'ltr', TRUE),
  ('zh', 'Chinese',    '中文',       'ltr', TRUE),
  ('ar', 'Arabic',     'العربية',    'rtl', TRUE),
  ('hi', 'Hindi',      'हिन्दी',     'ltr', TRUE),
  ('bn', 'Bengali',    'বাংলা',      'ltr', TRUE),
  ('fr', 'French',     'Français',   'ltr', TRUE),
  ('es', 'Spanish',    'Español',    'ltr', TRUE),
  ('pt', 'Portuguese', 'Português',  'ltr', TRUE),
  ('ru', 'Russian',    'Русский',    'ltr', TRUE),
  ('de', 'German',     'Deutsch',    'ltr', TRUE),
  ('ja', 'Japanese',   '日本語',     'ltr', TRUE),
  ('ko', 'Korean',     '한국어',     'ltr', TRUE),
  ('tr', 'Turkish',    'Türkçe',     'ltr', TRUE),
  ('id', 'Indonesian', 'Bahasa Indonesia', 'ltr', TRUE),
  ('vi', 'Vietnamese', 'Tiếng Việt', 'ltr', TRUE),
  ('th', 'Thai',       'ภาษาไทย',   'ltr', TRUE),
  ('ms', 'Malay',      'Bahasa Melayu', 'ltr', TRUE),
  ('ur', 'Urdu',       'اردو',       'rtl', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Currencies
-- ─────────────────────────────────────────────────────────────────
INSERT INTO currencies (code, name, symbol, exchange_rate, is_active) VALUES
  ('USD', 'US Dollar',          '$',   1.000000, TRUE),
  ('EUR', 'Euro',               '€',   0.920000, TRUE),
  ('GBP', 'British Pound',      '£',   0.790000, TRUE),
  ('CNY', 'Chinese Yuan',       '¥',   7.240000, TRUE),
  ('JPY', 'Japanese Yen',       '¥', 149.800000, TRUE),
  ('KRW', 'South Korean Won',   '₩', 1310.000000, TRUE),
  ('INR', 'Indian Rupee',       '₹',  83.000000, TRUE),
  ('BDT', 'Bangladeshi Taka',   '৳', 110.000000, TRUE),
  ('AED', 'UAE Dirham',         'د.إ', 3.670000, TRUE),
  ('SAR', 'Saudi Riyal',        '﷼',   3.750000, TRUE),
  ('SGD', 'Singapore Dollar',   'S$',  1.340000, TRUE),
  ('HKD', 'Hong Kong Dollar',   'HK$', 7.840000, TRUE),
  ('MYR', 'Malaysian Ringgit',  'RM',  4.720000, TRUE),
  ('THB', 'Thai Baht',          '฿',  35.500000, TRUE),
  ('IDR', 'Indonesian Rupiah',  'Rp', 15800.000000, TRUE),
  ('VND', 'Vietnamese Dong',    '₫', 24500.000000, TRUE),
  ('TRY', 'Turkish Lira',       '₺',  32.000000, TRUE),
  ('BRL', 'Brazilian Real',     'R$',  5.040000, TRUE),
  ('MXN', 'Mexican Peso',       '$',  17.200000, TRUE),
  ('CAD', 'Canadian Dollar',    'C$',  1.360000, TRUE),
  ('AUD', 'Australian Dollar',  'A$',  1.530000, TRUE),
  ('RUB', 'Russian Ruble',      '₽',  91.000000, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Default Admin User
-- NOTE: password_hash is a bcrypt (cost 12) hash of the default admin password.
-- IMPORTANT: Change this password immediately after first deployment via
-- the admin settings panel or POST /api/v1/auth/change-password.
-- ─────────────────────────────────────────────────────────────────
INSERT INTO users (
  id, email, password_hash, full_name, phone,
  role, status, email_verified, language, currency, timezone
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@globexsky.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeOpUHFKxHfqcxs8C',
  'GlobexSky Admin',
  '+1-800-000-0001',
  'admin',
  'active',
  TRUE,
  'en',
  'USD',
  'UTC'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (user_id, company_name, country, verified, verification_level)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Globex International Trade Co., Ltd.',
  'US',
  TRUE,
  'premium'
) ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Root Categories
-- ─────────────────────────────────────────────────────────────────
INSERT INTO categories (id, name, slug, sort_order, is_active) VALUES
  ('cat-00000000-0000-0001-0000-000000000001', 'Electronics',       'electronics',      1, TRUE),
  ('cat-00000000-0000-0001-0000-000000000002', 'Fashion & Apparel', 'fashion-apparel',   2, TRUE),
  ('cat-00000000-0000-0001-0000-000000000003', 'Home & Garden',     'home-garden',       3, TRUE),
  ('cat-00000000-0000-0001-0000-000000000004', 'Industrial',        'industrial',        4, TRUE),
  ('cat-00000000-0000-0001-0000-000000000005', 'Beauty & Health',   'beauty-health',     5, TRUE),
  ('cat-00000000-0000-0001-0000-000000000006', 'Sports & Outdoors', 'sports-outdoors',   6, TRUE),
  ('cat-00000000-0000-0001-0000-000000000007', 'Automotive',        'automotive',        7, TRUE),
  ('cat-00000000-0000-0001-0000-000000000008', 'Food & Agriculture','food-agriculture',  8, TRUE),
  ('cat-00000000-0000-0001-0000-000000000009', 'Toys & Gifts',      'toys-gifts',        9, TRUE),
  ('cat-00000000-0000-0001-0000-000000000010', 'Office & Stationery','office-stationery',10, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Supplier Plans
-- ─────────────────────────────────────────────────────────────────
INSERT INTO supplier_plans (name, monthly_fee, commission_rate, features, ai_marketing_budget, setup_fee, is_active) VALUES
  (
    'Basic Pro',
    15.00,
    0.08,
    '{"product_listings":50,"image_uploads":true,"analytics_basic":true,"storefront":false,"rfq_responses":5}',
    0.00,
    0.00,
    TRUE
  ),
  (
    'Professional Pro',
    38.00,
    0.06,
    '{"product_listings":500,"image_uploads":true,"analytics_advanced":true,"storefront":true,"rfq_responses":50,"verified_badge":true,"live_stream":false}',
    20.00,
    0.00,
    TRUE
  ),
  (
    'Enterprise Pro',
    98.00,
    0.04,
    '{"product_listings":-1,"image_uploads":true,"analytics_advanced":true,"storefront":true,"rfq_responses":-1,"verified_badge":true,"live_stream":true,"api_access":true,"dedicated_support":true,"custom_domain":false}',
    100.00,
    0.00,
    TRUE
  )
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Default Commission Rules
-- ─────────────────────────────────────────────────────────────────
INSERT INTO commission_rules (type, commission_rate, min_commission, max_commission, is_active) VALUES
  ('global', 0.05, 0.50, NULL, TRUE)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Shipping Rates (major routes)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO shipping_rates (destination_country, min_weight, max_weight, price_per_kg, base_fee, express_surcharge, economy_discount, is_active) VALUES
  -- USA
  ('US',  0,    5,    7.00, 12.00, 25.00, 0.10, TRUE),
  ('US',  5,    20,   6.50, 12.00, 20.00, 0.10, TRUE),
  ('US',  20,   50,   6.00, 10.00, 18.00, 0.12, TRUE),
  ('US',  50,   999,  5.50,  8.00, 15.00, 0.15, TRUE),
  -- United Kingdom
  ('GB',  0,    5,    6.00, 10.00, 20.00, 0.10, TRUE),
  ('GB',  5,    20,   5.50, 10.00, 18.00, 0.10, TRUE),
  ('GB',  20,   999,  5.00,  8.00, 15.00, 0.12, TRUE),
  -- UAE
  ('AE',  0,    5,    4.50,  8.00, 15.00, 0.08, TRUE),
  ('AE',  5,    20,   4.00,  8.00, 12.00, 0.08, TRUE),
  ('AE',  20,   999,  3.50,  6.00, 10.00, 0.10, TRUE),
  -- Germany
  ('DE',  0,    5,    5.50, 10.00, 18.00, 0.10, TRUE),
  ('DE',  5,    20,   5.00,  9.00, 16.00, 0.10, TRUE),
  ('DE',  20,   999,  4.50,  8.00, 14.00, 0.12, TRUE),
  -- China
  ('CN',  0,    5,    3.00,  5.00, 10.00, 0.05, TRUE),
  ('CN',  5,    20,   2.50,  5.00,  8.00, 0.05, TRUE),
  ('CN',  20,   999,  2.00,  4.00,  6.00, 0.08, TRUE),
  -- India
  ('IN',  0,    5,    5.00,  8.00, 15.00, 0.08, TRUE),
  ('IN',  5,    20,   4.50,  8.00, 12.00, 0.08, TRUE),
  ('IN',  20,   999,  4.00,  6.00, 10.00, 0.10, TRUE),
  -- Bangladesh
  ('BD',  0,    5,    5.50,  9.00, 15.00, 0.08, TRUE),
  ('BD',  5,    20,   5.00,  8.00, 12.00, 0.08, TRUE),
  ('BD',  20,   999,  4.50,  7.00, 10.00, 0.10, TRUE),
  -- Australia
  ('AU',  0,    5,    7.50, 12.00, 22.00, 0.10, TRUE),
  ('AU',  5,    20,   7.00, 11.00, 20.00, 0.10, TRUE),
  ('AU',  20,   999,  6.00, 10.00, 17.00, 0.12, TRUE),
  -- Canada
  ('CA',  0,    5,    7.00, 12.00, 22.00, 0.10, TRUE),
  ('CA',  5,    20,   6.50, 11.00, 20.00, 0.10, TRUE),
  ('CA',  20,   999,  5.50,  9.00, 16.00, 0.12, TRUE),
  -- Saudi Arabia
  ('SA',  0,    5,    4.50,  8.00, 15.00, 0.08, TRUE),
  ('SA',  5,    20,   4.00,  7.00, 12.00, 0.08, TRUE),
  ('SA',  20,   999,  3.50,  6.00, 10.00, 0.10, TRUE),
  -- Singapore
  ('SG',  0,    5,    4.00,  7.00, 12.00, 0.05, TRUE),
  ('SG',  5,    20,   3.50,  6.00, 10.00, 0.05, TRUE),
  ('SG',  20,   999,  3.00,  5.00,  8.00, 0.08, TRUE),
  -- Catch-all
  ('*',   0,    999,  8.00, 15.00, 30.00, 0.05, TRUE)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Loyalty Tiers
-- ─────────────────────────────────────────────────────────────────
INSERT INTO loyalty_tiers (name, min_points, benefits, is_active) VALUES
  ('Bronze',   0,     '{"discount_rate":0.01,"free_shipping_threshold":200,"priority_support":false}', TRUE),
  ('Silver',   1000,  '{"discount_rate":0.03,"free_shipping_threshold":100,"priority_support":false}', TRUE),
  ('Gold',     5000,  '{"discount_rate":0.05,"free_shipping_threshold":50,"priority_support":true}',  TRUE),
  ('Platinum', 15000, '{"discount_rate":0.08,"free_shipping_threshold":0,"priority_support":true,"personal_manager":true}', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Feature Toggles
-- ─────────────────────────────────────────────────────────────────
INSERT INTO feature_toggles (feature_name, is_enabled, description) VALUES
  ('live_streaming',       TRUE,  'Enable supplier live-streaming commerce'),
  ('ai_search',            TRUE,  'AI-powered semantic product search'),
  ('ai_chatbot',           TRUE,  'AI customer support chatbot'),
  ('carry_service',        TRUE,  'Peer-to-peer carry/delivery service'),
  ('virtual_trade_shows',  TRUE,  'Virtual trade show platform'),
  ('rfq_system',           TRUE,  'Request-for-Quotation system'),
  ('api_platform',         TRUE,  'Third-party API access platform'),
  ('loyalty_program',      TRUE,  'Customer loyalty points & tiers'),
  ('social_login',         TRUE,  'Google & Facebook OAuth login'),
  ('two_factor_auth',      FALSE, 'Two-factor authentication (2FA)'),
  ('vr_showroom',          FALSE, 'VR product showroom (experimental)'),
  ('voice_search',         FALSE, 'Voice-based product search'),
  ('drop_shipping',        TRUE,  'Drop-shipping fulfilment option'),
  ('escrow_payments',      TRUE,  'Escrow-based payment protection'),
  ('multi_currency',       TRUE,  'Multi-currency checkout'),
  ('push_notifications',   TRUE,  'Browser push notifications'),
  ('sms_notifications',    FALSE, 'SMS notifications (requires Twilio setup)'),
  ('maintenance_mode',     FALSE, 'Put the platform into maintenance mode'),
  ('new_seller_signup',    TRUE,  'Allow new supplier registrations')
ON CONFLICT (feature_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- System Settings
-- ─────────────────────────────────────────────────────────────────
INSERT INTO settings (key, value, group, type) VALUES
  -- General
  ('site_name',                 'GlobexSky',                  'general',  'string'),
  ('site_tagline',              'Global Trade, Simplified',   'general',  'string'),
  ('site_email',                'info@globexsky.com',         'general',  'string'),
  ('site_phone',                '',                           'general',  'string'),
  ('default_language',          'en',                         'general',  'string'),
  ('default_currency',          'USD',                        'general',  'string'),
  ('maintenance_message',       'We are down for maintenance. Please check back soon.', 'general', 'string'),
  -- Payments
  ('payment_mode',              'test',                       'payment',  'string'),
  ('min_order_amount',          '1',                          'payment',  'number'),
  ('max_order_amount',          '100000',                     'payment',  'number'),
  ('platform_fee_rate',         '0.02',                       'payment',  'number'),
  -- Orders
  ('auto_confirm_hours',        '24',                         'orders',   'number'),
  ('cancellation_window_hours', '2',                          'orders',   'number'),
  -- Commission
  ('default_commission_rate',   '0.05',                       'commission','number'),
  ('payout_min_amount',         '10',                         'commission','number'),
  ('payout_schedule',           'weekly',                     'commission','string'),
  -- Email
  ('email_verification_required','true',                      'auth',     'boolean'),
  ('registration_requires_approval','false',                  'auth',     'boolean'),
  -- Shipping
  ('free_shipping_threshold',   '200',                        'shipping', 'number'),
  ('max_parcel_weight_kg',      '30',                         'shipping', 'number'),
  -- Products
  ('product_approval_required', 'true',                       'products', 'boolean'),
  ('max_images_per_product',    '10',                         'products', 'number')
ON CONFLICT (key) DO NOTHING;
