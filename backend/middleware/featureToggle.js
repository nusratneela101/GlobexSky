/**
 * Feature Toggle Middleware
 * Gate routes behind a named feature flag stored in the feature_toggles table.
 */

import supabase from '../config/supabase.js';

/**
 * Returns middleware that blocks the request if the given feature is disabled.
 * @param {string} featureName
 */
export function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const { data, error } = await supabase
        .from('feature_toggles')
        .select('is_enabled')
        .eq('feature_name', featureName)
        .single();

      if (error || !data) {
        // Feature record not found — treat as disabled
        return res.status(503).json({
          success: false,
          error: `Feature '${featureName}' is not available.`,
        });
      }

      if (!data.is_enabled) {
        return res.status(503).json({
          success: false,
          error: `Feature '${featureName}' is currently disabled.`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
