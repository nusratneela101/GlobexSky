/**
 * backend/services/team.service.js
 *
 * Business logic for the Sub-Accounts & Team Management System.
 * - Email invitations (uses existing SMTP config)
 * - Permission checking
 * - Activity logging
 * - Token generation for invitations
 */

import crypto from 'crypto';
import Team from '../models/Team.js';
import { sendGenericEmail } from './email.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://globexsky.com';

// ─── Config helpers ───────────────────────────────────────────────────────────

/**
 * Read all team config from DB and return as a plain key→value map.
 * @returns {Promise<Record<string, string>>}
 */
export async function getTeamConfig() {
  const rows = await Team.getConfig();
  const cfg = {};
  for (const row of rows) {
    cfg[row.key] = row.value ?? '';
  }
  return cfg;
}

/**
 * Save multiple config key/value pairs.
 * @param {Record<string, string>} updates
 * @param {string} actorId
 * @returns {Promise<object[]>}
 */
export async function saveTeamConfig(updates, actorId) {
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    results.push(await Team.setConfig(key, String(value), actorId));
  }
  return results;
}

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Generate a secure random token for invitations.
 * @returns {string}
 */
export function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Team CRUD ────────────────────────────────────────────────────────────────

/**
 * Create a team after validating config limits.
 * @param {object} data - { name, description?, logo_url? }
 * @param {string} ownerId
 * @returns {Promise<object>}
 */
export async function createTeam(data, ownerId) {
  const cfg = await getTeamConfig();

  if (cfg.feature_enabled !== 'true') {
    throw Object.assign(new Error('Team management is currently disabled.'), { statusCode: 503 });
  }

  // Check max teams per user
  const maxTeams = parseInt(cfg.max_teams_per_user || '3', 10);
  const userTeams = await Team.getTeamsByUser(ownerId);
  const ownedTeams = userTeams.filter((m) => m.role === 'owner');
  if (ownedTeams.length >= maxTeams) {
    throw Object.assign(
      new Error(`You can own a maximum of ${maxTeams} teams.`),
      { statusCode: 422 },
    );
  }

  const maxMembers = parseInt(cfg.max_members_per_team || '10', 10);
  const team = await Team.createTeam({ ...data, max_members: maxMembers }, ownerId);
  return team;
}

/**
 * Update a team. Only owner/admin can update.
 * @param {string} teamId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateTeam(teamId, data) {
  const allowedFields = ['name', 'description', 'logo_url'];
  const updates = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  updates.updated_at = new Date().toISOString();
  return Team.update(teamId, updates);
}

/**
 * Delete a team. Only owner can delete.
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export async function deleteTeam(teamId) {
  return Team.delete(teamId);
}

// ─── Invitations ──────────────────────────────────────────────────────────────

/**
 * Send an email invitation to join a team.
 * @param {string} teamId
 * @param {string} email
 * @param {string} role
 * @param {string} invitedById
 * @returns {Promise<object>}
 */
export async function inviteMember(teamId, email, role, invitedById) {
  const cfg = await getTeamConfig();

  if (cfg.feature_enabled !== 'true') {
    throw Object.assign(new Error('Team management is currently disabled.'), { statusCode: 503 });
  }

  // Validate role
  const allowedRoles = (cfg.allowed_roles || 'owner,admin,manager,member,viewer').split(',');
  if (!allowedRoles.includes(role) || role === 'owner') {
    throw Object.assign(new Error(`Invalid role: ${role}`), { statusCode: 400 });
  }

  // Check member limit
  const members = await Team.getTeamMembers(teamId);
  const team = await Team.findById(teamId);
  if (!team) throw Object.assign(new Error('Team not found.'), { statusCode: 404 });
  const maxMembers = parseInt(cfg.max_members_per_team || '10', 10);
  if (members.length >= maxMembers) {
    throw Object.assign(
      new Error(`Team has reached the maximum of ${maxMembers} members.`),
      { statusCode: 422 },
    );
  }

  // Generate token & expiry
  const token = generateInvitationToken();
  const expiryHours = parseInt(cfg.invitation_expiry_hours || '72', 10);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  const invitation = await Team.inviteByEmail(teamId, email, role, token, expiresAt);

  // Send email (best-effort; don't fail the request if email fails)
  const inviteUrl = `${FRONTEND_URL}/pages/teams/invitation.html?token=${token}`;
  try {
    await sendGenericEmail(email, {
      subject: `You're invited to join ${team.name} on GlobexSky`,
      body: `
        <h2>Team Invitation</h2>
        <p>You've been invited to join <strong>${team.name}</strong> as a <strong>${role}</strong>.</p>
        <p>Click the link below to accept the invitation:</p>
        <p><a href="${inviteUrl}" style="background:#0052CC;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Accept Invitation</a></p>
        <p>This invitation expires in ${expiryHours} hours.</p>
      `,
    });
  } catch {
    // Email failure is non-blocking
  }

  return invitation;
}

/**
 * Accept an invitation by token.
 * @param {string} token
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function acceptInvitation(token, userId) {
  return Team.acceptInvitation(token, userId);
}

// ─── Permission checking ──────────────────────────────────────────────────────

/**
 * Check if a user has a specific permission in a team.
 * @param {string} teamId
 * @param {string} userId
 * @param {string} resource
 * @param {string} action
 * @returns {Promise<boolean>}
 */
export async function checkPermission(teamId, userId, resource, action) {
  const member = await Team.getMemberByUser(teamId, userId);
  if (!member) return false;
  return Team.checkPermission(teamId, member.role, resource, action);
}

// ─── Activity logging ─────────────────────────────────────────────────────────

/**
 * Log a team activity event.
 * @param {object} entry
 * @returns {Promise<object|null>}
 */
export async function logActivity(entry) {
  try {
    const cfg = await getTeamConfig();
    if (cfg.enable_activity_log !== 'true') return null;
    return Team.logActivity(entry);
  } catch {
    // Activity logging failures should never break the main flow
    return null;
  }
}
