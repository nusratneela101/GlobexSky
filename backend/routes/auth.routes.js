import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 2 }),
    body('role').optional().isIn(['buyer', 'supplier', 'carrier']),
  ],
  validate,
  ctrl.register,
);

router.post('/login',
  authRateLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  ctrl.login,
);

router.post('/logout', authenticate, ctrl.logout);

router.post('/forgot-password',
  authRateLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  ctrl.forgotPassword,
);

router.post('/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 6 })],
  validate,
  ctrl.resetPassword,
);

router.get('/me', authenticate, ctrl.getMe);

router.post('/verify-email', [body('token').notEmpty()], validate, ctrl.verifyEmail);

router.get('/kyc-status', authenticate, ctrl.getKYCStatus);

export default router;
