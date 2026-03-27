import BaseModel from './BaseModel.js';

/**
 * Team model
 *
 * Tables: teams, team_members, team_invitations, team_permissions,
 *         team_activity_log, team_config
 */
export default class Team extends BaseModel {
  static get tableName() {
    return 'teams';
  }

  // ─── Teams CRUD ──────────────────────────────────────────────────

  /**
   * Create a new team and add the owner as the first member.
   * @param {object} data - { name, description?, logo_url?, max_members? }
   * @param {string} ownerId - User ID of the team owner
   * @returns {Promise<object>}
   */
  static async createTeam(data, ownerId) {
    const team = await this.create({
      ...data,
      owner_id: ownerId,
    });

    // Add owner as first member with 'owner' role and active status
    await this.addMember(team.id, ownerId, 'owner', ownerId);

    // Seed default permissions for this team
    await this._seedDefaultPermissions(team.id);

    return team;
  }

  // ─── Members ─────────────────────────────────────────────────────

  /**
   * Add a member to a team.
   * @param {string} teamId
   * @param {string} userId
   * @param {string} role
   * @param {string} invitedBy
   * @returns {Promise<object>}
   */
  static async addMember(teamId, userId, role, invitedBy) {
    const now = new Date().toISOString();
    const result = await this.db
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        status: 'active',
        invited_by: invitedBy,
        invited_at: now,
        joined_at: now,
      })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Remove a member from a team (soft-delete by setting status to 'removed').
   * @param {string} teamId
   * @param {string} memberId - team_members.id
   * @returns {Promise<object>}
   */
  static async removeMember(teamId, memberId) {
    const result = await this.db
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', memberId)
      .eq('team_id', teamId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Update a member's role.
   * @param {string} teamId
   * @param {string} memberId
   * @param {string} newRole
   * @returns {Promise<object>}
   */
  static async updateMemberRole(teamId, memberId, newRole) {
    const result = await this.db
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('team_id', teamId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get all active/invited members for a team.
   * @param {string} teamId
   * @returns {Promise<object[]>}
   */
  static async getTeamMembers(teamId) {
    const result = await this.db
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .in('status', ['active', 'invited'])
      .order('created_at', { ascending: true });
    return this._handle(result);
  }

  /**
   * Get all teams for a user (where user is an active member).
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async getTeamsByUser(userId) {
    const result = await this.db
      .from('team_members')
      .select('*, team:teams(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Get the member record for a user in a specific team.
   * @param {string} teamId
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  static async getMemberByUser(teamId, userId) {
    const result = await this.db
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  // ─── Invitations ─────────────────────────────────────────────────

  /**
   * Create an email invitation for a team.
   * @param {string} teamId
   * @param {string} email
   * @param {string} role
   * @param {string} token
   * @param {string} expiresAt - ISO timestamp
   * @returns {Promise<object>}
   */
  static async inviteByEmail(teamId, email, role, token, expiresAt) {
    const result = await this.db
      .from('team_invitations')
      .insert({ team_id: teamId, email, role, token, status: 'pending', expires_at: expiresAt })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Look up an invitation by token and accept it.
   * @param {string} token
   * @param {string} userId
   * @returns {Promise<object>} The updated invitation
   */
  static async acceptInvitation(token, userId) {
    // Fetch invitation
    const fetchResult = await this.db
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();
    const invitation = this._handle(fetchResult);

    if (new Date(invitation.expires_at) < new Date()) {
      // Mark expired
      await this.db
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      throw Object.assign(new Error('Invitation has expired.'), { statusCode: 410 });
    }

    // Mark accepted
    const updateResult = await this.db
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)
      .select()
      .single();
    const accepted = this._handle(updateResult);

    // Add user as team member
    await this.addMember(invitation.team_id, userId, invitation.role, null);

    return accepted;
  }

  /**
   * Get invitation details by token (public — used on the accept page).
   * @param {string} token
   * @returns {Promise<object|null>}
   */
  static async getInvitationByToken(token) {
    const result = await this.db
      .from('team_invitations')
      .select('*, team:teams(name, logo_url)')
      .eq('token', token)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  // ─── Permissions ─────────────────────────────────────────────────

  /**
   * Check whether a role has a specific action on a resource within a team.
   * First checks team-specific permissions, then falls back to global defaults (team_id IS NULL).
   * @param {string} teamId
   * @param {string} role
   * @param {string} resource
   * @param {string} action
   * @returns {Promise<boolean>}
   */
  static async checkPermission(teamId, role, resource, action) {
    // Check team-specific permissions first
    let result = await this.db
      .from('team_permissions')
      .select('actions')
      .eq('team_id', teamId)
      .eq('role', role)
      .eq('resource', resource)
      .maybeSingle();

    if (result.error) throw result.error;

    if (result.data) {
      return (result.data.actions || []).includes(action);
    }

    // Fall back to global defaults (team_id IS NULL)
    result = await this.db
      .from('team_permissions')
      .select('actions')
      .is('team_id', null)
      .eq('role', role)
      .eq('resource', resource)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data ? (result.data.actions || []).includes(action) : false;
  }

  /**
   * Get all permissions for a team (team-specific + global defaults).
   * @param {string} teamId
   * @returns {Promise<object[]>}
   */
  static async getTeamPermissions(teamId) {
    const result = await this.db
      .from('team_permissions')
      .select('*')
      .or(`team_id.eq.${teamId},team_id.is.null`)
      .order('role', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a permission entry for a team.
   * @param {string} teamId
   * @param {string} role
   * @param {string} resource
   * @param {string[]} actions
   * @returns {Promise<object>}
   */
  static async setPermission(teamId, role, resource, actions) {
    const result = await this.db
      .from('team_permissions')
      .upsert(
        { team_id: teamId, role, resource, actions, created_at: new Date().toISOString() },
        { onConflict: 'team_id,role,resource' },
      )
      .select()
      .single();
    return this._handle(result);
  }

  // ─── Activity Log ────────────────────────────────────────────────

  /**
   * Record an activity log entry for a team.
   * @param {object} entry - { team_id, user_id, action, resource?, resource_id?, details?, ip_address? }
   * @returns {Promise<object>}
   */
  static async logActivity(entry) {
    const result = await this.db
      .from('team_activity_log')
      .insert(entry)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Get paginated activity log for a team.
   * @param {string} teamId
   * @param {number} [page=1]
   * @param {number} [limit=20]
   * @returns {Promise<{ data: object[], total: number }>}
   */
  static async getActivityLog(teamId, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const result = await this.db
      .from('team_activity_log')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(from, to);
    const { data, error, count } = result;
    if (error) throw error;
    return { data, total: count };
  }

  // ─── Config ──────────────────────────────────────────────────────

  /**
   * Get all team config entries.
   * @returns {Promise<object[]>}
   */
  static async getConfig() {
    const result = await this.db
      .from('team_config')
      .select('*')
      .order('key', { ascending: true });
    return this._handle(result);
  }

  /**
   * Upsert a config entry.
   * @param {string} key
   * @param {string} value
   * @param {string} actorId
   * @returns {Promise<object>}
   */
  static async setConfig(key, value, actorId) {
    const result = await this.db
      .from('team_config')
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: actorId },
        { onConflict: 'key' },
      )
      .select()
      .single();
    return this._handle(result);
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /**
   * Seed default permissions for a new team (copies global defaults).
   * @private
   */
  static async _seedDefaultPermissions(teamId) {
    const globalResult = await this.db
      .from('team_permissions')
      .select('role, resource, actions')
      .is('team_id', null);
    const globals = this._handle(globalResult);

    if (globals.length > 0) {
      const rows = globals.map((g) => ({
        team_id: teamId,
        role: g.role,
        resource: g.resource,
        actions: g.actions,
      }));
      await this.db.from('team_permissions').insert(rows);
    }
  }
}
