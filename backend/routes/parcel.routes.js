import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/parcel.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listParcels);
router.post('/',
  [
    body('receiver_name').notEmpty(),
    body('receiver_address').notEmpty(),
    body('destination_country').notEmpty(),
    body('weight_kg').isFloat({ min: 0.1 }),
  ],
  validate,
  ctrl.createParcel,
);
router.get('/track/:tracking_number', ctrl.trackParcel);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getParcel);
router.post('/calculate', ctrl.calculateParcelCost);

export default router;
