/**
 * backend/routes/config.routes.js
 * Public configuration endpoint.
 *
 * GET /api/v1/config/public
 *   Returns non-sensitive public config that the frontend needs at runtime.
 *   Reads from the platform_settings DB table first (dynamicConfig), falling
 *   back to environment variables so the server still works without DB settings.
 *   NEVER exposes secret keys.
 */

import { Router } from 'express';
import env from '../config/env.js';
import { getConfig, getActiveMode } from '../config/dynamicConfig.js';

const router = Router();

/**
 * GET /public
 * Returns public (non-sensitive) runtime configuration for the frontend.
 */
router.get('/public', async (_req, res) => {
  // Resolve values from DB first, fall back to env
  const [
    supabaseUrl,
    supabaseAnonKey,
    stripePublishableKey,
    agoraAppId,
    cloudinaryCloudName,
    defaultCurrency,
    defaultLanguage,
    mode,
  ] = await Promise.all([
    getConfig('SUPABASE_URL',              'supabase').then(v => v || env.supabase.url),
    getConfig('SUPABASE_ANON_KEY',         'supabase').then(v => v || env.supabase.anonKey),
    getConfig('STRIPE_PUBLISHABLE_KEY',    'stripe').then(v => v || env.stripe.publishableKey),
    getConfig('AGORA_APP_ID',              'agora').then(v => v || env.agora.appId),
    getConfig('CLOUDINARY_CLOUD_NAME',     'general').then(v => v || env.cloudinary.cloudName),
    getConfig('DEFAULT_CURRENCY',          'general').then(v => v || process.env.DEFAULT_CURRENCY || 'USD'),
    getConfig('DEFAULT_LANGUAGE',          'general').then(v => v || process.env.DEFAULT_LANGUAGE || 'en'),
    getActiveMode(),
  ]);

  res.json({
    success: true,
    data: {
      supabaseUrl,
      supabaseAnonKey,
      stripePublishableKey,
      agoraAppId,
      cloudinaryCloudName,
      defaultCurrency,
      defaultLanguage,
      mode,
    },
  });
});

export default router;
