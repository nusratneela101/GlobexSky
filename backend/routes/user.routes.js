import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import * as ctrl from '../controllers/user.controller.js';

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get authenticated user's profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 profile:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string, example: John Doe }
 *               phone: { type: string, example: '+1234567890' }
 *               language: { type: string, example: en }
 *               currency: { type: string, example: USD }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */


const router = Router();

router.use(authenticate);

router.get('/profile', ctrl.getProfile);
router.put('/profile', [body('full_name').optional().trim()], validate, ctrl.updateProfile);
router.post('/profile/avatar', uploadAvatar.single('avatar'), ctrl.uploadAvatar);

router.get('/addresses', ctrl.getAddresses);
router.post('/addresses', [body('street').notEmpty(), body('city').notEmpty(), body('country').notEmpty()], validate, ctrl.addAddress);
router.put('/addresses/:id', [param('id').isUUID()], validate, ctrl.updateAddress);
router.delete('/addresses/:id', [param('id').isUUID()], validate, ctrl.deleteAddress);

router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

router.put('/change-password',
  [body('current_password').notEmpty(), body('new_password').isLength({ min: 6 })],
  validate,
  ctrl.changePassword,
);

export default router;
