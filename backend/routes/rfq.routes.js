import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/rfq.controller.js';

const router = Router();

router.get('/', ctrl.listRFQs);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getRFQ);

router.use(authenticate);

router.post('/',
  [body('product_name').notEmpty(), body('quantity').isInt({ min: 1 }), body('unit').notEmpty()],
  validate,
  ctrl.createRFQ,
);
router.post('/:id/quotes',
  [param('id').isUUID(), body('price').isFloat({ min: 0 }), body('moq').isInt({ min: 1 })],
  validate,
  ctrl.submitQuote,
);
router.patch('/:id/status', [param('id').isUUID(), body('status').notEmpty()], validate, ctrl.updateRFQStatus);
router.patch('/quotes/:id/status', [param('id').isUUID(), body('status').notEmpty()], validate, ctrl.updateQuoteStatus);

export default router;
