import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/chat.controller.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', ctrl.listConversations);
router.get('/conversations/:id/messages', [param('id').isUUID()], validate, ctrl.getMessages);
router.post('/conversations',
  [body('participant_id').isUUID()],
  validate,
  ctrl.createConversation,
);
router.post('/conversations/:id/messages',
  [param('id').isUUID(), body('content').notEmpty()],
  validate,
  ctrl.sendMessage,
);
router.patch('/conversations/:id/read', [param('id').isUUID()], validate, ctrl.markMessagesRead);

export default router;
