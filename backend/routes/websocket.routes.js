/**
 * Globex Sky — WebSocket REST Routes
 * HTTP endpoints for chat history retrieval, message search, and online status.
 * Real-time events are handled by the Socket.io service in websocket.service.js.
 */

import { Router } from 'express';
import { query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import supabase from '../config/supabase.js';
import { getOnlineUserIds, isUserOnline } from '../services/websocket.service.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/ws/conversations/:id/history
 * Paginated message history for a conversation.
 */
router.get(
  '/conversations/:id/history',
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100').toInt(),
    query('before').optional().isISO8601().withMessage('before must be a valid ISO timestamp'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const limit = req.query.limit || 50;
      const before = req.query.before;
      const userId = req.user.id;

      // Verify participant
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', id)
        .or(`buyer_id.eq.${userId},supplier_id.eq.${userId}`)
        .single();

      if (!conversation) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      let dbQuery = supabase
        .from('messages')
        .select('*, sender:profiles(full_name, avatar_url)')
        .eq('conversation_id', id)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (before) {
        dbQuery = dbQuery.lt('sent_at', before);
      }

      const { data: messages, error } = await dbQuery;
      if (error) throw error;

      return res.json({ success: true, data: (messages || []).reverse() });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/ws/conversations/:id/search
 * Search messages in a conversation by keyword.
 */
router.get(
  '/conversations/:id/search',
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    query('q').trim().notEmpty().withMessage('Search query is required').isLength({ max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { q, limit = 20 } = req.query;
      const userId = req.user.id;

      // Verify participant
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', id)
        .or(`buyer_id.eq.${userId},supplier_id.eq.${userId}`)
        .single();

      if (!conversation) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*, sender:profiles(full_name, avatar_url)')
        .eq('conversation_id', id)
        .ilike('content', `%${q}%`)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return res.json({ success: true, data: messages || [] });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/ws/users/online
 * Returns list of currently online user IDs.
 */
router.get('/users/online', (_req, res) => {
  res.json({ success: true, data: getOnlineUserIds() });
});

/**
 * GET /api/v1/ws/users/:id/status
 * Returns online/offline status for a specific user.
 */
router.get(
  '/users/:id/status',
  [param('id').isUUID().withMessage('Invalid user ID')],
  validate,
  (req, res) => {
    const { id } = req.params;
    res.json({ success: true, data: { userId: id, online: isUserOnline(id) } });
  },
);

export default router;
