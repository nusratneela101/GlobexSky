import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/commission.controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/calculate',
  [body('order_value').isFloat()],
  validate,
  ctrl.calculateCommission,
);

router.get('/category/:categoryId', [param('categoryId').notEmpty()], validate, ctrl.getCommissionsByCategory);

router.get('/', ctrl.listCommissions);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getCommission);

router.post(
  '/',
  requireAdmin,
  [body('name').notEmpty(), body('rate_percent').isFloat()],
  validate,
  ctrl.createCommission,
);

router.put('/:id', requireAdmin, [param('id').notEmpty()], validate, ctrl.updateCommission);
router.delete('/:id', requireAdmin, [param('id').notEmpty()], validate, ctrl.deleteCommission);

export default router;
