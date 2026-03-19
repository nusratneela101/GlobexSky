import { evaluateToggle } from '../services/featureToggle.service.js';

/**
 * Express middleware: gate a route behind a feature toggle.
 * Returns 404 if the feature is disabled; passes through if enabled.
 *
 * Usage:
 *   router.get('/new-feature', featureGate('new_feature'), ctrl.handler);
 *
 * @param {string} featureKey — the feature toggle key to evaluate
 */
export function featureGate(featureKey) {
  return (req, res, next) => {
    const context = {
      userId: req.user?.id,
      env: process.env.NODE_ENV || 'development',
    };
    const result = evaluateToggle(featureKey, context);
    if (!result.enabled) {
      return res.status(404).json({
        success: false,
        error: 'This feature is not available.',
        feature: featureKey,
        reason: result.reason,
      });
    }
    next();
  };
}
