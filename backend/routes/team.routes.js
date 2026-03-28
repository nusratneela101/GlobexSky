import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import { requireTeamPermission } from '../middleware/teamPermission.middleware.js';
import * as ctrl from '../controllers/team.controller.js';

const router = Router();

// ─── Public invitation lookup (no auth needed for viewing invitation details) ──
// This must be before authenticate middleware

// ─── All remaining routes require authentication ──────────────────────────────
router.use(authenticate);

// ─── Config routes (must come BEFORE /:id wildcard) ───────────────────────────

/** GET /api/v1/teams/config — admin: get all config entries */
router.get('/config', requireAdmin, ctrl.getConfig);

/** PUT /api/v1/teams/config — admin: update config key/value pairs */
router.put('/config', requireAdmin, ctrl.updateConfig);

// ─── Invitation acceptance (uses token, not :id) ──────────────────────────────

/** POST /api/v1/teams/invitations/:token/accept — accept invitation */
router.post(
  '/invitations/:token/accept',
  [param('token').isString().isLength({ min: 16 })],
  validate,
  ctrl.acceptInvitation,
);

// ─── Team CRUD ────────────────────────────────────────────────────────────────

/** POST /api/v1/teams — create a new team */
router.post(
  '/',
  [
    body('name').notEmpty().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('logo_url').optional().isURL(),
  ],
  validate,
  ctrl.createTeam,
);

/** GET /api/v1/teams — get user's teams */
router.get('/', ctrl.getTeams);

/** GET /api/v1/teams/:id — get team details */
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  ctrl.getTeam,
);

/** PUT /api/v1/teams/:id — update team */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('logo_url').optional().isURL(),
  ],
  validate,
  requireTeamPermission('teams', 'edit'),
  ctrl.updateTeam,
);

/** DELETE /api/v1/teams/:id — delete team (owner only) */
router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  ctrl.deleteTeam,
);

// ─── Members ──────────────────────────────────────────────────────────────────

/** GET /api/v1/teams/:id/members — list members */
router.get(
  '/:id/members',
  [param('id').isUUID()],
  validate,
  requireTeamPermission('members', 'view'),
  ctrl.getMembers,
);

/** POST /api/v1/teams/:id/members/invite — invite by email */
router.post(
  '/:id/members/invite',
  [
    param('id').isUUID(),
    body('email').isEmail(),
    body('role').isIn(['admin', 'manager', 'member', 'viewer']),
  ],
  validate,
  requireTeamPermission('members', 'manage'),
  ctrl.inviteMember,
);

/** PUT /api/v1/teams/:id/members/:memberId/role — change role */
router.put(
  '/:id/members/:memberId/role',
  [
    param('id').isUUID(),
    param('memberId').isUUID(),
    body('role').isIn(['admin', 'manager', 'member', 'viewer']),
  ],
  validate,
  requireTeamPermission('members', 'manage'),
  ctrl.updateMemberRole,
);

/** DELETE /api/v1/teams/:id/members/:memberId — remove member */
router.delete(
  '/:id/members/:memberId',
  [param('id').isUUID(), param('memberId').isUUID()],
  validate,
  requireTeamPermission('members', 'manage'),
  ctrl.removeMember,
);

// ─── Permissions ──────────────────────────────────────────────────────────────

/** GET /api/v1/teams/:id/permissions — get team permissions */
router.get(
  '/:id/permissions',
  [param('id').isUUID()],
  validate,
  requireTeamPermission('teams', 'view'),
  ctrl.getPermissions,
);

/** PUT /api/v1/teams/:id/permissions — update permissions */
router.put(
  '/:id/permissions',
  [
    param('id').isUUID(),
    body('permissions').isArray({ min: 1 }),
  ],
  validate,
  requireTeamPermission('teams', 'manage'),
  ctrl.updatePermissions,
);

// ─── Activity Log ─────────────────────────────────────────────────────────────

/** GET /api/v1/teams/:id/activity — get activity log */
router.get(
  '/:id/activity',
  [
    param('id').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  requireTeamPermission('teams', 'view'),
  ctrl.getActivityLog,
);

export default router;
