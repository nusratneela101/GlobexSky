import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/socialAuth.controller.js';

const router = Router();

router.post('/google',
  authRateLimiter,
  [body('id_token').notEmpty().withMessage('id_token is required')],
  validate,
  ctrl.googleLogin,
);

router.post('/facebook',
  authRateLimiter,
  [body('access_token').notEmpty().withMessage('access_token is required')],
  validate,
  ctrl.facebookLogin,
);

router.post('/social/link',
  authenticate,
  [
    body('provider').isIn(['google', 'facebook']).withMessage('provider must be google or facebook'),
  ],
  validate,
  ctrl.linkSocialAccount,
);

router.delete('/social/unlink/:provider',
  authenticate,
  [param('provider').isIn(['google', 'facebook']).withMessage('provider must be google or facebook')],
  validate,
  ctrl.unlinkSocialAccount,
);

export default router;
