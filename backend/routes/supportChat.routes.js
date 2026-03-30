/**
 * Globex Sky — Support Live Chat Routes
 * Mounted at /api/v1/support/chat
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { optionalAuthenticate as optionalAuth } from '../middleware/auth.js';
import {
  initiateSession,
  getQueueStatus,
  getActiveSessions,
  getSession,
} from '../services/support/liveChat.service.js';

const router = Router();

/**
 * POST /api/v1/support/chat/initiate
 * Start a new support chat session (AI → human handoff or direct).
 */
router.post(
  '/initiate',
  optionalAuth,
  [
    body('name').optional().isString().trim().isLength({ max: 100 }),
    body('topic').optional().isString().trim().isLength({ max: 200 }),
    body('history').optional().isArray({ max: 100 }),
  ],
  validate,
  (req, res) => {
    try {
      const { name, topic, history } = req.body;
      const customerId = req.user?.id;
      const result = initiateSession({ customerId, name, topic, history });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * GET /api/v1/support/chat/queue
 * Get the current support queue status.
 */
router.get('/queue', (req, res) => {
  try {
    const status = getQueueStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/support/chat/sessions
 * Get all active sessions (agent/admin only — validated by dashboard).
 */
router.get('/sessions', (req, res) => {
  try {
    const sessions = getActiveSessions();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/support/chat/sessions/:sessionId
 * Get a single session with full message history.
 */
router.get(
  '/sessions/:sessionId',
  [param('sessionId').isString().trim()],
  validate,
  (req, res) => {
    try {
      const session = getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
      res.json({ success: true, session });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

export default router;
