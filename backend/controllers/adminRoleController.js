/**
 * Admin Roles Controller
 * CRUD for admin roles, permissions, and activity logs.
 */

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/** GET /api/admin/roles */
export async function listRoles(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('admin_roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/roles */
export async function createRole(req, res, next) {
  try {
    const { name, permissions = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Role name is required.' });

    const { data, error } = await supabase
      .from('admin_roles')
      .insert({ name, permissions, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/roles/:id */
export async function updateRole(req, res, next) {
  try {
    const { name, permissions } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (permissions !== undefined) updates.permissions = permissions;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('admin_roles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/roles/:id */
export async function deleteRole(req, res, next) {
  try {
    // Check if any admin users are assigned to this role
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', req.params.id);

    if (count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete role: ${count} admin user(s) are assigned to it.`,
      });
    }

    const { error } = await supabase.from('admin_roles').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Role deleted.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/activity-logs */
export async function listActivityLogs(req, res, next) {
  try {
    const { page = 1, limit = 50, admin_id, action, resource_type } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('admin_activity_logs')
      .select('*, admin:profiles!admin_id(id, full_name, email)', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (admin_id) query = query.eq('admin_id', admin_id);
    if (action) query = query.eq('action', action);
    if (resource_type) query = query.eq('resource_type', resource_type);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/activity-logs — log an admin action (internal use) */
export async function logActivity(adminId, action, resourceType, resourceId, details, ipAddress) {
  try {
    await supabase.from('admin_activity_logs').insert({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? JSON.stringify(details) : null,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    });
  } catch (_) {
    // Non-critical — don't let logging failures break the main flow
  }
}

// ─── Admin Users (assign roles) ───────────────────────────────────────────────

/** GET /api/admin/admin-users */
export async function listAdminUsers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*, profile:profiles(id, full_name, email), role:admin_roles(id, name, permissions)')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/admin-users — assign admin role to a user */
export async function assignAdminRole(req, res, next) {
  try {
    const { user_id, role_id } = req.body;
    if (!user_id || !role_id) {
      return res.status(400).json({ success: false, error: 'user_id and role_id are required.' });
    }

    const { data, error } = await supabase
      .from('admin_users')
      .upsert({ user_id, role_id, created_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
