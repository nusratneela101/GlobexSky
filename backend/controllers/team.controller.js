/**
 * backend/controllers/team.controller.js
 *
 * Controller for the Sub-Accounts & Team Management API.
 * All mutations are activity-logged via the team service.
 */

import Team from '../models/Team.js';
import * as teamService from '../services/team.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, error: message });
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

// ─── POST /api/v1/teams ───────────────────────────────────────────────────────

/** Create a new team. */
export async function createTeam(req, res, next) {
  try {
    const { name, description, logo_url } = req.body;
    const team = await teamService.createTeam({ name, description, logo_url }, req.user.id);

    await teamService.logActivity({
      team_id: team.id,
      user_id: req.user.id,
      action: 'team_created',
      resource: 'teams',
      resource_id: team.id,
      details: { name },
      ip_address: clientIp(req),
    });

    return res.status(201).json({ success: true, data: team });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/teams ────────────────────────────────────────────────────────

/** Get all teams for the current user. */
export async function getTeams(req, res, next) {
  try {
    const memberships = await Team.getTeamsByUser(req.user.id);
    return res.json({ success: true, data: memberships });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/teams/:id ────────────────────────────────────────────────────

/** Get team details. */
export async function getTeam(req, res, next) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return sendError(res, 404, 'Team not found.');
    return res.json({ success: true, data: team });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/teams/:id ────────────────────────────────────────────────────

/** Update a team. */
export async function updateTeam(req, res, next) {
  try {
    const team = await teamService.updateTeam(req.params.id, req.body);

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'team_updated',
      resource: 'teams',
      resource_id: req.params.id,
      details: { fields: Object.keys(req.body) },
      ip_address: clientIp(req),
    });

    return res.json({ success: true, data: team });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── DELETE /api/v1/teams/:id ─────────────────────────────────────────────────

/** Delete a team (owner only). */
export async function deleteTeam(req, res, next) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return sendError(res, 404, 'Team not found.');
    if (team.owner_id !== req.user.id) {
      return sendError(res, 403, 'Only the team owner can delete the team.');
    }

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'team_deleted',
      resource: 'teams',
      resource_id: req.params.id,
      details: { name: team.name },
      ip_address: clientIp(req),
    });

    await teamService.deleteTeam(req.params.id);
    return res.json({ success: true, message: 'Team deleted.' });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/teams/:id/members ────────────────────────────────────────────

/** List team members. */
export async function getMembers(req, res, next) {
  try {
    const members = await Team.getTeamMembers(req.params.id);
    return res.json({ success: true, data: members });
  } catch (err) { next(err); }
}

// ─── POST /api/v1/teams/:id/members/invite ────────────────────────────────────

/** Invite a member by email. */
export async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body;
    const invitation = await teamService.inviteMember(req.params.id, email, role, req.user.id);

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'member_invited',
      resource: 'members',
      resource_id: invitation.id,
      details: { email, role },
      ip_address: clientIp(req),
    });

    return res.status(201).json({ success: true, data: invitation });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── PUT /api/v1/teams/:id/members/:memberId/role ─────────────────────────────

/** Change a member's role. */
export async function updateMemberRole(req, res, next) {
  try {
    const { role } = req.body;
    const member = await Team.updateMemberRole(req.params.id, req.params.memberId, role);

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'member_role_changed',
      resource: 'members',
      resource_id: req.params.memberId,
      details: { new_role: role },
      ip_address: clientIp(req),
    });

    return res.json({ success: true, data: member });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── DELETE /api/v1/teams/:id/members/:memberId ───────────────────────────────

/** Remove a member from the team. */
export async function removeMember(req, res, next) {
  try {
    const member = await Team.removeMember(req.params.id, req.params.memberId);

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'member_removed',
      resource: 'members',
      resource_id: req.params.memberId,
      ip_address: clientIp(req),
    });

    return res.json({ success: true, data: member });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── POST /api/v1/teams/invitations/:token/accept ─────────────────────────────

/** Accept an invitation by token. */
export async function acceptInvitation(req, res, next) {
  try {
    const invitation = await teamService.acceptInvitation(req.params.token, req.user.id);

    await teamService.logActivity({
      team_id: invitation.team_id,
      user_id: req.user.id,
      action: 'invitation_accepted',
      resource: 'members',
      details: { token: req.params.token },
      ip_address: clientIp(req),
    });

    return res.json({ success: true, data: invitation });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/teams/:id/permissions ────────────────────────────────────────

/** Get permissions for a team. */
export async function getPermissions(req, res, next) {
  try {
    const permissions = await Team.getTeamPermissions(req.params.id);
    return res.json({ success: true, data: permissions });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/teams/:id/permissions ────────────────────────────────────────

/** Update team permissions. Body: { permissions: [{ role, resource, actions }] } */
export async function updatePermissions(req, res, next) {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return sendError(res, 400, 'Body must contain a permissions array.');
    }

    const results = [];
    for (const perm of permissions) {
      results.push(await Team.setPermission(req.params.id, perm.role, perm.resource, perm.actions));
    }

    await teamService.logActivity({
      team_id: req.params.id,
      user_id: req.user.id,
      action: 'permissions_updated',
      resource: 'teams',
      resource_id: req.params.id,
      details: { count: permissions.length },
      ip_address: clientIp(req),
    });

    return res.json({ success: true, data: results });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.statusCode, err.message);
    next(err);
  }
}

// ─── GET /api/v1/teams/:id/activity ───────────────────────────────────────────

/** Get team activity log. */
export async function getActivityLog(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data, total } = await Team.getActivityLog(req.params.id, Number(page), Number(limit));
    return res.json({
      success: true,
      data,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/teams/config ─────────────────────────────────────────────────

/** Admin: get team config. */
export async function getConfig(req, res, next) {
  try {
    const rows = await Team.getConfig();
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ─── PUT /api/v1/teams/config ─────────────────────────────────────────────────

/** Admin: update team config. */
export async function updateConfig(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return sendError(res, 400, 'Request body must be a key→value object.');
    }
    const results = await teamService.saveTeamConfig(updates, req.user.id);
    return res.json({ success: true, data: results });
  } catch (err) { next(err); }
}
