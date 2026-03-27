import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import BadgeCatalog from '../models/BadgeCatalog.js';

const router = Router();

/**
 * GET /api/v1/supplier-badges
 * List all available badges (public).
 */
router.get(
  '/',
  [query('tier').optional().isIn(['bronze', 'silver', 'gold', 'platinum'])],
  validate,
  async (req, res, next) => {
    try {
      const badges = req.query.tier
        ? await BadgeCatalog.findByTier(req.query.tier)
        : await BadgeCatalog.listAll();
      res.json({ success: true, data: badges });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/supplier-badges/:id
 * Get a single badge definition.
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const badge = await BadgeCatalog.findById(req.params.id);
      if (!badge) return res.status(404).json({ success: false, error: 'Badge not found.' });
      res.json({ success: true, data: badge });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/supplier-badges
 * Create a new badge definition (admin).
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').isString().trim().notEmpty().withMessage('name is required'),
    body('description').isString().trim().notEmpty().withMessage('description is required'),
    body('icon').isString().trim().notEmpty().withMessage('icon is required'),
    body('criteria').isObject().withMessage('criteria must be an object'),
    body('tier').isIn(['bronze', 'silver', 'gold', 'platinum']).withMessage('tier must be bronze, silver, gold, or platinum'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, icon, criteria, tier } = req.body;
      const badge = await BadgeCatalog.create({ name, description, icon, criteria, tier });
      res.status(201).json({ success: true, data: badge });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/supplier-badges/:id
 * Update a badge definition (admin).
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('icon').optional().isString().trim(),
    body('criteria').optional().isObject(),
    body('tier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ['name', 'description', 'icon', 'criteria', 'tier'];
      const updates = {};
      for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
      const badge = await BadgeCatalog.update(req.params.id, updates);
      res.json({ success: true, data: badge });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/supplier-badges/:id
 * Delete a badge definition (admin).
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      await BadgeCatalog.delete(req.params.id);
      res.json({ success: true, message: 'Badge deleted.' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
