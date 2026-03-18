import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function listCarryRequests(req, res, next) {
  try {
    const { page = 1, limit = 20, origin, destination } = req.query;
    const { from, to } = buildPagination(page, limit);
    let query = supabase.from('carry_requests').select('*, carrier:carrier_profiles(*)', { count: 'exact' }).eq('status', 'active').range(from, to);
    if (origin) query = query.ilike('origin', `%${origin}%`);
    if (destination) query = query.ilike('destination', `%${destination}%`);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getCarryRequest(req, res, next) {
  try {
    const { data, error } = await supabase.from('carry_requests').select('*, carrier:carrier_profiles(*), items:carry_items(*)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Carry request not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCarryRates(req, res, next) {
  try {
    const { data, error } = await supabase.from('carry_rates').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCarryRequest(req, res, next) {
  try {
    const { flight_number, departure_date, arrival_date, origin, destination, weight_capacity } = req.body;
    const { data: carrierProfile } = await supabase.from('carrier_profiles').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase.from('carry_requests')
      .insert({ carrier_id: carrierProfile?.id, flight_number, departure_date, arrival_date, origin, destination, weight_capacity, status: 'active' })
      .select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateCarryRequest(req, res, next) {
  try {
    const { data, error } = await supabase.from('carry_requests').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteCarryRequest(req, res, next) {
  try {
    const { error } = await supabase.from('carry_requests').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Carry request deleted.' });
  } catch (err) { next(err); }
}

export async function getCarrierEarnings(req, res, next) {
  try {
    const { data: carrierProfile } = await supabase.from('carrier_profiles').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase.from('carrier_earnings').select('*').eq('carrier_id', carrierProfile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCarrierDeliveries(req, res, next) {
  try {
    const { data: carrierProfile } = await supabase.from('carrier_profiles').select('id').eq('user_id', req.user.id).single();
    const { data, error } = await supabase.from('carry_requests').select('*, items:carry_items(*)').eq('carrier_id', carrierProfile?.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function bookCarrySlot(req, res, next) {
  try {
    const { weight_kg, product_category } = req.body;
    const { data: request } = await supabase.from('carry_requests').select('*').eq('id', req.params.id).single();
    if (!request) return res.status(404).json({ success: false, error: 'Carry request not found.' });
    const { data: rate } = await supabase.from('carry_rates').select('payment_per_kg').eq('product_category', product_category).single();
    const paymentPerKg = rate?.payment_per_kg || 5;
    const totalPayment = weight_kg * paymentPerKg;
    const { data, error } = await supabase.from('carry_items')
      .insert({ carry_request_id: req.params.id, product_category, weight_kg, payment_per_kg: paymentPerKg, total_payment: totalPayment, status: 'pending' })
      .select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
