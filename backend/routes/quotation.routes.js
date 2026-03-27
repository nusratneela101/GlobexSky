import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/quotation.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  [
    query('rfq_id').optional(),
    query('supplier_id').optional(),
    query('status').optional(),
  ],
  validate,
  ctrl.listQuotations,
);

router.get('/:id', [param('id').isUUID()], validate, ctrl.getQuotation);

router.post(
  '/',
  [
    body('rfq_id').isUUID(),
    body('unit_price').isFloat(),
    body('total_price').optional().isFloat(),
  ],
  validate,
  ctrl.createQuotation,
);

router.put('/:id', [param('id').isUUID()], validate, ctrl.updateQuotation);

router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['pending', 'accepted', 'rejected', 'expired']),
  ],
  validate,
  ctrl.updateQuotationStatus,
);

router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteQuotation);

export default router;
