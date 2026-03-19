import {
  createMeetingRoom,
  joinMeetingRoom,
  endMeetingRoom,
  getMeetingDetails,
  scheduleMeeting,
  getUserMeetings,
} from '../services/videoMeeting.service.js';
import supabase from '../config/supabase.js';

export async function createMeeting(req, res, next) {
  try {
    const { title, max_participants } = req.body;
    const data = await createMeetingRoom({ hostId: req.user.id, title, maxParticipants: max_participants });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function joinMeeting(req, res, next) {
  try {
    // Support join by room code or meeting ID
    let meetingId = req.params.id;
    if (req.body.room_code) {
      const { data: meeting } = await supabase
        .from('video_meetings')
        .select('id')
        .eq('room_code', req.body.room_code.toUpperCase())
        .neq('status', 'ended')
        .single();
      if (!meeting) return res.status(404).json({ success: false, error: 'Meeting not found with that room code.' });
      meetingId = meeting.id;
    }
    const data = await joinMeetingRoom(meetingId, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function endMeeting(req, res, next) {
  try {
    const data = await endMeetingRoom(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMeetingDetailsHandler(req, res, next) {
  try {
    const data = await getMeetingDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function scheduleMeetingHandler(req, res, next) {
  try {
    const { title, description, scheduled_at, duration_minutes, invitees } = req.body;
    const data = await scheduleMeeting({
      hostId: req.user.id,
      title,
      description,
      scheduledAt: scheduled_at,
      durationMinutes: duration_minutes,
      invitees,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMyMeetings(req, res, next) {
  try {
    const data = await getUserMeetings(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
