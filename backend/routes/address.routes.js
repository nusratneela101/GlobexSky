import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/address.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listAddresses);
router.get('/:id', [param('id').notEmpty()], validate, ctrl.getAddress);

router.post('/',
  [
    body('full_name').notEmpty().withMessage('Full name is required.'),
    body('address_line1').notEmpty().withMessage('Address line 1 is required.'),
    body('city').notEmpty().withMessage('City is required.'),
    body('postal_code').notEmpty().withMessage('Postal code is required.'),
    body('country').notEmpty().withMessage('Country is required.'),
  ],
  validate,
  ctrl.createAddress,
);

router.put('/:id',
  [param('id').notEmpty()],
  validate,
  ctrl.updateAddress,
);

router.delete('/:id',
  [param('id').notEmpty()],
  validate,
  ctrl.deleteAddress,
);

export default router;
