import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/currencyDisplay.controller.js';

const router = Router();

/**
 * GET /api/v1/currency-display/supported
 * List all supported currencies (public).
 */
router.get('/supported', ctrl.getSupportedCurrencies);

/**
 * GET /api/v1/currency-display/rates?base=USD
 * Get current exchange rates (public).
 */
router.get(
  '/rates',
  [query('base').optional().matches(/^[A-Z]{3}$/).withMessage('"base" must be a 3-letter uppercase ISO 4217 code')],
  validate,
  ctrl.getRates
);

/**
 * GET /api/v1/currency-display/preference
 * Get the authenticated user's preferred currency.
 */
router.get('/preference', authenticate, ctrl.getPreference);

/**
 * PUT /api/v1/currency-display/preference
 * Set the authenticated user's preferred currency.
 */
router.put(
  '/preference',
  authenticate,
  [
    body('preferred_currency')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('preferred_currency must be a 3-letter ISO 4217 code'),
    body('auto_detect').optional().isBoolean(),
  ],
  validate,
  ctrl.setPreference
);

/**
 * POST /api/v1/currency-display/convert
 * Convert a price or array of prices between currencies.
 * Body: { from, to, amount } or { from, to, amounts: [] }
 */
router.post(
  '/convert',
  optionalAuthenticate,
  [
    body('from')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('"from" must be a 3-letter ISO 4217 code'),
    body('to')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('"to" must be a 3-letter ISO 4217 code'),
    body('amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('"amount" must be a non-negative number'),
    body('amounts')
      .optional()
      .isArray()
      .withMessage('"amounts" must be an array'),
  ],
  validate,
  ctrl.convertPrices
);

/**
 * GET /api/v1/currency-display/auto-detect
 * Detect the best currency from request headers (public).
 */
router.get('/auto-detect', ctrl.autoDetectCurrency);

export default router;
