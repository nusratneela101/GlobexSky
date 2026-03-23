/**
 * Globex Sky — AI Routes
 * All AI-powered feature endpoints under /api/v1/ai
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { aiRateLimiter, chatbotRateLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/ai.controller.js';

const router = Router();

// Apply general AI rate limiter to all AI routes
router.use(aiRateLimiter);

// ─── Recommendations ──────────────────────────────────────────────────────────

router.get(
  '/recommendations/trending',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.getTrending,
);

router.get(
  '/recommendations/product/:productId/similar',
  [
    param('productId').notEmpty().withMessage('productId is required'),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  ctrl.getSimilarProducts,
);

router.get(
  '/recommendations/product/:productId/frequently-bought-together',
  [
    param('productId').notEmpty().withMessage('productId is required'),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  ctrl.getFrequentlyBoughtTogether,
);

router.get(
  '/recommendations/:userId',
  authenticate,
  [
    param('userId').notEmpty().withMessage('userId is required'),
    query('type').optional().isIn(['personalized', 'collaborative', 'content', 'hybrid', 'trending']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  ctrl.getRecommendations,
);

// ─── Fraud Detection (admin only) ────────────────────────────────────────────

router.post(
  '/fraud-check',
  authenticate,
  requireAdmin,
  [
    body('user_id').notEmpty().withMessage('user_id is required'),
    body('amount').isFloat({ min: 0 }).withMessage('amount must be a positive number'),
    body('order_id').optional().isString(),
    body('ip_address').optional().isIP(),
  ],
  validate,
  ctrl.fraudCheck,
);

router.get('/fraud/flagged', authenticate, requireAdmin, ctrl.getFlaggedTransactions);

router.patch(
  '/fraud/flagged/:flagId',
  authenticate,
  requireAdmin,
  [
    param('flagId').notEmpty(),
    body('status').isIn(['approved', 'rejected']).withMessage('status must be approved or rejected'),
  ],
  validate,
  ctrl.reviewFlag,
);

router.post(
  '/fraud/list',
  authenticate,
  requireAdmin,
  [
    body('list_type').isIn(['whitelist', 'blacklist']).withMessage('list_type must be whitelist or blacklist'),
    body('user_id').optional().isString(),
    body('ip_address').optional().isIP(),
    body('reason').optional().isString(),
  ],
  validate,
  ctrl.addToFraudList,
);

router.get('/fraud/list', authenticate, requireAdmin, ctrl.getFraudList);

router.delete('/fraud/list/:entryId', authenticate, requireAdmin, ctrl.removeFromFraudList);

router.get('/fraud/audit', authenticate, requireAdmin, ctrl.getFraudAudit);

// ─── AI Search ────────────────────────────────────────────────────────────────

router.post(
  '/search',
  optionalAuthenticate,
  [
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 200 }),
    body('page').optional().isInt({ min: 1 }),
    body('limit').optional().isInt({ min: 1, max: 100 }),
    body('minPrice').optional().isFloat({ min: 0 }),
    body('maxPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  ctrl.search,
);

router.get(
  '/search/suggestions',
  [query('q').trim().notEmpty().withMessage('q is required').isLength({ max: 100 })],
  validate,
  ctrl.getSearchSuggestions,
);

router.post(
  '/search/image',
  optionalAuthenticate,
  [body('image').notEmpty().withMessage('image (base64) is required')],
  validate,
  ctrl.imageSearch,
);

router.post(
  '/search/voice',
  optionalAuthenticate,
  [body('transcription').trim().notEmpty().withMessage('transcription is required').isLength({ max: 500 })],
  validate,
  ctrl.voiceSearch,
);

router.get(
  '/search/barcode/:value',
  [param('value').notEmpty().withMessage('barcode value is required')],
  validate,
  ctrl.barcodeSearch,
);

router.get('/search/synonyms', ctrl.getSynonyms);

router.post(
  '/search/synonyms',
  authenticate,
  requireAdmin,
  [
    body('keyword').trim().notEmpty().withMessage('keyword is required'),
    body('synonyms').isArray({ min: 1 }).withMessage('synonyms must be a non-empty array'),
  ],
  validate,
  ctrl.upsertSynonym,
);

// ─── Chatbot ──────────────────────────────────────────────────────────────────

router.post(
  '/chatbot',
  chatbotRateLimiter,
  authenticate,
  [
    body('message').trim().notEmpty().withMessage('message is required').isLength({ max: 1000 }),
    body('session_id').optional().isString(),
    body('lang').optional().isString().isLength({ min: 2, max: 10 }),
  ],
  validate,
  ctrl.chatbotMessage,
);

router.get(
  '/chatbot/history',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  ctrl.getChatHistory,
);

router.delete('/chatbot/history', authenticate, ctrl.clearChatHistory);

router.get(
  '/chatbot/faqs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.listFAQs,
);

router.post(
  '/chatbot/faqs',
  authenticate,
  requireAdmin,
  [
    body('question_pattern').trim().notEmpty().withMessage('question_pattern is required'),
    body('answer').trim().notEmpty().withMessage('answer is required'),
    body('intent').optional().isString(),
  ],
  validate,
  ctrl.upsertFAQ,
);

router.delete(
  '/chatbot/faqs/:id',
  authenticate,
  requireAdmin,
  [param('id').notEmpty()],
  validate,
  ctrl.deleteFAQ,
);

// ─── Price Optimization ───────────────────────────────────────────────────────

router.post(
  '/price-optimize',
  authenticate,
  requireAdmin,
  [
    body('product_id').optional().isString(),
    body('type').optional().isIn(['demand', 'competitive', 'rules', 'elasticity', 'markup']),
    body('category_id').optional().isString(),
  ],
  validate,
  ctrl.priceOptimize,
);

router.post(
  '/price-optimize/bulk',
  authenticate,
  requireAdmin,
  [
    body('product_ids').isArray({ min: 1, max: 50 }).withMessage('product_ids must be a non-empty array of up to 50 items'),
  ],
  validate,
  ctrl.bulkPriceOptimize,
);

// ─── Translation ──────────────────────────────────────────────────────────────

router.post(
  '/translate',
  optionalAuthenticate,
  [
    body('text').notEmpty().withMessage('text is required').isLength({ max: 5000 }),
    body('target_lang').notEmpty().withMessage('target_lang is required').isLength({ min: 2, max: 10 }),
    body('source_lang').optional().isString(),
  ],
  validate,
  ctrl.translate,
);

router.post(
  '/translate/batch',
  optionalAuthenticate,
  [
    body('texts').isArray({ min: 1, max: 100 }).withMessage('texts must be an array of 1–100 items'),
    body('target_lang').notEmpty().withMessage('target_lang is required').isLength({ min: 2, max: 10 }),
    body('source_lang').optional().isString(),
  ],
  validate,
  ctrl.batchTranslate,
);

router.post(
  '/translate/product/:productId',
  authenticate,
  requireAdmin,
  [
    param('productId').notEmpty(),
    body('target_lang').notEmpty().withMessage('target_lang is required'),
  ],
  validate,
  ctrl.translateProduct,
);

router.post(
  '/translate/review/:reviewId',
  optionalAuthenticate,
  [
    param('reviewId').notEmpty(),
    body('target_lang').notEmpty().withMessage('target_lang is required'),
  ],
  validate,
  ctrl.translateReview,
);

router.post(
  '/translate/chat/:messageId',
  authenticate,
  [
    param('messageId').notEmpty(),
    body('target_lang').notEmpty().withMessage('target_lang is required'),
  ],
  validate,
  ctrl.translateChatMessage,
);

router.get(
  '/translate/detect',
  [query('text').notEmpty().withMessage('text query param is required').isLength({ max: 500 })],
  validate,
  ctrl.detectLanguage,
);

router.get('/translate/languages', ctrl.getSupportedLanguages);

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get(
  '/analytics',
  authenticate,
  requireAdmin,
  [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
  ],
  validate,
  ctrl.getAiAnalytics,
);

// ─── Semantic Search (OpenAI embeddings) ─────────────────────────────────────

router.post(
  '/search/semantic',
  optionalAuthenticate,
  [
    body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 500 }),
    body('limit').optional().isInt({ min: 1, max: 100 }),
    body('minPrice').optional().isFloat({ min: 0 }),
    body('maxPrice').optional().isFloat({ min: 0 }),
    body('category_id').optional().isString(),
  ],
  validate,
  ctrl.semanticSearch,
);

router.post(
  '/search/filters',
  optionalAuthenticate,
  [body('query').trim().notEmpty().withMessage('query is required').isLength({ max: 300 })],
  validate,
  ctrl.generateSearchFilters,
);

// ─── Content Generation ───────────────────────────────────────────────────────

router.post(
  '/content/generate-description',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('attributes').optional().isObject(),
    body('tone').optional().isIn(['professional', 'casual', 'engaging']),
  ],
  validate,
  ctrl.generateDescription,
);

router.post(
  '/content/seo-meta',
  authenticate,
  [
    body('productName').trim().notEmpty().withMessage('productName is required'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('description').optional().isString(),
  ],
  validate,
  ctrl.generateSeoMeta,
);

router.post(
  '/content/summarize-reviews/:productId',
  optionalAuthenticate,
  [param('productId').notEmpty()],
  validate,
  ctrl.summarizeReviews,
);

router.post(
  '/content/moderate',
  optionalAuthenticate,
  [body('text').notEmpty().withMessage('text is required').isLength({ max: 5000 })],
  validate,
  ctrl.moderateContent,
);

router.post(
  '/content/email-subject',
  authenticate,
  [
    body('emailType').notEmpty().withMessage('emailType is required'),
    body('context').optional().isObject(),
  ],
  validate,
  ctrl.generateEmailSubject,
);

export default router;
