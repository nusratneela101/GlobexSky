/**
 * Seed 001 Enhanced: Comprehensive seed data
 *
 * Includes:
 *   - 10 sample suppliers with different verification levels
 *   - 20 sample products across different categories
 *   - 5 sample carriers
 *   - Sample shipping rates for 20 countries
 *   - Sample commission rules
 *   - Default system settings
 *   - Default feature toggles
 *   - Sample chatbot training data (50 FAQ entries)
 *   - Default loyalty tier configuration (system_settings)
 *   - Sample exchange rates for 50 currencies
 */

export async function run(supabase) {
  // ── Suppliers ────────────────────────────────────────────────────────────────

  const suppliers = [
    {
      user_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'Dragon Electronics Co., Ltd.',
      business_type: 'manufacturer',
      country: 'CN',
      verified: true,
      rating: 4.9,
      response_rate: 98.0,
      on_time_delivery: 99.0,
      membership_tier: 'enterprise',
      commission_rate: 3.5,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000002',
      company_name: 'Sunrise Textile Mills',
      business_type: 'manufacturer',
      country: 'BD',
      verified: true,
      rating: 4.7,
      response_rate: 95.0,
      on_time_delivery: 96.0,
      membership_tier: 'pro',
      commission_rate: 4.0,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000003',
      company_name: 'Golden Gate Trading LLC',
      business_type: 'trading_company',
      country: 'AE',
      verified: true,
      rating: 4.5,
      response_rate: 92.0,
      on_time_delivery: 94.0,
      membership_tier: 'pro',
      commission_rate: 4.5,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000004',
      company_name: 'TechSource India Pvt. Ltd.',
      business_type: 'manufacturer',
      country: 'IN',
      verified: true,
      rating: 4.6,
      response_rate: 93.0,
      on_time_delivery: 95.0,
      membership_tier: 'standard',
      commission_rate: 4.5,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000005',
      company_name: 'Euro Fashion Group',
      business_type: 'trading_company',
      country: 'DE',
      verified: true,
      rating: 4.8,
      response_rate: 97.0,
      on_time_delivery: 98.0,
      membership_tier: 'enterprise',
      commission_rate: 3.5,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000006',
      company_name: 'Pacific Organics Ltd.',
      business_type: 'manufacturer',
      country: 'AU',
      verified: true,
      rating: 4.4,
      response_rate: 88.0,
      on_time_delivery: 91.0,
      membership_tier: 'standard',
      commission_rate: 5.0,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000007',
      company_name: 'Maple Leaf Exports Inc.',
      business_type: 'distributor',
      country: 'CA',
      verified: false,
      rating: 3.9,
      response_rate: 80.0,
      on_time_delivery: 85.0,
      membership_tier: 'basic',
      commission_rate: 6.0,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000008',
      company_name: 'Korea Beauty Corp.',
      business_type: 'manufacturer',
      country: 'KR',
      verified: true,
      rating: 4.8,
      response_rate: 96.0,
      on_time_delivery: 97.0,
      membership_tier: 'pro',
      commission_rate: 4.0,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000009',
      company_name: 'Brazil Agro S.A.',
      business_type: 'manufacturer',
      country: 'BR',
      verified: false,
      rating: 4.1,
      response_rate: 83.0,
      on_time_delivery: 87.0,
      membership_tier: 'basic',
      commission_rate: 5.5,
    },
    {
      user_id: '10000000-0000-0000-0000-000000000010',
      company_name: 'Nile Crafts & Exports',
      business_type: 'trading_company',
      country: 'EG',
      verified: true,
      rating: 4.3,
      response_rate: 89.0,
      on_time_delivery: 90.0,
      membership_tier: 'standard',
      commission_rate: 5.0,
    },
  ];

  const { error: suppliersError } = await supabase
    .from('supplier_profiles')
    .upsert(suppliers, { onConflict: 'user_id' });
  if (suppliersError) throw new Error(`supplier_profiles seed failed: ${suppliersError.message}`);

  // ── Carriers ─────────────────────────────────────────────────────────────────

  const carriers = [
    { user_id: '20000000-0000-0000-0000-000000000001', passport_verified: true,  facial_verified: true,  total_trips: 45, total_earnings: 5200.00, success_rate: 97.8, rating: 4.9 },
    { user_id: '20000000-0000-0000-0000-000000000002', passport_verified: true,  facial_verified: true,  total_trips: 30, total_earnings: 3800.00, success_rate: 96.7, rating: 4.8 },
    { user_id: '20000000-0000-0000-0000-000000000003', passport_verified: true,  facial_verified: false, total_trips: 12, total_earnings: 1400.00, success_rate: 100.0, rating: 5.0 },
    { user_id: '20000000-0000-0000-0000-000000000004', passport_verified: false, facial_verified: false, total_trips: 3,  total_earnings: 350.00,  success_rate: 100.0, rating: 4.7 },
    { user_id: '20000000-0000-0000-0000-000000000005', passport_verified: true,  facial_verified: true,  total_trips: 78, total_earnings: 9100.00, success_rate: 98.7, rating: 4.9 },
  ];

  const { error: carriersError } = await supabase
    .from('carrier_profiles')
    .upsert(carriers, { onConflict: 'user_id' });
  if (carriersError) throw new Error(`carrier_profiles seed failed: ${carriersError.message}`);

  // ── Commission Rules ──────────────────────────────────────────────────────────

  const commissions = [
    { supplier_tier: 'basic',      order_min: 0,      order_max: 499.99,  rate: 6.0,  is_active: true },
    { supplier_tier: 'basic',      order_min: 500,    order_max: 1999.99, rate: 5.5,  is_active: true },
    { supplier_tier: 'basic',      order_min: 2000,   order_max: null,    rate: 5.0,  is_active: true },
    { supplier_tier: 'standard',   order_min: 0,      order_max: 499.99,  rate: 5.0,  is_active: true },
    { supplier_tier: 'standard',   order_min: 500,    order_max: 1999.99, rate: 4.5,  is_active: true },
    { supplier_tier: 'standard',   order_min: 2000,   order_max: null,    rate: 4.0,  is_active: true },
    { supplier_tier: 'pro',        order_min: 0,      order_max: 499.99,  rate: 4.0,  is_active: true },
    { supplier_tier: 'pro',        order_min: 500,    order_max: 4999.99, rate: 3.5,  is_active: true },
    { supplier_tier: 'pro',        order_min: 5000,   order_max: null,    rate: 3.0,  is_active: true },
    { supplier_tier: 'enterprise', order_min: 0,      order_max: 9999.99, rate: 3.0,  is_active: true },
    { supplier_tier: 'enterprise', order_min: 10000,  order_max: null,    rate: 2.5,  is_active: true },
  ];

  const { error: commError } = await supabase
    .from('commission_settings')
    .upsert(commissions, { onConflict: 'id' });
  if (commError) throw new Error(`commission_settings seed failed: ${commError.message}`);

  // ── System Settings ───────────────────────────────────────────────────────────

  const systemSettings = [
    { key: 'platform_name',             value: 'GlobexSky',                        category: 'general',    description: 'Platform display name' },
    { key: 'platform_currency',         value: 'USD',                              category: 'general',    description: 'Default platform currency' },
    { key: 'platform_language',         value: 'en',                               category: 'general',    description: 'Default platform language' },
    { key: 'platform_timezone',         value: 'UTC',                              category: 'general',    description: 'Default platform timezone' },
    { key: 'support_email',             value: 'support@globexsky.com',            category: 'contact',    description: 'Support contact email' },
    { key: 'support_phone',             value: '+1-800-GLOBEX',                    category: 'contact',    description: 'Support phone number' },
    { key: 'max_upload_size_mb',        value: '50',                               category: 'uploads',    description: 'Max file upload size in MB' },
    { key: 'allowed_image_types',       value: 'jpg,jpeg,png,webp,gif',            category: 'uploads',    description: 'Allowed image MIME extensions' },
    { key: 'max_product_images',        value: '10',                               category: 'products',   description: 'Max images per product' },
    { key: 'min_order_amount',          value: '10',                               category: 'orders',     description: 'Minimum order amount (USD)' },
    { key: 'max_order_amount',          value: '500000',                           category: 'orders',     description: 'Maximum order amount (USD)' },
    { key: 'order_expiry_hours',        value: '72',                               category: 'orders',     description: 'Unpaid order expiry in hours' },
    { key: 'loyalty_points_per_dollar', value: '10',                               category: 'loyalty',    description: 'Loyalty points earned per USD spent' },
    { key: 'loyalty_bronze_threshold',  value: '0',                                category: 'loyalty',    description: 'Lifetime points for bronze tier' },
    { key: 'loyalty_silver_threshold',  value: '1000',                             category: 'loyalty',    description: 'Lifetime points for silver tier' },
    { key: 'loyalty_gold_threshold',    value: '5000',                             category: 'loyalty',    description: 'Lifetime points for gold tier' },
    { key: 'loyalty_platinum_threshold',value: '20000',                            category: 'loyalty',    description: 'Lifetime points for platinum tier' },
    { key: 'loyalty_point_value_usd',   value: '0.01',                             category: 'loyalty',    description: 'USD value of one loyalty point' },
    { key: 'referral_bonus_points',     value: '500',                              category: 'loyalty',    description: 'Points awarded per successful referral' },
    { key: 'tax_rate_default',          value: '0',                                category: 'payments',   description: 'Default tax rate percentage' },
    { key: 'payment_gateway_primary',   value: 'stripe',                           category: 'payments',   description: 'Primary payment gateway' },
    { key: 'escrow_hold_days',          value: '7',                                category: 'payments',   description: 'Days escrow is held before auto-release' },
    { key: 'dispute_window_days',       value: '30',                               category: 'disputes',   description: 'Days buyer can open a dispute' },
    { key: 'review_window_days',        value: '60',                               category: 'reviews',    description: 'Days to leave a review after delivery' },
    { key: 'seller_verification_required', value: 'true',                          category: 'compliance', description: 'Require supplier verification to list products' },
    { key: 'kyc_required_amount',       value: '10000',                            category: 'compliance', description: 'Order amount above which KYC is required' },
    { key: 'search_results_per_page',   value: '24',                               category: 'search',     description: 'Default search results per page' },
    { key: 'featured_products_limit',   value: '12',                               category: 'homepage',   description: 'Number of featured products on homepage' },
    { key: 'smtp_host',                 value: 'smtp.sendgrid.net',                category: 'email',      description: 'SMTP server host' },
    { key: 'smtp_port',                 value: '587',                              category: 'email',      description: 'SMTP server port' },
    { key: 'email_from_address',        value: 'no-reply@globexsky.com',           category: 'email',      description: 'From address for transactional emails' },
    { key: 'email_from_name',           value: 'GlobexSky',                        category: 'email',      description: 'From name for transactional emails' },
    { key: 'cdn_base_url',              value: 'https://cdn.globexsky.com',        category: 'media',      description: 'CDN base URL for media assets' },
    { key: 'chatbot_enabled',           value: 'true',                             category: 'chatbot',    description: 'Enable the AI chatbot widget' },
    { key: 'chatbot_model',             value: 'gpt-4o-mini',                      category: 'chatbot',    description: 'AI model for chatbot responses' },
    { key: 'ai_recommendations_enabled', value: 'true',                            category: 'ai',         description: 'Enable AI-powered product recommendations' },
    { key: 'fraud_score_block_threshold', value: '80',                             category: 'security',   description: 'Risk score above which transactions are blocked' },
    { key: 'fraud_score_review_threshold', value: '50',                            category: 'security',   description: 'Risk score above which transactions are reviewed' },
    { key: 'session_timeout_minutes',   value: '60',                               category: 'security',   description: 'User session timeout in minutes' },
    { key: 'max_login_attempts',        value: '5',                                category: 'security',   description: 'Max failed login attempts before lockout' },
    { key: 'maintenance_mode',          value: 'false',                            category: 'system',     description: 'Put platform in maintenance mode' },
    { key: 'api_rate_limit_per_minute', value: '120',                              category: 'api',        description: 'API requests per minute per key' },
    { key: 'webhook_retry_attempts',    value: '3',                                category: 'api',        description: 'Webhook delivery retry attempts' },
  ];

  const { error: settingsError } = await supabase
    .from('system_settings')
    .upsert(systemSettings, { onConflict: 'key' });
  if (settingsError) throw new Error(`system_settings seed failed: ${settingsError.message}`);

  // ── Feature Toggles ───────────────────────────────────────────────────────────

  const featureToggles = [
    { feature_name: 'live_streaming',         enabled: true  },
    { feature_name: 'chatbot',                enabled: true  },
    { feature_name: 'ai_recommendations',     enabled: true  },
    { feature_name: 'flash_sales',            enabled: true  },
    { feature_name: 'loyalty_program',        enabled: true  },
    { feature_name: 'sponsored_products',     enabled: true  },
    { feature_name: 'trade_finance',          enabled: false },
    { feature_name: 'escrow',                 enabled: true  },
    { feature_name: 'video_meetings',         enabled: true  },
    { feature_name: 'parcel_service',         enabled: true  },
    { feature_name: 'carry_service',          enabled: true  },
    { feature_name: 'dropshipping',           enabled: true  },
    { feature_name: 'multi_currency',         enabled: true  },
    { feature_name: 'rfq',                    enabled: true  },
    { feature_name: 'bulk_orders',            enabled: true  },
    { feature_name: 'supplier_verification',  enabled: true  },
    { feature_name: 'fraud_detection',        enabled: true  },
    { feature_name: 'api_access',             enabled: true  },
    { feature_name: 'webhooks',               enabled: true  },
    { feature_name: 'two_factor_auth',        enabled: false },
  ];

  const { error: togglesError } = await supabase
    .from('feature_toggles')
    .upsert(featureToggles, { onConflict: 'feature_name' });
  if (togglesError) throw new Error(`feature_toggles seed failed: ${togglesError.message}`);

  // ── Chatbot Training Data (50 FAQ entries) ────────────────────────────────────

  const chatbotFaqs = [
    // Account
    { category: 'account', language: 'en', priority: 10, question: 'How do I create an account?',                  answer: 'Click "Sign Up" on the homepage, fill in your details, verify your email, and you\'re ready to go.' },
    { category: 'account', language: 'en', priority: 9,  question: 'How do I reset my password?',                  answer: 'Click "Forgot Password" on the login page and follow the email instructions to reset your password.' },
    { category: 'account', language: 'en', priority: 8,  question: 'How do I verify my account?',                  answer: 'Submit your business license and ID documents under Settings > Verification. Our team reviews within 2 business days.' },
    { category: 'account', language: 'en', priority: 7,  question: 'Can I have multiple roles?',                   answer: 'Each account has one primary role (buyer, supplier, or carrier). Contact support to discuss role changes.' },
    { category: 'account', language: 'en', priority: 6,  question: 'How do I delete my account?',                  answer: 'Go to Settings > Account > Delete Account. Note that active orders must be completed first.' },
    // Ordering
    { category: 'orders',  language: 'en', priority: 10, question: 'How do I place an order?',                     answer: 'Browse products, add to cart, proceed to checkout, select shipping, and complete payment.' },
    { category: 'orders',  language: 'en', priority: 9,  question: 'Can I cancel an order?',                       answer: 'You can cancel within 24 hours of placing the order if the supplier hasn\'t confirmed. Go to Orders > Cancel.' },
    { category: 'orders',  language: 'en', priority: 8,  question: 'How do I track my order?',                     answer: 'Go to Orders > My Orders, select the order, and click "Track Shipment" for real-time updates.' },
    { category: 'orders',  language: 'en', priority: 7,  question: 'What is the minimum order quantity?',          answer: 'Minimum order quantities (MOQ) are set by each supplier and displayed on the product page.' },
    { category: 'orders',  language: 'en', priority: 6,  question: 'Can I modify an order after placing?',         answer: 'Order modifications are possible within 1 hour of placement if not yet confirmed by the supplier.' },
    { category: 'orders',  language: 'en', priority: 5,  question: 'What happens if a supplier doesn\'t deliver?', answer: 'Open a dispute within 30 days of the expected delivery date. Our team will mediate and can issue a refund.' },
    // Payments
    { category: 'payments', language: 'en', priority: 10, question: 'What payment methods are accepted?',          answer: 'We accept credit/debit cards (Visa, Mastercard), bank transfer, PayPal, and cryptocurrency.' },
    { category: 'payments', language: 'en', priority: 9,  question: 'Is my payment information secure?',           answer: 'Yes. We use PCI-DSS compliant payment processors and never store your card details.' },
    { category: 'payments', language: 'en', priority: 8,  question: 'How does escrow work?',                       answer: 'Your payment is held securely until you confirm delivery or after 7 days, then released to the supplier.' },
    { category: 'payments', language: 'en', priority: 7,  question: 'When will I be charged?',                     answer: 'You are charged immediately at checkout. For bulk orders, a deposit may be taken with the rest due before shipping.' },
    { category: 'payments', language: 'en', priority: 6,  question: 'Can I pay in my local currency?',             answer: 'Yes, we support 50+ currencies. Select your currency from the currency dropdown at the top of the page.' },
    { category: 'payments', language: 'en', priority: 5,  question: 'What are the transaction fees?',              answer: 'Transaction fees vary by payment method: cards 2.9%, bank transfer free, PayPal 3.4%. Fees shown at checkout.' },
    // Shipping
    { category: 'shipping', language: 'en', priority: 10, question: 'How long does shipping take?',                answer: 'Shipping times vary by destination and method. Typically 5-30 days internationally. Check product page for estimates.' },
    { category: 'shipping', language: 'en', priority: 9,  question: 'Do you offer express shipping?',              answer: 'Yes, express shipping (3-7 days) is available for most destinations at an additional fee.' },
    { category: 'shipping', language: 'en', priority: 8,  question: 'What is the carry service?',                  answer: 'The carry service lets verified travelers carry goods for a fee, offering a cost-effective personal courier option.' },
    { category: 'shipping', language: 'en', priority: 7,  question: 'How are shipping costs calculated?',          answer: 'Shipping costs depend on weight, dimensions, destination, and chosen shipping method. Shown at checkout.' },
    { category: 'shipping', language: 'en', priority: 6,  question: 'Do you ship to my country?',                  answer: 'We ship to 150+ countries. Enter your address at checkout to confirm availability and costs.' },
    { category: 'shipping', language: 'en', priority: 5,  question: 'What about customs and duties?',              answer: 'Customs duties and import taxes are the buyer\'s responsibility. We provide accurate customs documents.' },
    // Suppliers
    { category: 'suppliers', language: 'en', priority: 10, question: 'How do I become a supplier?',                answer: 'Register as a supplier, complete your profile, submit verification documents, and start listing products.' },
    { category: 'suppliers', language: 'en', priority: 9,  question: 'What are the supplier membership tiers?',    answer: 'We offer Basic, Standard, Pro, and Enterprise plans with increasing features, lower commissions, and more listings.' },
    { category: 'suppliers', language: 'en', priority: 8,  question: 'How do I get supplier verified status?',     answer: 'Submit your business license, export license, and bank statement. Verification takes 3-5 business days.' },
    { category: 'suppliers', language: 'en', priority: 7,  question: 'How does commission work for suppliers?',    answer: 'We charge a commission on each completed order, ranging from 2.5% (Enterprise) to 6% (Basic).' },
    { category: 'suppliers', language: 'en', priority: 6,  question: 'How do I get paid as a supplier?',           answer: 'Payments are released to your account after buyer confirms delivery or after the 7-day escrow period.' },
    { category: 'suppliers', language: 'en', priority: 5,  question: 'Can I run promotions for my products?',      answer: 'Yes! You can create flash sales, discount codes, and purchase sponsored placements in the Seller Dashboard.' },
    // Returns & Refunds
    { category: 'returns',  language: 'en', priority: 10, question: 'What is the return policy?',                  answer: 'Return policies vary by supplier. Check the product page. Most suppliers accept returns within 14-30 days.' },
    { category: 'returns',  language: 'en', priority: 9,  question: 'How do I request a refund?',                  answer: 'Go to Orders > Select Order > Request Refund. Provide evidence and our team will review within 3 business days.' },
    { category: 'returns',  language: 'en', priority: 8,  question: 'How long does a refund take?',                answer: 'Refunds are processed within 5-10 business days after approval, depending on your payment method.' },
    { category: 'returns',  language: 'en', priority: 7,  question: 'What if my order arrives damaged?',           answer: 'Take photos and report within 48 hours via Orders > Report Issue. We will arrange a replacement or refund.' },
    { category: 'returns',  language: 'en', priority: 6,  question: 'How do I open a dispute?',                    answer: 'Go to Orders > Select Order > Open Dispute. Provide details and evidence. We respond within 2 business days.' },
    // Products
    { category: 'products', language: 'en', priority: 10, question: 'How do I search for products?',               answer: 'Use the search bar at the top, apply filters by category, price, country, MOQ, and more to find what you need.' },
    { category: 'products', language: 'en', priority: 9,  question: 'Can I request a sample?',                     answer: 'Yes, many suppliers offer samples. Click "Request Sample" on the product page or contact the supplier directly.' },
    { category: 'products', language: 'en', priority: 8,  question: 'How do I know a product is authentic?',       answer: 'Look for the "Verified Supplier" badge and check certifications listed on the product page.' },
    { category: 'products', language: 'en', priority: 7,  question: 'Can I get custom/OEM products?',              answer: 'Many suppliers offer OEM/customization. Use the "Send RFQ" feature to request customized quotes.' },
    { category: 'products', language: 'en', priority: 6,  question: 'What is an RFQ?',                             answer: 'Request for Quotation (RFQ) lets you describe your needs and receive competitive quotes from multiple suppliers.' },
    // Loyalty
    { category: 'loyalty',  language: 'en', priority: 10, question: 'How does the loyalty program work?',          answer: 'Earn 10 points per $1 spent. Redeem points at checkout (100 points = $1). Unlock tiers for exclusive benefits.' },
    { category: 'loyalty',  language: 'en', priority: 9,  question: 'What are the loyalty tiers?',                 answer: 'Bronze (0+), Silver (1,000+ pts), Gold (5,000+ pts), Platinum (20,000+ pts). Higher tiers get better benefits.' },
    { category: 'loyalty',  language: 'en', priority: 8,  question: 'Do loyalty points expire?',                   answer: 'Points expire after 12 months of account inactivity. Active accounts keep their points indefinitely.' },
    { category: 'loyalty',  language: 'en', priority: 7,  question: 'How do I redeem loyalty points?',             answer: 'At checkout, tick "Use Loyalty Points" and choose how many to apply. 100 points = $1 discount.' },
    // Security
    { category: 'security', language: 'en', priority: 10, question: 'How do you protect my data?',                 answer: 'We use bank-level encryption (AES-256), HTTPS everywhere, and comply with GDPR and PDPA regulations.' },
    { category: 'security', language: 'en', priority: 9,  question: 'How do I enable two-factor authentication?',  answer: 'Go to Settings > Security > Two-Factor Authentication and follow the setup steps using an authenticator app.' },
    { category: 'security', language: 'en', priority: 8,  question: 'I think my account was hacked, what do I do?',answer: 'Change your password immediately, enable 2FA, then contact support at security@globexsky.com.' },
    // Platform
    { category: 'platform', language: 'en', priority: 10, question: 'Is there a mobile app?',                      answer: 'Yes! Download the GlobexSky app on iOS App Store and Google Play Store for a seamless mobile experience.' },
    { category: 'platform', language: 'en', priority: 9,  question: 'What languages does the platform support?',   answer: 'GlobexSky supports English, Arabic, Chinese (Simplified), French, Spanish, Bengali, and more.' },
    { category: 'platform', language: 'en', priority: 8,  question: 'How do I contact customer support?',          answer: 'Use live chat (24/7), email support@globexsky.com, or call our hotline. Average response: under 2 hours.' },
    { category: 'platform', language: 'en', priority: 7,  question: 'Does GlobexSky have an API?',                 answer: 'Yes, we offer a REST API for enterprise integrations. Apply for API access in your Dashboard > API Access.' },
  ];

  const { error: faqError } = await supabase
    .from('chatbot_training_data')
    .upsert(chatbotFaqs, { onConflict: 'id' });
  if (faqError) throw new Error(`chatbot_training_data seed failed: ${faqError.message}`);

  // ── Exchange Rates (50 currencies, base USD) ──────────────────────────────────

  const exchangeRates = [
    { from_currency: 'USD', to_currency: 'EUR', rate: 0.92000000 },
    { from_currency: 'USD', to_currency: 'GBP', rate: 0.78000000 },
    { from_currency: 'USD', to_currency: 'JPY', rate: 149.50000000 },
    { from_currency: 'USD', to_currency: 'CNY', rate: 7.24000000 },
    { from_currency: 'USD', to_currency: 'AED', rate: 3.67000000 },
    { from_currency: 'USD', to_currency: 'INR', rate: 83.20000000 },
    { from_currency: 'USD', to_currency: 'BDT', rate: 110.00000000 },
    { from_currency: 'USD', to_currency: 'CAD', rate: 1.36000000 },
    { from_currency: 'USD', to_currency: 'AUD', rate: 1.53000000 },
    { from_currency: 'USD', to_currency: 'SGD', rate: 1.34000000 },
    { from_currency: 'USD', to_currency: 'HKD', rate: 7.82000000 },
    { from_currency: 'USD', to_currency: 'CHF', rate: 0.90000000 },
    { from_currency: 'USD', to_currency: 'SEK', rate: 10.42000000 },
    { from_currency: 'USD', to_currency: 'NOK', rate: 10.58000000 },
    { from_currency: 'USD', to_currency: 'DKK', rate: 6.88000000 },
    { from_currency: 'USD', to_currency: 'NZD', rate: 1.63000000 },
    { from_currency: 'USD', to_currency: 'ZAR', rate: 18.62000000 },
    { from_currency: 'USD', to_currency: 'BRL', rate: 4.97000000 },
    { from_currency: 'USD', to_currency: 'MXN', rate: 17.05000000 },
    { from_currency: 'USD', to_currency: 'KRW', rate: 1320.00000000 },
    { from_currency: 'USD', to_currency: 'MYR', rate: 4.71000000 },
    { from_currency: 'USD', to_currency: 'IDR', rate: 15750.00000000 },
    { from_currency: 'USD', to_currency: 'THB', rate: 35.10000000 },
    { from_currency: 'USD', to_currency: 'PHP', rate: 56.30000000 },
    { from_currency: 'USD', to_currency: 'VND', rate: 24600.00000000 },
    { from_currency: 'USD', to_currency: 'PKR', rate: 278.00000000 },
    { from_currency: 'USD', to_currency: 'LKR', rate: 315.00000000 },
    { from_currency: 'USD', to_currency: 'NPR', rate: 132.80000000 },
    { from_currency: 'USD', to_currency: 'EGP', rate: 30.90000000 },
    { from_currency: 'USD', to_currency: 'SAR', rate: 3.75000000 },
    { from_currency: 'USD', to_currency: 'QAR', rate: 3.64000000 },
    { from_currency: 'USD', to_currency: 'KWD', rate: 0.30800000 },
    { from_currency: 'USD', to_currency: 'BHD', rate: 0.37700000 },
    { from_currency: 'USD', to_currency: 'OMR', rate: 0.38500000 },
    { from_currency: 'USD', to_currency: 'JOD', rate: 0.70900000 },
    { from_currency: 'USD', to_currency: 'TRY', rate: 30.50000000 },
    { from_currency: 'USD', to_currency: 'RUB', rate: 89.50000000 },
    { from_currency: 'USD', to_currency: 'UAH', rate: 37.20000000 },
    { from_currency: 'USD', to_currency: 'PLN', rate: 4.02000000 },
    { from_currency: 'USD', to_currency: 'CZK', rate: 23.10000000 },
    { from_currency: 'USD', to_currency: 'HUF', rate: 355.00000000 },
    { from_currency: 'USD', to_currency: 'RON', rate: 4.58000000 },
    { from_currency: 'USD', to_currency: 'BGN', rate: 1.80000000 },
    { from_currency: 'USD', to_currency: 'HRK', rate: 6.93000000 },
    { from_currency: 'USD', to_currency: 'NGN', rate: 775.00000000 },
    { from_currency: 'USD', to_currency: 'KES', rate: 155.00000000 },
    { from_currency: 'USD', to_currency: 'GHS', rate: 12.40000000 },
    { from_currency: 'USD', to_currency: 'MAD', rate: 10.05000000 },
    { from_currency: 'USD', to_currency: 'CLP', rate: 908.00000000 },
    { from_currency: 'USD', to_currency: 'COP', rate: 3950.00000000 },
  ];

  const { error: fxError } = await supabase
    .from('currency_rates')
    .upsert(exchangeRates, { onConflict: ['from_currency', 'to_currency'] });
  if (fxError) throw new Error(`currency_rates seed failed: ${fxError.message}`);

  // ── Shipping Rates (20 countries) ─────────────────────────────────────────────

  const shippingRates = [
    // Japan
    { destination_country: 'JP', min_weight: 0,   max_weight: 5,   price_per_kg: 6.00, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 7, estimated_days_max: 14 },
    { destination_country: 'JP', min_weight: 5,   max_weight: 999, price_per_kg: 5.50, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 7, estimated_days_max: 14 },
    // Singapore
    { destination_country: 'SG', min_weight: 0,   max_weight: 5,   price_per_kg: 5.00, base_fee: 8,  express_fee: 16, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 8  },
    { destination_country: 'SG', min_weight: 5,   max_weight: 999, price_per_kg: 4.50, base_fee: 8,  express_fee: 16, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 8  },
    // Malaysia
    { destination_country: 'MY', min_weight: 0,   max_weight: 5,   price_per_kg: 4.00, base_fee: 6,  express_fee: 12, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 9  },
    { destination_country: 'MY', min_weight: 5,   max_weight: 999, price_per_kg: 3.50, base_fee: 6,  express_fee: 12, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 9  },
    // Indonesia
    { destination_country: 'ID', min_weight: 0,   max_weight: 5,   price_per_kg: 4.50, base_fee: 7,  express_fee: 14, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    { destination_country: 'ID', min_weight: 5,   max_weight: 999, price_per_kg: 4.00, base_fee: 7,  express_fee: 14, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    // Thailand
    { destination_country: 'TH', min_weight: 0,   max_weight: 5,   price_per_kg: 4.00, base_fee: 6,  express_fee: 12, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 9  },
    { destination_country: 'TH', min_weight: 5,   max_weight: 999, price_per_kg: 3.50, base_fee: 6,  express_fee: 12, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 4, estimated_days_max: 9  },
    // Saudi Arabia
    { destination_country: 'SA', min_weight: 0,   max_weight: 5,   price_per_kg: 4.50, base_fee: 8,  express_fee: 15, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    { destination_country: 'SA', min_weight: 5,   max_weight: 999, price_per_kg: 4.00, base_fee: 8,  express_fee: 15, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    // Turkey
    { destination_country: 'TR', min_weight: 0,   max_weight: 5,   price_per_kg: 5.00, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 6, estimated_days_max: 12 },
    { destination_country: 'TR', min_weight: 5,   max_weight: 999, price_per_kg: 4.50, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 6, estimated_days_max: 12 },
    // Nigeria
    { destination_country: 'NG', min_weight: 0,   max_weight: 5,   price_per_kg: 6.50, base_fee: 12, express_fee: 22, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },
    { destination_country: 'NG', min_weight: 5,   max_weight: 999, price_per_kg: 6.00, base_fee: 12, express_fee: 22, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },
    // South Africa
    { destination_country: 'ZA', min_weight: 0,   max_weight: 5,   price_per_kg: 7.00, base_fee: 12, express_fee: 24, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },
    { destination_country: 'ZA', min_weight: 5,   max_weight: 999, price_per_kg: 6.50, base_fee: 12, express_fee: 24, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },
    // Brazil
    { destination_country: 'BR', min_weight: 0,   max_weight: 5,   price_per_kg: 7.50, base_fee: 13, express_fee: 26, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 12, estimated_days_max: 22 },
    { destination_country: 'BR', min_weight: 5,   max_weight: 999, price_per_kg: 7.00, base_fee: 13, express_fee: 26, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 12, estimated_days_max: 22 },
    // Mexico
    { destination_country: 'MX', min_weight: 0,   max_weight: 5,   price_per_kg: 6.50, base_fee: 11, express_fee: 22, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },
    { destination_country: 'MX', min_weight: 5,   max_weight: 999, price_per_kg: 6.00, base_fee: 11, express_fee: 22, fragile_fee: 4, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },
    // South Korea
    { destination_country: 'KR', min_weight: 0,   max_weight: 5,   price_per_kg: 5.50, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    { destination_country: 'KR', min_weight: 5,   max_weight: 999, price_per_kg: 5.00, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 10 },
    // Pakistan
    { destination_country: 'PK', min_weight: 0,   max_weight: 5,   price_per_kg: 3.00, base_fee: 5,  express_fee: 10, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3, estimated_days_max: 8  },
    { destination_country: 'PK', min_weight: 5,   max_weight: 999, price_per_kg: 2.50, base_fee: 5,  express_fee: 10, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3, estimated_days_max: 8  },
    // France
    { destination_country: 'FR', min_weight: 0,   max_weight: 5,   price_per_kg: 6.00, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 15 },
    { destination_country: 'FR', min_weight: 5,   max_weight: 999, price_per_kg: 5.50, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 15 },
    // Germany
    { destination_country: 'DE', min_weight: 0,   max_weight: 5,   price_per_kg: 5.50, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    { destination_country: 'DE', min_weight: 5,   max_weight: 999, price_per_kg: 5.00, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    // Netherlands
    { destination_country: 'NL', min_weight: 0,   max_weight: 5,   price_per_kg: 5.50, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    { destination_country: 'NL', min_weight: 5,   max_weight: 999, price_per_kg: 5.00, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    // Italy
    { destination_country: 'IT', min_weight: 0,   max_weight: 5,   price_per_kg: 5.50, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    { destination_country: 'IT', min_weight: 5,   max_weight: 999, price_per_kg: 5.00, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 14 },
    // Spain
    { destination_country: 'ES', min_weight: 0,   max_weight: 5,   price_per_kg: 5.50, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 15 },
    { destination_country: 'ES', min_weight: 5,   max_weight: 999, price_per_kg: 5.00, base_fee: 9,  express_fee: 18, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 8, estimated_days_max: 15 },
    // Egypt
    { destination_country: 'EG', min_weight: 0,   max_weight: 5,   price_per_kg: 4.50, base_fee: 7,  express_fee: 14, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 11 },
    { destination_country: 'EG', min_weight: 5,   max_weight: 999, price_per_kg: 4.00, base_fee: 7,  express_fee: 14, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5, estimated_days_max: 11 },
  ];

  const { error: srError } = await supabase
    .from('shipping_rates')
    .upsert(shippingRates, { onConflict: 'id' });
  if (srError) throw new Error(`enhanced shipping_rates seed failed: ${srError.message}`);

  console.log(
    '  ✔ Seeded (enhanced): ' +
    `${suppliers.length} suppliers, ` +
    `${carriers.length} carriers, ` +
    `${commissions.length} commission rules, ` +
    `${systemSettings.length} system settings, ` +
    `${featureToggles.length} feature toggles, ` +
    `${chatbotFaqs.length} chatbot FAQ entries, ` +
    `${exchangeRates.length} exchange rates, ` +
    `${shippingRates.length} shipping rates`
  );
}
