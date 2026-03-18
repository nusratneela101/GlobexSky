import supabase from '../config/supabase.js';

export async function listNotifications(req, res, next) {
  try {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getUnreadCount(req, res, next) {
  try {
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('read', false);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
}

export async function markRead(req, res, next) {
  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) { next(err); }
}

export async function markAllRead(req, res, next) {
  try {
    await supabase.from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
}

export async function deleteNotification(req, res, next) {
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) { next(err); }
}
