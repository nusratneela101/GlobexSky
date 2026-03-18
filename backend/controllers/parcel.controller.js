import supabase from '../config/supabase.js';
import { generateTrackingNumber } from '../utils/helpers.js';
import { calculateShippingRate } from '../services/shipping.service.js';

export async function listParcels(req, res, next) {
  try {
    const { data, error } = await supabase.from('parcels').select('*').eq('sender_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createParcel(req, res, next) {
  try {
    const { receiver_name, receiver_phone, receiver_address, destination_country, weight_kg, dimensions, declared_value, product_type, shipping_method } = req.body;
    const cost = await calculateShippingRate({ destination_country, weight_kg });
    const tracking_number = generateTrackingNumber('PKG');
    const reference_number = generateTrackingNumber('REF');

    const { data, error } = await supabase.from('parcels').insert({
      sender_id: req.user.id,
      receiver_name,
      receiver_phone,
      receiver_address,
      destination_country,
      weight_kg,
      dimensions,
      declared_value,
      product_type,
      shipping_method,
      status: 'created',
      tracking_number,
      reference_number,
      total_cost: cost.total,
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function trackParcel(req, res, next) {
  try {
    const { data: parcel, error } = await supabase.from('parcels').select('*').eq('tracking_number', req.params.tracking_number).single();
    if (error || !parcel) return res.status(404).json({ success: false, error: 'Parcel not found.' });
    const { data: events } = await supabase.from('parcel_tracking_events').select('*').eq('parcel_id', parcel.id).order('timestamp', { ascending: false });
    res.json({ success: true, data: { parcel, events: events || [] } });
  } catch (err) { next(err); }
}

export async function getParcel(req, res, next) {
  try {
    const { data, error } = await supabase.from('parcels').select('*, events:parcel_tracking_events(*)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Parcel not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function calculateParcelCost(req, res, next) {
  try {
    const { destination_country, weight_kg, express, fragile, insurance, declared_value } = req.body;
    const result = await calculateShippingRate({ destination_country, weight_kg, express, fragile, insurance, declared_value });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
