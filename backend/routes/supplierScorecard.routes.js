import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import SupplierScore from '../models/SupplierScore.js';
import SupplierBadge from '../models/SupplierBadge.js';

const router = Router();

/**
 * GET /api/v1/supplier-scorecard/scores/:supplierId
 * Get scores for a supplier.
 */
router.get(
  '/scores/:supplierId',
  async (req, res, next) => {
    try {
      const { supplierId } = req.params;
      const [scores, aggregate] = await Promise.all([
        SupplierScore.findBySupplier(supplierId),
        SupplierScore.getAggregateScore(supplierId),
      ]);
      res.json({ success: true, data: { scores: scores.data, aggregate } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/supplier-scorecard/rate
 * Rate a supplier (authenticated buyers).
 */
router.post(
  '/rate',
  authenticate,
  [
    body('supplier_id').isUUID().withMessage('Valid supplier_id is required'),
    body('quality_score').isFloat({ min: 0, max: 5 }).withMessage('quality_score must be 0–5'),
    body('delivery_score').isFloat({ min: 0, max: 5 }).withMessage('delivery_score must be 0–5'),
    body('communication_score').isFloat({ min: 0, max: 5 }).withMessage('communication_score must be 0–5'),
    body('price_score').isFloat({ min: 0, max: 5 }).withMessage('price_score must be 0–5'),
    body('review_text').optional().isString().trim().isLength({ max: 2000 }),
    body('order_id').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { supplier_id, quality_score, delivery_score, communication_score, price_score, review_text, order_id } = req.body;
      const overall_score = (quality_score + delivery_score + communication_score + price_score) / 4;
      const score = await SupplierScore.create({
        supplier_id,
        reviewer_id: req.user.id,
        quality_score,
        delivery_score,
        communication_score,
        price_score,
        overall_score,
        review_text,
        order_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      res.status(201).json({ success: true, data: score });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/supplier-scorecard/badges/:supplierId
 * Get badges for a supplier.
 */
router.get(
  '/badges/:supplierId',
  async (req, res, next) => {
    try {
      const badges = await SupplierBadge.findBySupplier(req.params.supplierId);
      res.json({ success: true, data: badges });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/supplier-scorecard/badges/award  (admin)
 * Award a badge to a supplier.
 */
router.post(
  '/badges/award',
  authenticate,
  requireAdmin,
  [
    body('supplier_id').isUUID().withMessage('Valid supplier_id is required'),
    body('badge_type').isString().notEmpty().withMessage('badge_type is required'),
    body('badge_name').isString().notEmpty().withMessage('badge_name is required'),
    body('metadata').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { supplier_id, badge_type, badge_name, metadata } = req.body;
      const badge = await SupplierBadge.award(supplier_id, badge_type, badge_name, metadata);
      res.status(201).json({ success: true, data: badge });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/supplier-scorecard/badges/:id  (admin)
 */
router.delete(
  '/badges/:id',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      await SupplierBadge.delete(req.params.id);
      res.json({ success: true, message: 'Badge removed' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
