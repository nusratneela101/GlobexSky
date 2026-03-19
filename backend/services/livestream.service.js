import supabase from '../config/supabase.js';

/**
 * Generate a unique stream key for a broadcaster.
 */
export function generateStreamKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

/**
 * Create a new live stream session.
 * @param {object} params
 */
export async function createStreamSession({ hostId, title, description, category, scheduledAt, thumbnail }) {
  const streamKey = generateStreamKey();
  const { data, error } = await supabase
    .from('livestreams')
    .insert([{
      host_id: hostId,
      title,
      description: description || null,
      category: category || null,
      thumbnail: thumbnail || null,
      scheduled_at: scheduledAt || null,
      stream_key: streamKey,
      status: 'scheduled',
      viewer_count: 0,
      peak_viewers: 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Start broadcasting a stream.
 * @param {string} streamId
 * @param {string} userId
 */
export async function startStreamSession(streamId, userId) {
  const { data: stream, error: fetchErr } = await supabase
    .from('livestreams')
    .select('*')
    .eq('id', streamId)
    .single();

  if (fetchErr || !stream) throw new Error('Stream not found.');
  if (stream.status === 'live') throw new Error('Stream is already live.');
  if (stream.status === 'ended') throw new Error('Stream has already ended.');

  const { data, error } = await supabase
    .from('livestreams')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', streamId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * End an active stream and compute recording metadata.
 * @param {string} streamId
 */
export async function endStreamSession(streamId) {
  const { data: stream, error: fetchErr } = await supabase
    .from('livestreams')
    .select('*')
    .eq('id', streamId)
    .single();

  if (fetchErr || !stream) throw new Error('Stream not found.');
  if (stream.status === 'ended') throw new Error('Stream already ended.');

  const endedAt = new Date().toISOString();
  const durationSeconds = stream.started_at
    ? Math.floor((new Date(endedAt) - new Date(stream.started_at)) / 1000)
    : 0;

  const { data, error } = await supabase
    .from('livestreams')
    .update({
      status: 'ended',
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .eq('id', streamId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all currently active live streams.
 */
export async function getActiveLivestreams() {
  const { data, error } = await supabase
    .from('livestreams')
    .select('*, supplier:supplier_profiles(company_name)')
    .eq('status', 'live')
    .order('viewer_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get detailed information for a specific stream.
 * @param {string} streamId
 */
export async function getStreamById(streamId) {
  const { data, error } = await supabase
    .from('livestreams')
    .select('*, supplier:supplier_profiles(company_name), products:livestream_products(*, product:products(id,name,price,images))')
    .eq('id', streamId)
    .single();

  if (error || !data) throw new Error('Stream not found.');

  // Fetch chat message count
  const { count: messageCount } = await supabase
    .from('stream_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stream_id', streamId);

  return { ...data, message_count: messageCount || 0 };
}

/**
 * Increment viewer count for a stream.
 * @param {string} streamId
 */
export async function incrementViewerCount(streamId) {
  const { data: stream } = await supabase
    .from('livestreams')
    .select('viewer_count, peak_viewers')
    .eq('id', streamId)
    .single();

  if (!stream) return;

  const newCount = (stream.viewer_count || 0) + 1;
  const newPeak = Math.max(newCount, stream.peak_viewers || 0);

  await supabase
    .from('livestreams')
    .update({ viewer_count: newCount, peak_viewers: newPeak })
    .eq('id', streamId);
}

/**
 * Tag a product to a stream for live selling.
 * @param {string} streamId
 * @param {string} productId
 * @param {number|null} featuredPrice
 */
export async function addProductToStream(streamId, productId, featuredPrice = null) {
  // Check product is not already tagged
  const { data: existing } = await supabase
    .from('livestream_products')
    .select('id')
    .eq('stream_id', streamId)
    .eq('product_id', productId)
    .single();

  if (existing) throw new Error('Product already tagged to this stream.');

  const { data, error } = await supabase
    .from('livestream_products')
    .insert([{ stream_id: streamId, product_id: productId, featured_price: featuredPrice }])
    .select('*, product:products(id,name,price,images)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send a chat message to a stream (with basic rate limiting check).
 * @param {string} streamId
 * @param {string} userId
 * @param {string} message
 */
export async function sendChatMessage(streamId, userId, message) {
  // Rate limit: max 5 messages per 10 seconds per user
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const { count } = await supabase
    .from('stream_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stream_id', streamId)
    .eq('user_id', userId)
    .gte('created_at', tenSecondsAgo);

  if ((count || 0) >= 5) throw new Error('Rate limit exceeded. Please slow down.');

  const { data, error } = await supabase
    .from('stream_messages')
    .insert([{ stream_id: streamId, user_id: userId, message }])
    .select('*, user:profiles(full_name, avatar_url)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get analytics for a specific stream.
 * @param {string} streamId
 */
export async function getStreamAnalytics(streamId) {
  const { data: stream, error } = await supabase
    .from('livestreams')
    .select('*')
    .eq('id', streamId)
    .single();

  if (error || !stream) throw new Error('Stream not found.');

  const { count: messageCount } = await supabase
    .from('stream_messages')
    .select('id', { count: 'exact', head: true })
    .eq('stream_id', streamId);

  const { count: productCount } = await supabase
    .from('livestream_products')
    .select('id', { count: 'exact', head: true })
    .eq('stream_id', streamId);

  return {
    stream_id: streamId,
    title: stream.title,
    status: stream.status,
    peak_viewers: stream.peak_viewers || 0,
    current_viewers: stream.viewer_count || 0,
    duration_seconds: stream.duration_seconds || 0,
    message_count: messageCount || 0,
    product_count: productCount || 0,
    started_at: stream.started_at,
    ended_at: stream.ended_at,
  };
}
