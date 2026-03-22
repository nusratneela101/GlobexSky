/**
 * Globex Sky — payoutController.js
 * Admin payout management controller.
 */

import supabase from '../config/supabase.js';

/* ─── Pending Payouts ─────────────────────────────────────────────────── */

/** GET /api/admin/payouts/pending */
export async function getPendingPayouts(req, res, next) {
  try {
    const { type } = req.query; // 'supplier' | 'carrier'

    let query = supabase
      .from('payouts')
      .select('*, profiles(full_name, email, role)', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    const totalAmount = (data || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    res.json({ success: true, data, meta: { total: count, total_amount: totalAmount } });
  } catch (err) { next(err); }
}

/* ─── Process Payout ──────────────────────────────────────────────────── */

/** POST /api/admin/payouts/process/:id */
export async function processPayout(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data: payout, error: fetchErr } = await supabase
      .from('payouts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !payout) return res.status(404).json({ success: false, error: 'Payout not found.' });
    if (payout.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Payout is already ${payout.status}.` });
    }

    const { data, error } = await supabase
      .from('payouts')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        processed_by: req.user.id,
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Record in transactions
    await supabase.from('transactions').insert({
      type: 'payout',
      user_id: payout.user_id,
      amount: payout.amount,
      fee: 0,
      net_amount: payout.amount,
      status: 'completed',
      description: `Payout processed — ${payout.method}`,
    });

    res.json({ success: true, data, message: 'Payout processed successfully.' });
  } catch (err) { next(err); }
}

/* ─── Payout History ──────────────────────────────────────────────────── */

/** GET /api/admin/payouts/history */
export async function getPayoutHistory(req, res, next) {
  try {
    const { page = 1, limit = 20, status, user_id, start_date, end_date } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    let query = supabase
      .from('payouts')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (user_id) query = query.eq('user_id', user_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/* ─── Payout Schedule ─────────────────────────────────────────────────── */

/** PUT /api/admin/payouts/schedule */
export async function updatePayoutSchedule(req, res, next) {
  try {
    const { frequency, day_of_week, day_of_month, min_amount, auto_process } = req.body;

    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('key', 'payout_schedule')
      .single();

    const settingValue = { frequency, day_of_week, day_of_month, min_amount, auto_process, updated_at: new Date().toISOString() };

    let result;
    if (existing) {
      result = await supabase
        .from('admin_settings')
        .update({ value: settingValue })
        .eq('key', 'payout_schedule')
        .select()
        .single();
    } else {
      result = await supabase
        .from('admin_settings')
        .insert({ key: 'payout_schedule', value: settingValue })
        .select()
        .single();
    }

    if (result.error) return res.status(400).json({ success: false, error: result.error.message });
    res.json({ success: true, data: result.data, message: 'Payout schedule updated.' });
  } catch (err) { next(err); }
}

/* ─── Create Payout ───────────────────────────────────────────────────── */

/** POST /api/admin/payouts */
export async function createPayout(req, res, next) {
  try {
    const { user_id, amount, method, type = 'supplier', notes } = req.body;

    const { data, error } = await supabase.from('payouts').insert({
      user_id,
      amount,
      method,
      type,
      status: 'pending',
      notes: notes || null,
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
