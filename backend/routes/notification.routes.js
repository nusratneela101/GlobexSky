import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/:id/read', [param('id').isUUID()], validate, ctrl.markRead);
router.patch('/mark-all-read', ctrl.markAllRead);
router.delete('/:id', [param('id').isUUID()], validate, ctrl.deleteNotification);

export default router;
