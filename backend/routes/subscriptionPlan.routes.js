import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/subscriptionPlan.controller.js';

const router = Router();

// Public routes
router.get('/compare', ctrl.comparePlans);
router.get('/', ctrl.listPlans);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getPlan);

// Admin routes
router.post(
  '/',
  authenticate,
  requireAdmin,
  [body('name').notEmpty(), body('price_monthly').isFloat()],
  validate,
  ctrl.createPlan,
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').notEmpty()],
  validate,
  ctrl.updatePlan,
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').notEmpty()],
  validate,
  ctrl.deletePlan,
);

export default router;
