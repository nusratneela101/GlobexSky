import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/pushNotification.controller.js';

const router = Router();

// Public: client needs the VAPID public key before authenticating
router.get('/vapid-public-key', ctrl.getVapidPublicKey);

// Fire-and-forget dismissed event — service workers have no auth token
router.post(
  '/dismissed',
  [body('notificationId').notEmpty().isUUID()],
  validate,
  ctrl.recordDismissed,
);

// All remaining routes require authentication
router.use(authenticate);

router.post(
  '/subscribe',
  [body('subscription').isObject()],
  validate,
  ctrl.subscribe,
);

router.post(
  '/unsubscribe',
  [body('endpoint').notEmpty().isURL()],
  validate,
  ctrl.unsubscribe,
);

router.get('/subscriptions', ctrl.getSubscriptions);

router.get('/preferences', ctrl.getPreferences);

router.put('/preferences', ctrl.updatePreferences);

router.get(
  '/history',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.getHistory,
);

router.post('/test', ctrl.sendTestNotification);

// Admin-only routes (role check done inside controller via req.user.profile)
router.post(
  '/send',
  [body('user_id').notEmpty(), body('title').notEmpty()],
  validate,
  ctrl.sendNotification,
);

router.post(
  '/broadcast',
  [body('title').notEmpty()],
  validate,
  ctrl.broadcastNotification,
);

export default router;
