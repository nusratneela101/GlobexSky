/**
 * Livestream Admin Controller
 * Handles admin-side moderation and management of live streams.
 */

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

/* ─── Active Streams ─────────────────────────────────────────────────────── */

export async function getActiveStreams(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('livestreams')
      .select('*, supplier:supplier_profiles(company_name, id), products:livestream_products(product_id)')
      .eq('status', 'live')
      .order('started_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/* ─── Scheduled Streams ──────────────────────────────────────────────────── */

export async function getScheduledStreams(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    const allowedStatuses = ['scheduled', 'pending'];
    const targetStatus = allowedStatuses.includes(status) ? status : null;

    let query = supabase
      .from('livestreams')
      .select('*, supplier:supplier_profiles(company_name, id)', { count: 'exact' })
      .in('status', targetStatus ? [targetStatus] : allowedStatuses)
      .order('scheduled_at', { ascending: true })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/* ─── Past Streams ───────────────────────────────────────────────────────── */

export async function getPastStreams(req, res, next) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('livestreams')
      .select('*, supplier:supplier_profiles(company_name, id)', { count: 'exact' })
      .in('status', ['ended', 'cancelled'])
      .order('ended_at', { ascending: false })
      .range(from, to);

    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/* ─── Approve Stream ─────────────────────────────────────────────────────── */

export async function approveStream(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('livestreams')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .in('status', ['pending'])
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Stream not found or not in pending state.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Reject Stream ──────────────────────────────────────────────────────── */

export async function rejectStream(req, res, next) {
  try {
    const { reason } = req.body;
    const { data, error } = await supabase
      .from('livestreams')
      .update({ status: 'cancelled', rejection_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .in('status', ['pending', 'scheduled'])
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Stream not found or cannot be rejected.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Force End Stream ───────────────────────────────────────────────────── */

export async function endStream(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('livestreams')
      .update({ status: 'ended', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('status', 'live')
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Live stream not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Ban Chat User ──────────────────────────────────────────────────────── */

export async function banChatUser(req, res, next) {
  try {
    const { user_id, reason } = req.body;
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required.' });

    const { data, error } = await supabase
      .from('livestream_chat_bans')
      .upsert({
        stream_id: req.params.id,
        user_id,
        banned_by: req.user.id,
        reason: reason || null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'stream_id,user_id' })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Send Admin Warning ─────────────────────────────────────────────────── */

export async function sendWarning(req, res, next) {
  try {
    const { user_id, message } = req.body;
    if (!user_id || !message) {
      return res.status(400).json({ success: false, error: 'user_id and message are required.' });
    }

    const { data, error } = await supabase
      .from('livestream_chat_messages')
      .insert({
        stream_id: req.params.id,
        user_id: req.user.id,
        message: `⚠️ [Admin Warning to @${user_id}]: ${message}`,
        is_admin_message: true,
        is_warning: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Feature Stream ─────────────────────────────────────────────────────── */

export async function featureStream(req, res, next) {
  try {
    const { featured } = req.body;
    const { data, error } = await supabase
      .from('livestreams')
      .update({ is_featured: featured !== false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Stream not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Delete Recording ───────────────────────────────────────────────────── */

export async function deleteRecording(req, res, next) {
  try {
    const { data: stream, error: fetchErr } = await supabase
      .from('livestreams')
      .select('id, status, recording_url')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !stream) return res.status(404).json({ success: false, error: 'Stream not found.' });

    const { error } = await supabase
      .from('livestreams')
      .update({ recording_url: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Recording deleted.' });
  } catch (err) { next(err); }
}

/* ─── Livestream Settings ────────────────────────────────────────────────── */

export async function getLivestreamSettings(req, res, next) {
  try {
    const keys = [
      'livestream_enabled',
      'livestream_hourly_rate',
      'livestream_featured_surcharge',
      'livestream_max_duration_minutes',
      'livestream_auto_record',
      'livestream_save_replay',
      'livestream_chat_enabled',
      'livestream_chat_moderation_level',
      'livestream_allowed_categories',
    ];

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value, type')
      .in('key', keys);

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Convert array to map for convenience
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}

export async function updateLivestreamSettings(req, res, next) {
  try {
    const allowed = [
      'livestream_enabled',
      'livestream_hourly_rate',
      'livestream_featured_surcharge',
      'livestream_max_duration_minutes',
      'livestream_auto_record',
      'livestream_save_replay',
      'livestream_chat_enabled',
      'livestream_chat_moderation_level',
      'livestream_allowed_categories',
    ];

    const upserts = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        upserts.push({
          key,
          value: String(req.body[key]),
          category: 'livestream',
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (upserts.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid settings provided.' });
    }

    const { data, error } = await supabase
      .from('site_settings')
      .upsert(upserts, { onConflict: 'key' })
      .select();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ─── Analytics ──────────────────────────────────────────────────────────── */

export async function getLivestreamAnalytics(req, res, next) {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let since;
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'week') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    const [streamsRes, topStreamersRes] = await Promise.all([
      supabase
        .from('livestreams')
        .select('id, status, viewer_count, peak_viewer_count, duration_seconds, started_at, ended_at, supplier:supplier_profiles(company_name)')
        .gte('created_at', since),
      supabase
        .from('livestreams')
        .select('supplier_id, viewer_count, peak_viewer_count, supplier:supplier_profiles(company_name)')
        .gte('created_at', since)
        .not('supplier_id', 'is', null),
    ]);

    const streams = streamsRes.data || [];

    const totalStreams = streams.length;
    const liveStreams = streams.filter(s => s.status === 'live').length;
    const totalViewers = streams.reduce((sum, s) => sum + (s.viewer_count || 0), 0);
    const peakViewers = streams.reduce((max, s) => Math.max(max, s.peak_viewer_count || 0), 0);

    const finishedStreams = streams.filter(s => s.duration_seconds && s.duration_seconds > 0);
    const avgDurationSeconds = finishedStreams.length > 0
      ? Math.round(finishedStreams.reduce((sum, s) => sum + s.duration_seconds, 0) / finishedStreams.length)
      : 0;

    // Aggregate top streamers
    const supplierMap = {};
    (topStreamersRes.data || []).forEach(s => {
      const id = s.supplier_id;
      if (!id) return;
      if (!supplierMap[id]) {
        supplierMap[id] = {
          supplier_id: id,
          company_name: s.supplier?.company_name || 'Unknown',
          total_viewers: 0,
          stream_count: 0,
        };
      }
      supplierMap[id].total_viewers += s.viewer_count || 0;
      supplierMap[id].stream_count += 1;
    });

    const topStreamers = Object.values(supplierMap)
      .sort((a, b) => b.total_viewers - a.total_viewers)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        period,
        total_streams: totalStreams,
        live_streams: liveStreams,
        total_viewers: totalViewers,
        peak_viewers: peakViewers,
        avg_duration_seconds: avgDurationSeconds,
        top_streamers: topStreamers,
      },
    });
  } catch (err) { next(err); }
}
