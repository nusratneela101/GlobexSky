import supabase from '../config/supabase.js';

/**
 * Generate a unique 6-character alphanumeric room code.
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Create a new video meeting room.
 * @param {object} params
 */
export async function createMeetingRoom({ hostId, title, maxParticipants = 10 }) {
  let roomCode;
  let attempts = 0;

  // Ensure unique room code
  do {
    roomCode = generateRoomCode();
    const { data: existing } = await supabase
      .from('video_meetings')
      .select('id')
      .eq('room_code', roomCode)
      .eq('status', 'active')
      .single();
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  const { data, error } = await supabase
    .from('video_meetings')
    .insert([{
      host_id: hostId,
      title: title || 'Instant Meeting',
      room_code: roomCode,
      status: 'waiting',
      max_participants: maxParticipants,
      participant_count: 0,
      started_at: null,
      ended_at: null,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Join an existing meeting by room code.
 * @param {string} meetingId
 * @param {string} userId
 */
export async function joinMeetingRoom(meetingId, userId) {
  const { data: meeting, error: fetchErr } = await supabase
    .from('video_meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (fetchErr || !meeting) throw new Error('Meeting not found.');
  if (meeting.status === 'ended') throw new Error('This meeting has already ended.');
  if ((meeting.participant_count || 0) >= (meeting.max_participants || 10)) {
    throw new Error('Meeting is full.');
  }

  // Upsert participant record
  await supabase
    .from('meeting_participants')
    .upsert([{
      meeting_id: meetingId,
      user_id: userId,
      joined_at: new Date().toISOString(),
      left_at: null,
    }], { onConflict: 'meeting_id,user_id' });

  // Update participant count and set to active if first non-host joins
  const newCount = (meeting.participant_count || 0) + 1;
  const updates = { participant_count: newCount };
  if (meeting.status === 'waiting') updates.status = 'active';
  if (!meeting.started_at) updates.started_at = new Date().toISOString();

  await supabase
    .from('video_meetings')
    .update(updates)
    .eq('id', meetingId);

  return { meeting_id: meetingId, room_code: meeting.room_code, joined: true };
}

/**
 * End a meeting and calculate duration.
 * @param {string} meetingId
 * @param {string} hostId
 */
export async function endMeetingRoom(meetingId, hostId) {
  const { data: meeting, error: fetchErr } = await supabase
    .from('video_meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (fetchErr || !meeting) throw new Error('Meeting not found.');
  if (meeting.host_id !== hostId) throw new Error('Only the host can end the meeting.');
  if (meeting.status === 'ended') throw new Error('Meeting is already ended.');

  const endedAt = new Date().toISOString();
  const durationSeconds = meeting.started_at
    ? Math.floor((new Date(endedAt) - new Date(meeting.started_at)) / 1000)
    : 0;

  const { data, error } = await supabase
    .from('video_meetings')
    .update({ status: 'ended', ended_at: endedAt, duration_seconds: durationSeconds })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get detailed information about a meeting.
 * @param {string} meetingId
 */
export async function getMeetingDetails(meetingId) {
  const { data, error } = await supabase
    .from('video_meetings')
    .select('*, participants:meeting_participants(*, user:profiles(full_name, avatar_url))')
    .eq('id', meetingId)
    .single();

  if (error || !data) throw new Error('Meeting not found.');
  return data;
}

/**
 * Schedule a future meeting.
 * @param {object} params
 */
export async function scheduleMeeting({ hostId, title, description, scheduledAt, durationMinutes, invitees }) {
  let roomCode;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    const { data: existing } = await supabase
      .from('video_meetings')
      .select('id')
      .eq('room_code', roomCode)
      .eq('status', 'active')
      .single();
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  const { data, error } = await supabase
    .from('video_meetings')
    .insert([{
      host_id: hostId,
      title,
      description: description || null,
      room_code: roomCode,
      status: 'scheduled',
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes || 60,
      invitees: invitees || [],
      max_participants: 10,
      participant_count: 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all meetings for a user (as host or participant).
 * @param {string} userId
 */
export async function getUserMeetings(userId) {
  const { data: hostedMeetings } = await supabase
    .from('video_meetings')
    .select('*')
    .eq('host_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: participatedMeetings } = await supabase
    .from('meeting_participants')
    .select('meeting:video_meetings(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(20);

  const participated = (participatedMeetings || [])
    .map(r => r.meeting)
    .filter(m => m && m.host_id !== userId);

  return {
    hosted: hostedMeetings || [],
    participated,
  };
}
