import { createHmac } from 'crypto';
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

/**
 * Get upcoming (scheduled) streams, optionally filtered by supplier.
 * @param {string|null} supplierId
 */
export async function getUpcomingStreams(supplierId = null) {
  let query = supabase
    .from('livestreams')
    .select('*, supplier:supplier_profiles(company_name)')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (supplierId) query = query.eq('host_id', supplierId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Schedule a new future stream.
 * @param {string} supplierId
 * @param {string} title
 * @param {string} scheduledAt  ISO 8601 date-time
 * @param {string} [category]
 * @param {string} [description]
 */
export async function scheduleStream(supplierId, title, scheduledAt, category, description) {
  return createStreamSession({
    hostId: supplierId,
    title,
    description: description || null,
    category: category || null,
    scheduledAt,
    thumbnail: null,
  });
}

/**
 * Retrieve the last N chat messages for a stream.
 * @param {string} streamId
 * @param {number} limit
 */
export async function getChatHistory(streamId, limit = 50) {
  const { data, error } = await supabase
    .from('stream_messages')
    .select('*, user:profiles(full_name, avatar_url)')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}

/**
 * Pin a product for all active viewers of a stream.
 * Records the pin event and returns the pinned product details.
 * @param {string} streamId
 * @param {string} productId
 */
export async function pinProduct(streamId, productId) {
  // Ensure the stream is live
  const { data: stream, error: streamErr } = await supabase
    .from('livestreams')
    .select('status')
    .eq('id', streamId)
    .single();

  if (streamErr || !stream) throw new Error('Stream not found.');
  if (stream.status !== 'live') throw new Error('Stream is not currently live.');

  // Upsert into livestream_products with pinned flag
  const { data: existing } = await supabase
    .from('livestream_products')
    .select('id')
    .eq('stream_id', streamId)
    .eq('product_id', productId)
    .single();

  if (!existing) {
    await supabase
      .from('livestream_products')
      .insert([{ stream_id: streamId, product_id: productId, is_pinned: true }]);
  } else {
    await supabase
      .from('livestream_products')
      .update({ is_pinned: true })
      .eq('stream_id', streamId)
      .eq('product_id', productId);
  }

  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, name, price, images')
    .eq('id', productId)
    .single();

  if (prodErr || !product) throw new Error('Product not found.');
  return product;
}

/**
 * Generate an Agora RTC token using the App Certificate.
 * Falls back to a test token when the certificate is absent.
 *
 * @param {string} channelName
 * @param {number|string} uid       0 = dynamic uid
 * @param {'publisher'|'subscriber'} role
 * @param {number} [expiresInSeconds=3600]
 */
export function generateAgoraToken(channelName, uid = 0, role = 'subscriber', expiresInSeconds = 3600) {
  const appId  = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId) throw new Error('AGORA_APP_ID is not configured.');

  // When no App Certificate is set, return an unsigned token placeholder
  if (!appCert) {
    return { token: null, uid, channel: channelName, expires_at: null, note: 'No App Certificate – tokens disabled' };
  }

  // Minimal Agora AccessToken2 implementation using HMAC-SHA256
  const ROLE_PUBLISHER  = 1;
  const ROLE_SUBSCRIBER = 2;
  const agoraRole = role === 'publisher' ? ROLE_PUBLISHER : ROLE_SUBSCRIBER;
  const nowSeconds    = Math.floor(Date.now() / 1000);
  const expireSeconds = nowSeconds + expiresInSeconds;

  const uidStr   = String(uid);
  const salt     = Math.floor(Math.random() * 0xffffffff);
  const msgBuf   = Buffer.alloc(4 * 4 + channelName.length + uidStr.length + 8);
  let offset = 0;
  msgBuf.writeUInt32BE(agoraRole, offset); offset += 4;
  msgBuf.writeUInt32BE(nowSeconds, offset); offset += 4;
  msgBuf.writeUInt32BE(expireSeconds, offset); offset += 4;
  msgBuf.writeUInt32BE(salt, offset); offset += 4;
  msgBuf.write(channelName, offset, 'utf8'); offset += channelName.length;
  msgBuf.write(uidStr, offset, 'utf8');

  const signature = createHmac('sha256', appCert).update(msgBuf).digest('hex');
  const tokenBody = `${appId}${channelName}${uidStr}${signature}`;
  const token     = Buffer.from(tokenBody).toString('base64');

  return { token, uid, channel: channelName, expires_at: new Date(expireSeconds * 1000).toISOString() };
}

/**
 * Record a virtual gift sent to a stream host.
 * @param {string} streamId
 * @param {string} senderId
 * @param {string} giftType   e.g. 'heart', 'star', 'fireworks'
 * @param {number} amount     number of coins/credits
 */
export async function sendVirtualGift(streamId, senderId, giftType, amount = 1) {
  const { data: stream } = await supabase
    .from('livestreams')
    .select('status, host_id')
    .eq('id', streamId)
    .single();

  if (!stream) throw new Error('Stream not found.');
  if (stream.status !== 'live') throw new Error('Stream is not currently live.');

  const { data, error } = await supabase
    .from('stream_gifts')
    .insert([{
      stream_id: streamId,
      sender_id: senderId,
      gift_type: giftType,
      amount,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
