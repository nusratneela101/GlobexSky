import supabase from '../config/supabase.js';

export async function listConversations(req, res, next) {
  try {
    const { data, error } = await supabase.from('conversations').select('*, latest_message:messages(content,created_at)').contains('participant_ids', [req.user.id]).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMessages(req, res, next) {
  try {
    const { data, error } = await supabase.from('messages').select('*, sender:profiles!sender_id(full_name,avatar_url)').eq('conversation_id', req.params.id).order('created_at', { ascending: true });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createConversation(req, res, next) {
  try {
    const { participant_id } = req.body;
    const participants = [req.user.id, participant_id];
    // Check if conversation already exists
    const { data: existing } = await supabase.from('conversations').select('id').contains('participant_ids', participants).single();
    if (existing) return res.json({ success: true, data: existing });
    const { data, error } = await supabase.from('conversations').insert({ participant_ids: participants, type: 'buyer_supplier' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function sendMessage(req, res, next) {
  try {
    const { content, type = 'text' } = req.body;
    const { data, error } = await supabase.from('messages').insert({ conversation_id: req.params.id, sender_id: req.user.id, content, type }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function markMessagesRead(req, res, next) {
  try {
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', req.params.id).neq('sender_id', req.user.id).is('read_at', null);
    res.json({ success: true, message: 'Messages marked as read.' });
  } catch (err) { next(err); }
}
