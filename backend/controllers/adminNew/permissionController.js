/**
 * Admin Permission Controller
 * Manages roles, permissions, user assignments, and audit logs.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/roles — list all admin roles */
export async function getRoles(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('admin_roles')
      .select('*')
      .order('name', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/admin/roles — create custom admin role */
export async function createRole(req, res, next) {
  try {
    const { name, permissions = [], description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Role name is required.' });

    const { data, error } = await supabase
      .from('admin_roles')
      .insert({ name, permissions, description, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/roles/:id — modify role permissions */
export async function updateRole(req, res, next) {
  try {
    const { name, permissions, description } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (permissions !== undefined) updates.permissions = permissions;
    if (description !== undefined) updates.description = description;

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
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', req.params.id);

    if (count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete role: ${count} user(s) are assigned to it.`,
      });
    }

    const { error } = await supabase.from('admin_roles').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Role deleted.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/permissions — list all available permissions */
export async function getPermissions(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('module', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/admin/users/:id/roles — assign role to admin user */
export async function assignRole(req, res, next) {
  try {
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ success: false, error: 'roleId is required.' });

    const { data, error } = await supabase
      .from('admin_users')
      .upsert(
        { user_id: req.params.id, role_id: roleId, assigned_by: req.user?.id, created_at: new Date().toISOString() },
        { onConflict: 'user_id,role_id' },
      )
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/users/:id/roles/:roleId — remove role from admin user */
export async function removeRole(req, res, next) {
  try {
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('user_id', req.params.id)
      .eq('role_id', req.params.roleId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Role removed from user.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/audit-log — who did what, when (with before/after values) */
export async function getAuditLog(req, res, next) {
  try {
    const { page = 1, limit = 50, admin_id, action, resource_type, from_date, to_date } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('admin_audit_log')
      .select('*, admin_actor:profiles!admin_id(id, full_name, email)', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (admin_id) query = query.eq('admin_id', admin_id);
    if (action) query = query.eq('action', action);
    if (resource_type) query = query.eq('resource_type', resource_type);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/permission-matrix — role vs permission grid */
export async function getPermissionMatrix(req, res, next) {
  try {
    const [rolesRes, permissionsRes] = await Promise.all([
      supabase.from('admin_roles').select('id, name, permissions').order('name'),
      supabase.from('permissions').select('id, name, module').order('module'),
    ]);

    if (rolesRes.error) return res.status(400).json({ success: false, error: rolesRes.error.message });
    if (permissionsRes.error) return res.status(400).json({ success: false, error: permissionsRes.error.message });

    const matrix = (rolesRes.data || []).map((role) => ({
      role_id: role.id,
      role_name: role.name,
      permissions: (permissionsRes.data || []).map((perm) => ({
        permission_id: perm.id,
        permission_name: perm.name,
        module: perm.module,
        granted: Array.isArray(role.permissions) && role.permissions.includes(perm.name),
      })),
    }));

    res.json({ success: true, data: { roles: rolesRes.data || [], permissions: permissionsRes.data || [], matrix } });
  } catch (err) { next(err); }
}
