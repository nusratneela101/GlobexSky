import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import CurrencyContract from '../models/CurrencyContract.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/currency-contracts
 * List contracts for current user.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await CurrencyContract.findByUser(req.user.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/currency-contracts/active
 * List active and pending contracts for current user.
 */
router.get('/active', async (req, res, next) => {
  try {
    const contracts = await CurrencyContract.findActive(req.user.id);
    res.json({ success: true, data: contracts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/currency-contracts/:id
 */
router.get('/:id', param('id').isUUID(), validate, async (req, res, next) => {
  try {
    const contract = await CurrencyContract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, error: 'Contract not found' });
    res.json({ success: true, data: contract });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/currency-contracts
 * Create a new currency forward contract.
 */
router.post(
  '/',
  [
    body('contract_type').isIn(['forward', 'option', 'swap']).withMessage('Invalid contract_type'),
    body('base_currency').isLength({ min: 3, max: 3 }).withMessage('3-letter base_currency required'),
    body('quote_currency').isLength({ min: 3, max: 3 }).withMessage('3-letter quote_currency required'),
    body('notional_amount').isFloat({ gt: 0 }).withMessage('notional_amount must be positive'),
    body('contract_rate').isFloat({ gt: 0 }).withMessage('contract_rate must be positive'),
    body('spot_rate').optional().isFloat({ gt: 0 }),
    body('settlement_date').isISO8601().withMessage('Valid settlement_date required'),
    body('hedging_ratio').optional().isFloat({ min: 0, max: 1 }),
    body('metadata').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const contract = await CurrencyContract.create({
        ...req.body,
        base_currency: req.body.base_currency.toUpperCase(),
        quote_currency: req.body.quote_currency.toUpperCase(),
        user_id: req.user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      res.status(201).json({ success: true, data: contract });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/currency-contracts/:id
 * Update a contract.
 */
router.put(
  '/:id',
  param('id').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const contract = await CurrencyContract.update(req.params.id, req.body);
      res.json({ success: true, data: contract });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/currency-contracts/:id/close
 * Close/settle a contract.
 */
router.post(
  '/:id/close',
  [
    param('id').isUUID(),
    body('pnl').isFloat().withMessage('pnl value is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const contract = await CurrencyContract.closeContract(req.params.id, req.body.pnl);
      res.json({ success: true, data: contract });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/currency-contracts/:id
 */
router.delete('/:id', param('id').isUUID(), validate, async (req, res, next) => {
  try {
    await CurrencyContract.delete(req.params.id);
    res.json({ success: true, message: 'Contract deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
