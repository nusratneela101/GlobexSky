/**
 * Seed 007: Integration Config Defaults
 *
 * Inserts default platform_settings rows for all third-party services
 * and feature-toggle entries.  Every key is seeded with an empty value
 * so the admin panel can render the settings form without needing manual
 * row creation.
 *
 * Idempotent: uses INSERT … ON CONFLICT DO NOTHING via upsert with
 * ignoreDuplicates so rows already edited in production are never
 * overwritten.
 */

export async function run(supabase) {
  // ── Third-party service keys ────────────────────────────────────────────
  // Each entry produces two rows (test + live) unless mode is 'both'.
  const serviceKeys = [
    // Payments
    { category: 'stripe',       setting_key: 'STRIPE_PUBLISHABLE_KEY', is_sensitive: false },
    { category: 'stripe',       setting_key: 'STRIPE_SECRET_KEY',       is_sensitive: true  },
    { category: 'stripe',       setting_key: 'STRIPE_WEBHOOK_SECRET',   is_sensitive: true  },

    { category: 'paypal',       setting_key: 'PAYPAL_CLIENT_ID',        is_sensitive: false },
    { category: 'paypal',       setting_key: 'PAYPAL_CLIENT_SECRET',    is_sensitive: true  },

    { category: 'bkash',        setting_key: 'BKASH_APP_KEY',           is_sensitive: false },
    { category: 'bkash',        setting_key: 'BKASH_APP_SECRET',        is_sensitive: true  },
    { category: 'bkash',        setting_key: 'BKASH_USERNAME',          is_sensitive: false },
    { category: 'bkash',        setting_key: 'BKASH_PASSWORD',          is_sensitive: true  },

    { category: 'nagad',        setting_key: 'NAGAD_MERCHANT_ID',       is_sensitive: false },
    { category: 'nagad',        setting_key: 'NAGAD_MERCHANT_KEY',      is_sensitive: true  },

    { category: 'sslcommerz',   setting_key: 'SSLCOMMERZ_STORE_ID',     is_sensitive: false },
    { category: 'sslcommerz',   setting_key: 'SSLCOMMERZ_STORE_PASSWORD', is_sensitive: true },

    // Shipping
    { category: 'dhl',          setting_key: 'DHL_API_KEY',             is_sensitive: true  },
    { category: 'dhl',          setting_key: 'DHL_ACCOUNT_NUMBER',      is_sensitive: false },

    { category: 'fedex',        setting_key: 'FEDEX_API_KEY',           is_sensitive: true  },
    { category: 'fedex',        setting_key: 'FEDEX_SECRET_KEY',        is_sensitive: true  },
    { category: 'fedex',        setting_key: 'FEDEX_ACCOUNT_NUMBER',    is_sensitive: false },

    { category: 'ups',          setting_key: 'UPS_CLIENT_ID',           is_sensitive: false },
    { category: 'ups',          setting_key: 'UPS_CLIENT_SECRET',       is_sensitive: true  },
    { category: 'ups',          setting_key: 'UPS_ACCOUNT_NUMBER',      is_sensitive: false },

    // SMS / Voice
    { category: 'twilio',       setting_key: 'TWILIO_ACCOUNT_SID',      is_sensitive: false },
    { category: 'twilio',       setting_key: 'TWILIO_AUTH_TOKEN',       is_sensitive: true  },
    { category: 'twilio',       setting_key: 'TWILIO_PHONE_NUMBER',     is_sensitive: false },

    { category: 'vonage',       setting_key: 'VONAGE_API_KEY',          is_sensitive: false },
    { category: 'vonage',       setting_key: 'VONAGE_API_SECRET',       is_sensitive: true  },

    // Email
    { category: 'sendgrid',     setting_key: 'SENDGRID_API_KEY',        is_sensitive: true  },
    { category: 'sendgrid',     setting_key: 'SENDGRID_FROM_EMAIL',     is_sensitive: false },

    { category: 'mailgun',      setting_key: 'MAILGUN_API_KEY',         is_sensitive: true  },
    { category: 'mailgun',      setting_key: 'MAILGUN_DOMAIN',          is_sensitive: false },

    { category: 'ses',          setting_key: 'SES_ACCESS_KEY_ID',       is_sensitive: false },
    { category: 'ses',          setting_key: 'SES_SECRET_ACCESS_KEY',   is_sensitive: true  },
    { category: 'ses',          setting_key: 'SES_REGION',              is_sensitive: false },
    { category: 'ses',          setting_key: 'SES_FROM_EMAIL',          is_sensitive: false },

    // AI
    { category: 'openai',       setting_key: 'OPENAI_API_KEY',          is_sensitive: true  },
    { category: 'openai',       setting_key: 'OPENAI_MODEL',            is_sensitive: false },

    // Video / RTC
    { category: 'agora',        setting_key: 'AGORA_APP_ID',            is_sensitive: false },
    { category: 'agora',        setting_key: 'AGORA_APP_CERTIFICATE',   is_sensitive: true  },

    // Maps
    { category: 'google_maps',  setting_key: 'GOOGLE_MAPS_API_KEY',     is_sensitive: true  },
    { category: 'mapbox',       setting_key: 'MAPBOX_ACCESS_TOKEN',     is_sensitive: true  },

    // OAuth
    { category: 'google_oauth', setting_key: 'GOOGLE_CLIENT_ID',        is_sensitive: false },
    { category: 'google_oauth', setting_key: 'GOOGLE_CLIENT_SECRET',    is_sensitive: true  },

    { category: 'facebook_oauth', setting_key: 'FACEBOOK_APP_ID',       is_sensitive: false },
    { category: 'facebook_oauth', setting_key: 'FACEBOOK_APP_SECRET',   is_sensitive: true  },

    { category: 'github_oauth', setting_key: 'GITHUB_CLIENT_ID',        is_sensitive: false },
    { category: 'github_oauth', setting_key: 'GITHUB_CLIENT_SECRET',    is_sensitive: true  },

    // Push notifications
    { category: 'firebase',     setting_key: 'FIREBASE_PROJECT_ID',     is_sensitive: false },
    { category: 'firebase',     setting_key: 'FIREBASE_SERVER_KEY',     is_sensitive: true  },
    { category: 'firebase',     setting_key: 'FIREBASE_SENDER_ID',      is_sensitive: false },

    { category: 'onesignal',    setting_key: 'ONESIGNAL_APP_ID',        is_sensitive: false },
    { category: 'onesignal',    setting_key: 'ONESIGNAL_API_KEY',       is_sensitive: true  },

    // Storage
    { category: 'aws_s3',       setting_key: 'AWS_ACCESS_KEY_ID',       is_sensitive: false },
    { category: 'aws_s3',       setting_key: 'AWS_SECRET_ACCESS_KEY',   is_sensitive: true  },
    { category: 'aws_s3',       setting_key: 'AWS_S3_BUCKET',           is_sensitive: false },
    { category: 'aws_s3',       setting_key: 'AWS_S3_REGION',           is_sensitive: false },

    { category: 'cloudinary',   setting_key: 'CLOUDINARY_CLOUD_NAME',   is_sensitive: false },
    { category: 'cloudinary',   setting_key: 'CLOUDINARY_API_KEY',      is_sensitive: false },
    { category: 'cloudinary',   setting_key: 'CLOUDINARY_API_SECRET',   is_sensitive: true  },

    // Analytics
    { category: 'google_analytics', setting_key: 'GA_MEASUREMENT_ID',   is_sensitive: false },
    { category: 'google_analytics', setting_key: 'GA_API_SECRET',       is_sensitive: true  },

    { category: 'mixpanel',     setting_key: 'MIXPANEL_PROJECT_TOKEN',  is_sensitive: false },
    { category: 'mixpanel',     setting_key: 'MIXPANEL_API_SECRET',     is_sensitive: true  },
  ];

  // Expand each definition into test + live rows
  const settingsRows = serviceKeys.flatMap(({ category, setting_key, is_sensitive }) => [
    { category, setting_key, setting_value: '', mode: 'test', is_sensitive, is_active: true },
    { category, setting_key, setting_value: '', mode: 'live', is_sensitive, is_active: true },
  ]);

  const { error: settingsError } = await supabase
    .from('platform_settings')
    .upsert(settingsRows, { onConflict: 'category,setting_key,mode', ignoreDuplicates: true });

  if (settingsError) throw new Error(`platform_settings seed failed: ${settingsError.message}`);

  // ── Feature toggles ─────────────────────────────────────────────────────
  const features = [
    'cart',
    'checkout',
    'wishlist',
    'payments',
    'reviews',
    'chat',
    'notifications',
    'ai_recommendations',
    'barcode_scanner',
    'vr_showroom',
    'livestream',
    'flash_sales',
    'loyalty',
    'rfq',
    'dropshipping',
    'trade_finance',
    'advertising',
    'campaigns',
  ];

  const featureRows = features.map((feature) => ({
    category: 'feature_toggle',
    setting_key: feature.toUpperCase(),
    setting_value: 'true',
    mode: 'live',
    is_sensitive: false,
    is_active: true,
  }));

  const { error: featureError } = await supabase
    .from('platform_settings')
    .upsert(featureRows, { onConflict: 'category,setting_key,mode', ignoreDuplicates: true });

  if (featureError) throw new Error(`feature_toggles seed failed: ${featureError.message}`);

  console.log(
    `  ✔ Seeded: ${settingsRows.length} integration-config rows, ${featureRows.length} feature toggles`,
  );
}
