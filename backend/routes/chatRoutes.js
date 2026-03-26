/**
 * Chat Routes (extended)
 * RESTful endpoints for file upload, message search, and online-user status.
 * Mounted at /api/v1/chat/ext in server.js to complement chat.routes.js.
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { uploadGeneral } from '../middleware/upload.js';
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  markAsRead,
  uploadFile,
  searchMessages,
  getOnlineUsers,
  getUserOnlineStatus,
} from '../controllers/chatController.js';

const router = Router();

router.use(authenticate);

// ── Conversations ──────────────────────────────────────────────────────────────
router.get('/conversations', getConversations);

router.post(
  '/conversations',
  [body('participant_id').isUUID()],
  validate,
  createConversation,
);

// ── Messages ───────────────────────────────────────────────────────────────────
router.get(
  '/conversations/:id/messages',
  [param('id').isUUID()],
  validate,
  getMessages,
);

router.post(
  '/conversations/:id/messages',
  [param('id').isUUID(), body('content').notEmpty()],
  validate,
  sendMessage,
);

router.patch(
  '/conversations/:id/read',
  [param('id').isUUID()],
  validate,
  markAsRead,
);

// ── File / Image Upload ────────────────────────────────────────────────────────
router.post(
  '/conversations/:id/upload',
  [param('id').isUUID()],
  validate,
  uploadGeneral.single('file'),
  uploadFile,
);

// ── Search ─────────────────────────────────────────────────────────────────────
router.get(
  '/conversations/:id/search',
  [param('id').isUUID(), query('q').notEmpty().trim()],
  validate,
  searchMessages,
);

// ── Online Status ──────────────────────────────────────────────────────────────
router.get('/online', getOnlineUsers);
router.get('/online/:userId', [param('userId').isUUID()], validate, getUserOnlineStatus);

export default router;
