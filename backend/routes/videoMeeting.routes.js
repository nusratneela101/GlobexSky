import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/videoMeeting.controller.js';

const router = Router();

router.use(authenticate);

router.get('/my-meetings', ctrl.getMyMeetings);

router.post(
  '/schedule',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('scheduled_at').isISO8601().withMessage('Valid scheduled_at is required'),
    body('duration_minutes').optional().isInt({ min: 5, max: 480 }),
    body('invitees').optional().isArray(),
  ],
  validate,
  ctrl.scheduleMeetingHandler,
);

router.post(
  '/',
  [
    body('title').optional().isString(),
    body('max_participants').optional().isInt({ min: 2, max: 50 }),
  ],
  validate,
  ctrl.createMeeting,
);

router.post(
  '/:id/join',
  [
    param('id').isUUID(),
    body('room_code').optional().isString().isLength({ min: 6, max: 6 }),
  ],
  validate,
  ctrl.joinMeeting,
);

router.patch(
  '/:id/end',
  [param('id').isUUID()],
  validate,
  ctrl.endMeeting,
);

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  ctrl.getMeetingDetailsHandler,
);

export default router;
