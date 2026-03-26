import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/searchController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SearchHistory
 *   description: User search history and saved searches
 */

/* ═══════════════════════════════════════════════════════
   SEARCH HISTORY  (authenticated)
═══════════════════════════════════════════════════════ */

/**
 * @swagger
 * /api/v1/search/history:
 *   get:
 *     tags: [SearchHistory]
 *     summary: Get user's search history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated search history
 */
router.get(
  '/history',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  ctrl.getHistory,
);

/**
 * @swagger
 * /api/v1/search/history:
 *   post:
 *     tags: [SearchHistory]
 *     summary: Record a search query in history
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string }
 *               resultsCount: { type: integer }
 *     responses:
 *       201:
 *         description: History item created
 */
router.post(
  '/history',
  authenticate,
  [
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 500 }),
    body('resultsCount').optional().isInt({ min: 0 }),
  ],
  validate,
  ctrl.addToHistory,
);

/**
 * @swagger
 * /api/v1/search/history:
 *   delete:
 *     tags: [SearchHistory]
 *     summary: Clear all search history for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: History cleared
 */
router.delete('/history', authenticate, ctrl.clearHistory);

/* ═══════════════════════════════════════════════════════
   SAVED SEARCHES  (authenticated)
═══════════════════════════════════════════════════════ */

/**
 * @swagger
 * /api/v1/search/saved:
 *   get:
 *     tags: [SearchHistory]
 *     summary: Get all saved searches for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved searches
 */
router.get('/saved', authenticate, ctrl.getSaved);

/**
 * @swagger
 * /api/v1/search/saved:
 *   post:
 *     tags: [SearchHistory]
 *     summary: Save a search
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:        { type: string }
 *               filters:      { type: object }
 *               name:         { type: string }
 *               alertEnabled: { type: boolean }
 *     responses:
 *       201:
 *         description: Saved search created
 *       422:
 *         description: Limit of 20 saved searches reached
 */
router.post(
  '/saved',
  authenticate,
  [
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 500 }),
    body('name').optional().trim().isLength({ max: 100 }),
    body('filters').optional().isObject(),
    body('alertEnabled').optional().isBoolean(),
  ],
  validate,
  ctrl.createSaved,
);

/**
 * @swagger
 * /api/v1/search/saved/{id}:
 *   put:
 *     tags: [SearchHistory]
 *     summary: Update a saved search name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Updated saved search
 *       404:
 *         description: Not found
 */
router.put(
  '/saved/:id',
  authenticate,
  [
    param('id').trim().notEmpty(),
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  ],
  validate,
  ctrl.updateSaved,
);

/**
 * @swagger
 * /api/v1/search/saved/{id}:
 *   delete:
 *     tags: [SearchHistory]
 *     summary: Delete a saved search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete(
  '/saved/:id',
  authenticate,
  [param('id').trim().notEmpty()],
  validate,
  ctrl.deleteSaved,
);

/**
 * @swagger
 * /api/v1/search/saved/{id}/alert:
 *   put:
 *     tags: [SearchHistory]
 *     summary: Toggle alert for a saved search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alertEnabled]
 *             properties:
 *               alertEnabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Alert status updated
 *       404:
 *         description: Not found
 */
router.put(
  '/saved/:id/alert',
  authenticate,
  [
    param('id').trim().notEmpty(),
    body('alertEnabled').isBoolean().withMessage('alertEnabled must be a boolean'),
  ],
  validate,
  ctrl.toggleAlert,
);

/* ═══════════════════════════════════════════════════════
   TRENDING  (public)
═══════════════════════════════════════════════════════ */

/**
 * @swagger
 * /api/v1/search/trending:
 *   get:
 *     tags: [SearchHistory]
 *     summary: Get trending search queries (aggregated from all users)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 20 }
 *     responses:
 *       200:
 *         description: List of trending search terms with counts
 */
router.get(
  '/trending',
  optionalAuthenticate,
  [query('limit').optional().isInt({ min: 1, max: 20 })],
  validate,
  ctrl.getTrending,
);

export default router;
