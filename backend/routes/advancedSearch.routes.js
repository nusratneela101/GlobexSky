import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import * as ctrl from '../controllers/advancedSearch.controller.js';

const router = Router();

// Public
router.get('/', [query('q').optional().trim()], validate, ctrl.textSearch);
router.post('/barcode', [body('barcode').trim().notEmpty().withMessage('barcode is required')], validate, ctrl.barcodeSearch);
router.get('/suggestions', [query('q').optional().trim()], validate, ctrl.getSearchSuggestions);

// Authenticated
router.post('/voice', authenticate, [body('transcription').trim().notEmpty().withMessage('transcription is required')], validate, ctrl.voiceSearch);
router.post('/image', authenticate, [body('imageBase64').notEmpty().withMessage('imageBase64 is required')], validate, ctrl.imageSearch);

// Admin
router.get('/analytics', authenticate, requireAdmin, ctrl.getSearchAnalytics);

export default router;
