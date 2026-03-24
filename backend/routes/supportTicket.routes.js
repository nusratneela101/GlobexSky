/**
 * Globex Sky — Admin Support Ticket Routes
 * Exports two routers:
 *   ticketRouter → mounted at /api/v1/admin/tickets
 *   kbRouter     → mounted at /api/v1/admin/kb
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/supportTicket.controller.js';

/* ─── Ticket Router ──────────────────────────────────────────────────────── */
export const ticketRouter = Router();

ticketRouter.use(authenticate);
ticketRouter.use(requireAdmin);

// GET /api/v1/admin/tickets/stats
ticketRouter.get('/stats', ctrl.getTicketStats);

// GET /api/v1/admin/tickets
ticketRouter.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['open', 'pending', 'in_progress', 'resolved', 'closed']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  ],
  validate,
  ctrl.getAllTickets,
);

// GET /api/v1/admin/tickets/:id
ticketRouter.get('/:id', [param('id').notEmpty()], validate, ctrl.getTicketById);

// POST /api/v1/admin/tickets/:id/reply
ticketRouter.post(
  '/:id/reply',
  [
    param('id').notEmpty(),
    body('body').notEmpty().trim(),
    body('is_internal').optional().isBoolean(),
    body('attachments').optional().isArray(),
  ],
  validate,
  ctrl.replyToTicket,
);

// PUT /api/v1/admin/tickets/:id/assign
ticketRouter.put(
  '/:id/assign',
  [param('id').notEmpty(), body('assigned_to').notEmpty()],
  validate,
  ctrl.assignTicket,
);

// PUT /api/v1/admin/tickets/:id/priority
ticketRouter.put(
  '/:id/priority',
  [param('id').notEmpty(), body('priority').isIn(['low', 'medium', 'high', 'urgent'])],
  validate,
  ctrl.updateTicketPriority,
);

// PUT /api/v1/admin/tickets/:id/status
ticketRouter.put(
  '/:id/status',
  [param('id').notEmpty(), body('status').isIn(['open', 'pending', 'in_progress', 'resolved', 'closed'])],
  validate,
  ctrl.updateTicketStatus,
);

// POST /api/v1/admin/tickets/:id/notes
ticketRouter.post(
  '/:id/notes',
  [param('id').notEmpty(), body('body').notEmpty().trim()],
  validate,
  ctrl.addInternalNote,
);

/* ─── KB Router ──────────────────────────────────────────────────────────── */
export const kbRouter = Router();

kbRouter.use(authenticate);
kbRouter.use(requireAdmin);

// GET  /api/v1/admin/kb/categories
kbRouter.get('/categories', ctrl.getKBCategories);

// POST /api/v1/admin/kb/categories
kbRouter.post(
  '/categories',
  [body('name').notEmpty().trim()],
  validate,
  ctrl.createKBCategory,
);

// PUT  /api/v1/admin/kb/categories/:id
kbRouter.put(
  '/categories/:id',
  [param('id').notEmpty(), body('name').optional().trim()],
  validate,
  ctrl.updateKBCategory,
);

// DELETE /api/v1/admin/kb/categories/:id
kbRouter.delete('/categories/:id', [param('id').notEmpty()], validate, ctrl.deleteKBCategory);

// GET  /api/v1/admin/kb/articles
kbRouter.get(
  '/articles',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft', 'published']),
  ],
  validate,
  ctrl.getKBArticles,
);

// GET  /api/v1/admin/kb/articles/:id
kbRouter.get('/articles/:id', [param('id').notEmpty()], validate, ctrl.getKBArticleById);

// POST /api/v1/admin/kb/articles
kbRouter.post(
  '/articles',
  [
    body('title').notEmpty().trim(),
    body('content').notEmpty(),
    body('category').notEmpty().trim(),
    body('status').optional().isIn(['draft', 'published']),
    body('tags').optional().isArray(),
  ],
  validate,
  ctrl.createKBArticle,
);

// PUT  /api/v1/admin/kb/articles/:id
kbRouter.put(
  '/articles/:id',
  [
    param('id').notEmpty(),
    body('title').optional().trim(),
    body('status').optional().isIn(['draft', 'published']),
    body('tags').optional().isArray(),
  ],
  validate,
  ctrl.updateKBArticle,
);

// DELETE /api/v1/admin/kb/articles/:id
kbRouter.delete('/articles/:id', [param('id').notEmpty()], validate, ctrl.deleteKBArticle);

// GET    /api/v1/admin/kb/faqs
kbRouter.get('/faqs', ctrl.getFAQs);

// PUT    /api/v1/admin/kb/faqs/reorder (must precede /:id routes)
kbRouter.put(
  '/faqs/reorder',
  [body('items').isArray({ min: 1 })],
  validate,
  ctrl.reorderFAQs,
);

// POST   /api/v1/admin/kb/faqs
kbRouter.post(
  '/faqs',
  [body('question').notEmpty().trim(), body('answer').notEmpty().trim()],
  validate,
  ctrl.createFAQ,
);

// PUT    /api/v1/admin/kb/faqs/:id
kbRouter.put(
  '/faqs/:id',
  [param('id').notEmpty(), body('question').optional().trim(), body('answer').optional().trim()],
  validate,
  ctrl.updateFAQ,
);

// DELETE /api/v1/admin/kb/faqs/:id
kbRouter.delete('/faqs/:id', [param('id').notEmpty()], validate, ctrl.deleteFAQ);
