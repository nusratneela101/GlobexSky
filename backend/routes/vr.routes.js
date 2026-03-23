import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/* ─────────────────────────────────────────────────────────────
   Public endpoints (no auth required)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/vr/products
 * List products available in the VR showroom.
 */
router.get(
  '/products',
  [
    query('category').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  (_req, res) => {
    // Stub — replace with real DB query
    res.json({
      success: true,
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    });
  },
);

/**
 * GET /api/v1/vr/products/:id
 * Get a single product's VR metadata (3D model URL, hotspots, dimensions).
 */
router.get(
  '/products/:id',
  [param('id').notEmpty()],
  validate,
  (req, res) => {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        model_url: null,
        ar_model_url: null,
        hotspots: [],
        dimensions: null,
      },
    });
  },
);

/**
 * GET /api/v1/vr/showrooms
 * List available virtual showroom environments.
 */
router.get('/showrooms', (_req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'main',        name: 'Main Hall',          description: 'General merchandise', active: true },
      { id: 'electronics', name: 'Electronics Hall',   description: 'Electronic components', active: true },
      { id: 'machinery',   name: 'Machinery Hall',     description: 'Industrial equipment', active: true },
      { id: 'safety',      name: 'Safety & PPE Hall',  description: 'Personal protection equipment', active: true },
      { id: 'lighting',    name: 'Lighting Showroom',  description: 'LED & lighting products', active: true },
    ],
  });
});

/**
 * GET /api/v1/vr/showrooms/:id/presence
 * Get the number of live users currently in a showroom.
 */
router.get(
  '/showrooms/:id/presence',
  [param('id').notEmpty()],
  validate,
  (_req, res) => {
    res.json({
      success: true,
      data: { active_users: Math.floor(Math.random() * 8) + 1 },
    });
  },
);

/**
 * GET /api/v1/vr/factory-tours
 * List factory tours available for virtual walkthrough.
 */
router.get('/factory-tours', (_req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

/**
 * GET /api/v1/vr/factory-tours/:id
 * Get a specific factory tour metadata (stops, hotspots, panoramas).
 */
router.get(
  '/factory-tours/:id',
  [param('id').notEmpty()],
  validate,
  (req, res) => {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        name: '',
        stops: [],
      },
    });
  },
);

/* ─────────────────────────────────────────────────────────────
   Authenticated endpoints
───────────────────────────────────────────────────────────── */

router.use(authenticate);

/**
 * POST /api/v1/vr/sessions
 * Create a new VR showroom session (multi-user).
 */
router.post(
  '/sessions',
  [
    body('showroom_id').notEmpty().withMessage('showroom_id is required'),
    body('session_name').optional().isString().trim().isLength({ max: 120 }),
    body('max_participants').optional().isInt({ min: 1, max: 10 }),
  ],
  validate,
  (req, res) => {
    res.status(201).json({
      success: true,
      data: {
        session_id: `vr_${Date.now()}`,
        showroom_id: req.body.showroom_id,
        join_url: `/pages/vr/showroom.html?session=vr_${Date.now()}`,
        created_at: new Date().toISOString(),
      },
    });
  },
);

/**
 * POST /api/v1/vr/sessions/:id/join
 * Join an existing VR session.
 */
router.post(
  '/sessions/:id/join',
  [param('id').notEmpty()],
  validate,
  (req, res) => {
    res.json({
      success: true,
      data: {
        session_id: req.params.id,
        token: `vr_token_${Date.now()}`,
        joined_at: new Date().toISOString(),
      },
    });
  },
);

/**
 * DELETE /api/v1/vr/sessions/:id
 * End / leave a VR session.
 */
router.delete(
  '/sessions/:id',
  [param('id').notEmpty()],
  validate,
  (_req, res) => {
    res.json({ success: true, message: 'Session ended.' });
  },
);

/**
 * POST /api/v1/vr/ar-sessions
 * Record an AR product placement session for analytics.
 */
router.post(
  '/ar-sessions',
  [
    body('product_id').notEmpty().withMessage('product_id is required'),
    body('duration_seconds').optional().isInt({ min: 0 }),
    body('device_type').optional().isIn(['mobile', 'tablet', 'desktop']),
    body('ar_supported').optional().isBoolean(),
  ],
  validate,
  (req, res) => {
    res.status(201).json({
      success: true,
      data: {
        ar_session_id: `ar_${Date.now()}`,
        product_id: req.body.product_id,
        recorded_at: new Date().toISOString(),
      },
    });
  },
);

/**
 * POST /api/v1/vr/factory-tours/:id/schedule
 * Submit a factory tour scheduling request.
 */
router.post(
  '/factory-tours/:id/schedule',
  [
    param('id').notEmpty(),
    body('preferred_date').isISO8601().withMessage('preferred_date must be a valid ISO date'),
    body('preferred_time').optional().isString().trim(),
    body('purpose').optional().isString().trim().isLength({ max: 500 }),
    body('contact_name').trim().notEmpty().withMessage('contact_name is required'),
    body('contact_email').isEmail().withMessage('A valid contact_email is required'),
    body('contact_phone').optional().isString().trim(),
    body('company').optional().isString().trim(),
    body('notes').optional().isString().trim().isLength({ max: 1000 }),
  ],
  validate,
  (req, res) => {
    res.status(201).json({
      success: true,
      message: 'Factory tour request submitted. You will receive confirmation within 2 hours.',
      data: {
        request_id: `tour_req_${Date.now()}`,
        supplier_id: req.params.id,
        preferred_date: req.body.preferred_date,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    });
  },
);

/**
 * GET /api/v1/vr/factory-tours/my-requests
 * Get the authenticated user's factory tour requests.
 */
router.get('/factory-tours/my-requests', (req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

/**
 * GET /api/v1/vr/sessions
 * List the authenticated user's active VR sessions.
 */
router.get('/sessions', (_req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

/**
 * POST /api/v1/vr/track
 * Track a VR/AR product interaction for analytics.
 */
router.post(
  '/track',
  [
    body('product_id').notEmpty().withMessage('product_id is required'),
    body('event').isIn(['view', 'rotate', 'zoom', 'ar_place', 'add_to_cart', 'inquiry'])
      .withMessage('Unknown event type'),
    body('showroom_id').optional().isString().trim(),
    body('session_id').optional().isString().trim(),
    body('duration_ms').optional().isInt({ min: 0 }),
  ],
  validate,
  (req, res) => {
    res.status(201).json({
      success: true,
      data: {
        tracked: true,
        event: req.body.event,
        product_id: req.body.product_id,
        recorded_at: new Date().toISOString(),
      },
    });
  },
);

/**
 * GET /api/v1/vr/showroom/:supplierId
 * Get a supplier's VR showroom configuration.
 */
router.get(
  '/showroom/:supplierId',
  [param('supplierId').notEmpty()],
  validate,
  (req, res) => {
    res.json({
      success: true,
      data: {
        supplier_id: req.params.supplierId,
        layout: 'corridor',
        theme: 'default',
        products: [],
        banner_url: null,
      },
    });
  },
);

export default router;
