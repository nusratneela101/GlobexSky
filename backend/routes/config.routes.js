/**
 * backend/routes/config.routes.js
 * Public configuration endpoint.
 *
 * GET /api/v1/config/public
 *   Returns non-sensitive public config that the frontend needs at runtime.
 *   NEVER exposes secret keys.
 */

import { Router } from 'express';
import env from '../config/env.js';

const router = Router();

/**
 * GET /public
 * Returns public (non-sensitive) runtime configuration for the frontend.
 */
router.get('/public', (_req, res) => {
  res.json({
    success: true,
    data: {
      supabaseUrl: env.supabase.url,
      supabaseAnonKey: env.supabase.anonKey,
      cloudinaryCloudName: env.cloudinary.cloudName,
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
      defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
      mode: env.mode,
    },
  });
});

export default router;
