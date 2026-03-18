import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/inspection.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listInspections);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getInspection);
router.post('/',
  [body('order_id').isUUID(), body('type').notEmpty(), body('factory_address').notEmpty()],
  validate,
  ctrl.requestInspection,
);
router.patch('/:id/status', [param('id').isUUID(), body('status').notEmpty()], validate, ctrl.updateInspectionStatus);
router.post('/:id/report', [param('id').isUUID()], validate, ctrl.submitInspectionReport);

export default router;
