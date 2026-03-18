import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireCarrier } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/carry.controller.js';

const router = Router();

// Public: browse available carry requests
router.get('/requests', ctrl.listCarryRequests);
router.get('/requests/:id', [param('id').isUUID()], validate, ctrl.getCarryRequest);
router.get('/rates', ctrl.getCarryRates);

// Carrier-only
router.post('/requests',
  authenticate, requireCarrier,
  [
    body('flight_number').notEmpty(),
    body('origin').notEmpty(),
    body('destination').notEmpty(),
    body('departure_date').isISO8601(),
    body('weight_capacity').isFloat({ min: 0.1 }),
  ],
  validate,
  ctrl.createCarryRequest,
);
router.patch('/requests/:id',
  authenticate, requireCarrier,
  [param('id').isUUID()],
  validate,
  ctrl.updateCarryRequest,
);
router.delete('/requests/:id',
  authenticate, requireCarrier,
  [param('id').isUUID()],
  validate,
  ctrl.deleteCarryRequest,
);
router.get('/earnings', authenticate, requireCarrier, ctrl.getCarrierEarnings);
router.get('/deliveries', authenticate, requireCarrier, ctrl.getCarrierDeliveries);

// Buyer: book carry slot
router.post('/requests/:id/book',
  authenticate,
  [param('id').isUUID(), body('weight_kg').isFloat({ min: 0.1 })],
  validate,
  ctrl.bookCarrySlot,
);

export default router;
