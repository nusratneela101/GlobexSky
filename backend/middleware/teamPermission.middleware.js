/**
 * backend/middleware/teamPermission.middleware.js
 *
 * Express middleware for team-based RBAC permission checks.
 * Usage: router.get('/:id/orders', authenticate, requireTeamPermission('orders', 'view'), handler)
 */

import Team from '../models/Team.js';

/**
 * Factory: creates middleware that verifies the current user has the given
 * permission (resource + action) within the team identified by req.params.id.
 *
 * @param {string} resource - e.g. 'orders', 'products', 'messages', 'members', 'teams'
 * @param {string} action   - e.g. 'view', 'create', 'edit', 'delete', 'manage'
 * @returns {import('express').RequestHandler}
 */
export function requireTeamPermission(resource, action) {
  return async (req, res, next) => {
    try {
      const teamId = req.params.id || req.params.teamId;
      const userId = req.user?.id;

      if (!teamId || !userId) {
        return res.status(400).json({ success: false, error: 'Missing team or user context.' });
      }

      // Look up the user's membership in this team
      const member = await Team.getMemberByUser(teamId, userId);
      if (!member) {
        return res.status(403).json({ success: false, error: 'You are not a member of this team.' });
      }

      // Owner always has full access
      if (member.role === 'owner') return next();

      const allowed = await Team.checkPermission(teamId, member.role, resource, action);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: `Permission denied: ${action} on ${resource} requires a higher role.`,
        });
      }

      // Attach member info for downstream handlers
      req.teamMember = member;
      next();
    } catch (err) {
      next(err);
    }
  };
}
