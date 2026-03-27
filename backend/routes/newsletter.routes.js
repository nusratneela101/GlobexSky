import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import Newsletter from '../models/Newsletter.js';

const router = Router();

/**
 * POST /api/v1/newsletter/subscribe
 * Subscribe an email to the newsletter.
 */
router.post(
  '/subscribe',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('name').optional().isString().trim().isLength({ max: 100 }),
    body('preferences').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, name, preferences } = req.body;
      const subscriber = await Newsletter.subscribe(email, name, preferences);
      res.status(201).json({ success: true, data: subscriber, message: 'Successfully subscribed' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/newsletter/unsubscribe
 * Unsubscribe an email.
 */
router.post(
  '/unsubscribe',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const subscriber = await Newsletter.unsubscribe(email);
      res.json({ success: true, data: subscriber, message: 'Successfully unsubscribed' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/newsletter/subscribers  (admin)
 * List all active subscribers.
 */
router.get(
  '/subscribers',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await Newsletter.getActive(page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/newsletter/status/:email  (admin)
 * Check subscription status for an email.
 */
router.get(
  '/status/:email',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const subscriber = await Newsletter.findByEmail(req.params.email);
      res.json({ success: true, data: subscriber });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
