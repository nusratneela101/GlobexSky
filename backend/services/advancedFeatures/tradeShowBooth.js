/**
 * Globex Sky — Virtual Trade Show Booth Service
 * Manages virtual booth creation, layout, products, visitors, live chat, and analytics.
 */

import supabase from '../../config/supabase.js';

/**
 * Create a virtual booth for a supplier at a trade show.
 * @param {string} tradeShowId
 * @param {string} supplierId
 * @param {{ name?: string, description?: string, theme?: string, layout?: object }} boothData
 */
export async function createVirtualBooth(tradeShowId, supplierId, boothData = {}) {
  const { data, error } = await supabase
    .from('virtual_booths')
    .insert([{
      trade_show_id: tradeShowId,
      supplier_id: supplierId,
      name: boothData.name || 'Virtual Booth',
      description: boothData.description || null,
      theme: boothData.theme || 'default',
      layout: boothData.layout || {},
      status: 'active',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Retrieve the layout configuration for a booth.
 * @param {string} boothId
 */
export async function getBoothLayout(boothId) {
  const { data, error } = await supabase
    .from('virtual_booths')
    .select('id, name, theme, layout, status')
    .eq('id', boothId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update the products displayed in a booth.
 * @param {string} boothId
 * @param {string[]} products - Array of product IDs to feature in the booth
 */
export async function updateBoothProducts(boothId, products) {
  const { data, error } = await supabase
    .from('virtual_booths')
    .update({ featured_products: products, updated_at: new Date().toISOString() })
    .eq('id', boothId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the list of visitors who have viewed a booth.
 * @param {string} boothId
 */
export async function getBoothVisitors(boothId) {
  const { data, error } = await supabase
    .from('booth_visitors')
    .select('id, visitor_id, visited_at, duration_seconds')
    .eq('booth_id', boothId)
    .order('visited_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Initiate a live chat session between a visitor and a booth.
 * @param {string} boothId
 * @param {string} visitorId
 */
export async function startLiveChat(boothId, visitorId) {
  const { data, error } = await supabase
    .from('booth_chat_sessions')
    .insert([{
      booth_id: boothId,
      visitor_id: visitorId,
      started_at: new Date().toISOString(),
      status: 'active',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get aggregated analytics for a booth.
 * @param {string} boothId
 */
export async function getBoothAnalytics(boothId) {
  const [visitorsRes, chatsRes] = await Promise.all([
    supabase
      .from('booth_visitors')
      .select('id, duration_seconds', { count: 'exact' })
      .eq('booth_id', boothId),
    supabase
      .from('booth_chat_sessions')
      .select('id', { count: 'exact' })
      .eq('booth_id', boothId),
  ]);

  const visitors = visitorsRes.data ?? [];
  const totalDuration = visitors.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);

  return {
    booth_id: boothId,
    total_visitors: visitorsRes.count ?? visitors.length,
    total_chat_sessions: chatsRes.count ?? 0,
    avg_visit_duration_seconds: visitors.length > 0 ? Math.round(totalDuration / visitors.length) : 0,
  };
}
