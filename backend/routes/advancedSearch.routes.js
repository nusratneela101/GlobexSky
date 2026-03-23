import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/advancedSearch.controller.js';

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     tags: [Search]
 *     summary: Full-text product search
 *     description: Search products with filters, sorting, and pagination. Supports category, price range, and rating filters.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search query string
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: minRating
 *         schema: { type: number, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, price_asc, price_desc, newest, rating]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 suggestion: { type: string, description: Spelling suggestion if zero results }
 *       400:
 *         description: Invalid query parameters
 */


const router = Router();

// ─── Text Search & Autocomplete ───────────────────────────────────────────────
router.get('/', [query('q').optional().trim()], validate, ctrl.textSearch);
router.get('/autocomplete', [
  query('q').optional().trim(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
], validate, ctrl.autocomplete);
router.get('/suggestions', [query('q').optional().trim()], validate, ctrl.getSearchSuggestions);

// ─── Barcode Search ───────────────────────────────────────────────────────────
router.post('/barcode', [body('barcode').trim().notEmpty().withMessage('barcode is required')], validate, ctrl.barcodeSearch);
router.get('/barcode/:code', [param('code').trim().notEmpty().withMessage('barcode code is required')], validate, ctrl.barcodeSearchByParam);

// ─── Advanced Filtered Search ─────────────────────────────────────────────────
router.post('/advanced', optionalAuthenticate, ctrl.advancedSearch);

// ─── AI Recommendations ───────────────────────────────────────────────────────
router.get('/recommendations', optionalAuthenticate, [
  query('context').optional().trim(),
  query('limit').optional().isInt({ min: 1, max: 24 }),
], validate, ctrl.getRecommendations);

// ─── AI Chat ─────────────────────────────────────────────────────────────────
router.post('/ai-chat', optionalAuthenticate, [
  body('message').trim().notEmpty().withMessage('message is required').isLength({ max: 500 }),
  body('history').optional().isArray(),
], validate, ctrl.aiChat);

// ─── Voice Search ─────────────────────────────────────────────────────────────
router.post('/voice', authenticate, [body('transcription').trim().notEmpty().withMessage('transcription is required')], validate, ctrl.voiceSearch);

// ─── Image Search ─────────────────────────────────────────────────────────────
router.post('/image', optionalAuthenticate, [body('imageUrl').optional().trim(), body('imageBase64').optional()], validate, ctrl.imageSearch);

// ─── Admin Analytics ─────────────────────────────────────────────────────────
router.get('/analytics', authenticate, requireAdmin, ctrl.getSearchAnalytics);

export default router;
