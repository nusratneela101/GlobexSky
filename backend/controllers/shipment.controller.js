import supabase from '../config/supabase.js';
import { calculateShippingRate } from '../services/shipping.service.js';

export async function getShippingRates(req, res, next) {
  try {
    const { data, error } = await supabase.from('shipping_rates').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function calculateShippingCost(req, res, next) {
  try {
    const { destination_country, weight_kg, express, fragile, insurance, declared_value } = req.body;
    const result = await calculateShippingRate({ destination_country, weight_kg, express, fragile, insurance, declared_value });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
