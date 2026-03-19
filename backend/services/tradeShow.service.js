import supabase from '../config/supabase.js';

// ─── Trade Shows ─────────────────────────────────────────────────────────────

/**
 * Create a trade show event.
 */
export async function createTradeShowRecord({ title, description, start_date, end_date, location_type, tags }) {
  const { data, error } = await supabase.from('trade_shows').insert([{
    title,
    description: description || null,
    start_date,
    end_date,
    location_type: location_type || 'virtual',
    tags: tags || [],
    status: 'upcoming',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * List trade shows with optional status filter.
 */
export async function listTradeShows({ status, page = 1, limit = 20 } = {}) {
  let q = supabase
    .from('trade_shows')
    .select('*', { count: 'exact' })
    .order('start_date', { ascending: true })
    .range((+page - 1) * +limit, +page * +limit - 1);

  if (status) q = q.eq('status', status);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data, total: count, page: +page, limit: +limit };
}

// ─── Booths ───────────────────────────────────────────────────────────────────

/**
 * Register a booth for a given trade show.
 */
export async function registerBoothRecord({ trade_show_id, company_id, booth_size, brand_description, product_categories, contact_email }) {
  // Check show exists
  const { data: show, error: showErr } = await supabase.from('trade_shows').select('id,status').eq('id', trade_show_id).single();
  if (showErr) throw showErr;
  if (!show) throw new Error('Trade show not found');
  if (show.status === 'closed') throw new Error('Trade show registrations are closed');

  const { data, error } = await supabase.from('trade_show_booths').insert([{
    trade_show_id,
    company_id,
    booth_size: booth_size || 'standard',
    brand_description: brand_description || null,
    product_categories: product_categories || [],
    contact_email: contact_email || null,
    status: 'pending',
  }]).select().single();

  if (error) throw error;
  return data;
}

/**
 * Get booth details by trade show ID and booth ID.
 */
export async function getBoothById(trade_show_id, booth_id) {
  const { data, error } = await supabase
    .from('trade_show_booths')
    .select('*')
    .eq('trade_show_id', trade_show_id)
    .eq('id', booth_id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Demos ────────────────────────────────────────────────────────────────────

/**
 * Schedule a product demo for a trade show.
 */
export async function scheduleDemoRecord({ trade_show_id, booth_id, presenter_id, title, description, scheduled_at, duration_minutes }) {
  const { data, error } = await supabase.from('trade_show_demos').insert([{
    trade_show_id,
    booth_id: booth_id || null,
    presenter_id,
    title,
    description: description || null,
    scheduled_at,
    duration_minutes: duration_minutes || 30,
    status: 'scheduled',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

/**
 * Create or update a meeting for a trade show.
 */
export async function manageMeetingRecord({ trade_show_id, organizer_id, attendee_id, scheduled_at, duration_minutes, notes, meeting_id }) {
  if (meeting_id) {
    // Update existing meeting
    const { data, error } = await supabase.from('trade_show_meetings')
      .update({ scheduled_at, duration_minutes, notes, updated_at: new Date().toISOString() })
      .eq('id', meeting_id)
      .eq('trade_show_id', trade_show_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('trade_show_meetings').insert([{
    trade_show_id,
    organizer_id,
    attendee_id: attendee_id || null,
    scheduled_at,
    duration_minutes: duration_minutes || 30,
    notes: notes || null,
    status: 'scheduled',
  }]).select().single();

  if (error) throw error;
  return data;
}

// ─── Visitor Tracking / Lead Capture ──────────────────────────────────────────

/**
 * Log a visitor interaction with a booth (lead capture).
 */
export async function captureLeadRecord({ trade_show_id, booth_id, visitor_id, interest_level, notes }) {
  const { data, error } = await supabase.from('trade_show_leads').insert([{
    trade_show_id,
    booth_id,
    visitor_id,
    interest_level: interest_level || 'medium',
    notes: notes || null,
  }]).select().single();

  if (error) throw error;
  return data;
}
