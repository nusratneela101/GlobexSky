/**
 * Globex Sky — config.routes.js
 * Public endpoint that exposes ONLY safe/public keys based on current APP_MODE.
 * Secret keys are NEVER sent to the frontend.
 */

import { Router } from 'express';
import getEnvConfig from '../config/envManager.js';

const router = Router();

/**
 * GET /api/v1/config/public
 * Returns public-safe configuration keys for the current mode.
 * No authentication required — these are public keys only.
 */
router.get('/public', (_req, res) => {
  const cfg = getEnvConfig();

  res.json({
    success: true,
    data: {
      mode: cfg.mode,
      supabase: {
        url: cfg.supabase.url || null,
        anonKey: cfg.supabase.anonKey || null,
      },
      stripe: {
        publishableKey: cfg.stripe.publishableKey || null,
      },
      agora: {
        appId: cfg.agora.appId || null,
      },
      cloudinary: {
        cloudName: cfg.cloudinary.cloudName || null,
      },
    },
  });
});

export default router;
