import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/savedSearch.controller.js';

const router = Router();

// Public routes
router.get('/trending', ctrl.getTrendingSearches);

// Protected routes
router.use(authenticate);

router.get('/saved', ctrl.listSavedSearches);

router.post(
  '/saved',
  [body('query').trim().notEmpty()],
  validate,
  ctrl.createSavedSearch,
);

router.put(
  '/saved/:id',
  [param('id').isUUID(), body('name').trim().notEmpty()],
  validate,
  ctrl.updateSavedSearch,
);

router.patch(
  '/saved/:id/alert',
  [param('id').isUUID(), body('enabled').isBoolean()],
  validate,
  ctrl.toggleAlert,
);

router.delete('/saved/:id', [param('id').isUUID()], validate, ctrl.deleteSavedSearch);

router.get(
  '/history',
  [query('page').optional(), query('limit').optional()],
  validate,
  ctrl.getSearchHistory,
);

router.delete('/history', ctrl.clearSearchHistory);

export default router;
