import supabase from '../config/supabase.js';

export async function getProductReviews(req, res, next) {
  try {
    const { data, error } = await supabase.from('reviews').select('*, reviewer:profiles!user_id(full_name,avatar_url)').eq('product_id', req.params.productId).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createReview(req, res, next) {
  try {
    const { product_id, rating, comment, images } = req.body;
    const { data: existing } = await supabase.from('reviews').select('id').eq('user_id', req.user.id).eq('product_id', product_id).single();
    if (existing) return res.status(400).json({ success: false, error: 'You have already reviewed this product.' });
    const { data, error } = await supabase.from('reviews').insert({ user_id: req.user.id, product_id, rating, comment, images }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateReview(req, res, next) {
  try {
    const { rating, comment, images } = req.body;
    const { data, error } = await supabase.from('reviews').update({ rating, comment, images }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteReview(req, res, next) {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) { next(err); }
}

export async function markHelpful(req, res, next) {
  try {
    const { data: review } = await supabase.from('reviews').select('helpful_count').eq('id', req.params.id).single();
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });
    const { data, error } = await supabase.from('reviews').update({ helpful_count: (review.helpful_count || 0) + 1 }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
