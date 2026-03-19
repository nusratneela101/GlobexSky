import * as service from '../services/featureToggle.service.js';

/** GET /api/v1/feature-toggles */
export async function getToggles(req, res, next) {
  try {
    res.json({ success: true, data: service.getToggles() });
  } catch (err) { next(err); }
}

/** GET /api/v1/feature-toggles/:key */
export async function getToggle(req, res, next) {
  try {
    const toggle = service.getToggle(req.params.key);
    res.json({ success: true, data: toggle });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

/** POST /api/v1/feature-toggles */
export async function createToggle(req, res, next) {
  try {
    const toggle = service.createToggle(req.body, req.user?.id);
    res.status(201).json({ success: true, data: toggle });
  } catch (err) {
    if (err.message.includes('already exists')) return res.status(409).json({ success: false, error: err.message });
    next(err);
  }
}

/** PATCH /api/v1/feature-toggles/:key */
export async function updateToggle(req, res, next) {
  try {
    const toggle = service.updateToggle(req.params.key, req.body, req.user?.id);
    res.json({ success: true, data: toggle });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

/** DELETE /api/v1/feature-toggles/:key */
export async function deleteToggle(req, res, next) {
  try {
    const result = service.deleteToggle(req.params.key);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

/** POST /api/v1/feature-toggles/:key/evaluate */
export async function evaluateToggle(req, res, next) {
  try {
    const context = {
      userId: req.user?.id,
      env: process.env.NODE_ENV || 'development',
      ...req.body,
    };
    const result = service.evaluateToggle(req.params.key, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
