import supabase from '../config/supabase.js';
import { deleteCloudinaryFile } from '../services/cloudinary.service.js';

/** GET /api/v1/users/profile */
export async function getProfile(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Profile not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/profile */
export async function updateProfile(req, res, next) {
  try {
    const allowed = ['full_name', 'phone', 'company_name', 'language', 'currency', 'timezone'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/users/profile/avatar */
export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    const avatarUrl = req.file.path;
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { avatar_url: avatarUrl } });
  } catch (err) { next(err); }
}

/** GET /api/v1/users/addresses */
export async function getAddresses(req, res, next) {
  try {
    const { data, error } = await supabase.from('addresses').select('*').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/users/addresses */
export async function addAddress(req, res, next) {
  try {
    const { label, street, city, state, country, postal_code, is_default } = req.body;
    if (is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }
    const { data, error } = await supabase
      .from('addresses')
      .insert({ user_id: req.user.id, label, street, city, state, country, postal_code, is_default: !!is_default })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/addresses/:id */
export async function updateAddress(req, res, next) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('addresses')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/users/addresses/:id */
export async function deleteAddress(req, res, next) {
  try {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) { next(err); }
}

/** GET /api/v1/users/settings */
export async function getSettings(req, res, next) {
  try {
    const { data } = await supabase.from('profiles').select('language,currency,timezone').eq('user_id', req.user.id).single();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/settings */
export async function updateSettings(req, res, next) {
  try {
    const { language, currency, timezone } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .update({ language, currency, timezone, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/change-password */
export async function changePassword(req, res, next) {
  try {
    const { new_password } = req.body;
    const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}
