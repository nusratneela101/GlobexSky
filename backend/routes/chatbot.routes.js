import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/chatbot.controller.js';

const router = Router();

// ─── Public Route ────────────────────────────────────────────────────────────
router.get('/faq', ctrl.getPopularQuestions);

// ─── Authenticated Routes ────────────────────────────────────────────────────
router.post(
  '/message',
  authenticate,
  [
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 1000 }),
    body('session_id').optional().isString(),
  ],
  validate,
  ctrl.sendMessage,
);

router.get(
  '/history',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getChatHistoryHandler,
);

router.delete('/history', authenticate, ctrl.clearHistoryHandler);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.post(
  '/train',
  authenticate,
  requireAdmin,
  [
    body('question_pattern').trim().notEmpty().withMessage('question_pattern is required'),
    body('answer').trim().notEmpty().withMessage('answer is required'),
    body('intent').optional().isString(),
  ],
  validate,
  ctrl.trainResponse,
);

router.get(
  '/analytics',
  authenticate,
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getChatbotAnalytics,
);

export default router;
