/**
 * Admin User Controller
 * Extended user management for the admin panel.
 */

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/** GET /api/admin/users — paginated, filterable user list */
export async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, role, status, search, date_from, date_to } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    }
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/admin/users/export — export users as JSON/CSV */
export async function exportUsers(req, res, next) {
  try {
    const { role, status, format = 'json' } = req.query;
    let query = supabase
      .from('profiles')
      .select('id,full_name,email,phone,role,status,created_at')
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      return res.send(`${headers}\n${rows}`);
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/users/:id — get full user details */
export async function getUser(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !profile) return res.status(404).json({ success: false, error: 'User not found.' });

    // Fetch related data in parallel
    const [orders, reviews] = await Promise.all([
      supabase.from('orders').select('id,status,total_amount,created_at').eq('buyer_id', req.params.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('reviews').select('id,rating,comment,created_at').eq('reviewer_id', req.params.id).order('created_at', { ascending: false }).limit(10),
    ]);

    res.json({
      success: true,
      data: {
        profile,
        recent_orders: orders.data || [],
        recent_reviews: reviews.data || [],
      },
    });
  } catch (err) { next(err); }
}

/** PUT /api/admin/users/:id — update user profile */
export async function updateUser(req, res, next) {
  try {
    const allowed = ['full_name', 'phone', 'company_name', 'address', 'role', 'status', 'verification_status'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/users/:id/role — change user role */
export async function changeUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, error: 'Role is required.' });

    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/users/:id/status — activate/deactivate/suspend/ban */
export async function changeUserStatus(req, res, next) {
  try {
    const { status, reason } = req.body;
    const allowed = ['active', 'inactive', 'suspended', 'banned'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ status, status_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/admin/users/:id/reset-password — trigger password reset */
export async function resetUserPassword(req, res, next) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email,user_id')
      .eq('id', req.params.id)
      .single();

    if (!profile) return res.status(404).json({ success: false, error: 'User not found.' });

    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Password reset link generated and sent.' });
  } catch (err) { next(err); }
}

/** DELETE /api/admin/users/:id — delete user */
export async function deleteUser(req, res, next) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (!profile) return res.status(404).json({ success: false, error: 'User not found.' });

    const { error } = await supabase.auth.admin.deleteUser(profile.user_id);
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) { next(err); }
}

/** GET /api/admin/suppliers/pending — list unverified supplier applications */
export async function listPendingSuppliers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select('*, profile:profiles(id,full_name,email,phone,created_at)')
      .eq('verified', false)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/suppliers/:id/verify — approve or reject supplier */
export async function verifySupplier(req, res, next) {
  try {
    const { approved, reason, supplier_level } = req.body;

    const updates = {
      verified: !!approved,
      verification_status: approved ? 'approved' : 'rejected',
      rejection_reason: approved ? null : (reason || null),
      supplier_level: approved ? (supplier_level || 'basic') : null,
      verified_at: approved ? new Date().toISOString() : null,
      verified_by: req.user?.profile?.id || null,
    };

    const { data, error } = await supabase
      .from('supplier_profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/carriers/pending — list pending carrier applications */
export async function listPendingCarriers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('carrier_profiles')
      .select('*, profile:profiles(id,full_name,email,phone,created_at)')
      .eq('verified', false)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/admin/carriers/:id/verify — approve or reject carrier */
export async function verifyCarrier(req, res, next) {
  try {
    const { approved, reason } = req.body;

    const updates = {
      verified: !!approved,
      verification_status: approved ? 'approved' : 'rejected',
      rejection_reason: approved ? null : (reason || null),
      verified_at: approved ? new Date().toISOString() : null,
      verified_by: req.user?.profile?.id || null,
    };

    const { data, error } = await supabase
      .from('carrier_profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
