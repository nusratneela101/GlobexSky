/**
 * Globex Sky — WebRTC Signaling Service
 * Peer-to-peer video/audio calling and screen sharing via Socket.io signaling.
 * Actual media is handled client-side; this service manages signaling and meeting state.
 */

import supabase from '../config/supabase.js';
import websocketConfig from '../config/websocket.js';

// Active WebRTC sessions: roomCode → { peers: Map<userId, socketId>, hostId, startedAt }
const activeSessions = new Map();

/**
 * Initialize the WebRTC signaling namespace on Socket.io.
 * @param {import('socket.io').Server} io
 */
export function initializeWebRTC(io) {
  const rtcNs = io.of(websocketConfig.namespaces.videoMeeting);

  rtcNs.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required.'));

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error('Invalid or expired token.'));

    socket.userId = user.id;
    next();
  });

  rtcNs.on('connection', (socket) => {
    const { userId } = socket;

    // ── Join a meeting room ─────────────────────────────────────────────────
    socket.on('meeting:join', async ({ roomCode }) => {
      try {
        if (!roomCode) {
          socket.emit('error', { message: 'roomCode is required.' });
          return;
        }

        // Validate meeting exists in DB
        const { data: meeting, error: fetchErr } = await supabase
          .from('video_meetings')
          .select('id, host_id, status, max_participants, participant_count, room_code')
          .eq('room_code', roomCode)
          .single();

        if (fetchErr || !meeting) {
          socket.emit('error', { message: 'Meeting room not found.' });
          return;
        }
        if (meeting.status === 'ended') {
          socket.emit('error', { message: 'This meeting has already ended.' });
          return;
        }
        if ((meeting.participant_count || 0) >= (meeting.max_participants || 10)) {
          socket.emit('error', { message: 'Meeting room is full.' });
          return;
        }

        socket.join(`meeting:${roomCode}`);

        // Track session peers in memory
        if (!activeSessions.has(roomCode)) {
          activeSessions.set(roomCode, { peers: new Map(), hostId: meeting.host_id, startedAt: Date.now() });
        }
        activeSessions.get(roomCode).peers.set(userId, socket.id);

        // Notify existing peers that a new user joined
        socket.to(`meeting:${roomCode}`).emit('peer:joined', { userId, socketId: socket.id });

        // Send the new peer a list of existing peers so they can initiate offers
        const existingPeers = Array.from(activeSessions.get(roomCode).peers.entries())
          .filter(([id]) => id !== userId)
          .map(([id, sid]) => ({ userId: id, socketId: sid }));

        socket.emit('meeting:joined', { roomCode, meetingId: meeting.id, existingPeers });
      } catch {
        socket.emit('error', { message: 'Failed to join meeting.' });
      }
    });

    // ── WebRTC Offer (caller → callee) ──────────────────────────────────────
    socket.on('webrtc:offer', ({ targetSocketId, offer, roomCode }) => {
      rtcNs.to(targetSocketId).emit('webrtc:offer', {
        offer,
        fromSocketId: socket.id,
        fromUserId: userId,
        roomCode,
      });
    });

    // ── WebRTC Answer (callee → caller) ─────────────────────────────────────
    socket.on('webrtc:answer', ({ targetSocketId, answer, roomCode }) => {
      rtcNs.to(targetSocketId).emit('webrtc:answer', {
        answer,
        fromSocketId: socket.id,
        fromUserId: userId,
        roomCode,
      });
    });

    // ── ICE Candidate exchange ──────────────────────────────────────────────
    socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
      rtcNs.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate,
        fromSocketId: socket.id,
        fromUserId: userId,
      });
    });

    // ── Screen sharing state ────────────────────────────────────────────────
    socket.on('screen:start', ({ roomCode }) => {
      socket.to(`meeting:${roomCode}`).emit('screen:start', { userId, socketId: socket.id });
    });

    socket.on('screen:stop', ({ roomCode }) => {
      socket.to(`meeting:${roomCode}`).emit('screen:stop', { userId, socketId: socket.id });
    });

    // ── Media state (mute/camera) ───────────────────────────────────────────
    socket.on('media:toggle', ({ roomCode, audio, video }) => {
      socket.to(`meeting:${roomCode}`).emit('media:toggle', { userId, audio, video });
    });

    // ── Leave meeting ───────────────────────────────────────────────────────
    socket.on('meeting:leave', ({ roomCode }) => {
      handlePeerLeave(socket, userId, roomCode, rtcNs);
    });

    // ── End meeting (host only) ─────────────────────────────────────────────
    socket.on('meeting:end', async ({ roomCode }) => {
      const session = activeSessions.get(roomCode);
      if (!session) return;
      if (session.hostId !== userId) {
        socket.emit('error', { message: 'Only the host can end the meeting.' });
        return;
      }

      rtcNs.to(`meeting:${roomCode}`).emit('meeting:ended', { roomCode, endedBy: userId });
      activeSessions.delete(roomCode);
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Find and clean up all meetings this socket was part of
      for (const [roomCode, session] of activeSessions.entries()) {
        if (session.peers.has(userId) && session.peers.get(userId) === socket.id) {
          handlePeerLeave(socket, userId, roomCode, rtcNs);
          break;
        }
      }
    });
  });

  return rtcNs;
}

/**
 * Handle a peer leaving a meeting room.
 * @param {import('socket.io').Socket} socket
 * @param {string} userId
 * @param {string} roomCode
 * @param {import('socket.io').Namespace} ns
 */
function handlePeerLeave(socket, userId, roomCode, ns) {
  socket.leave(`meeting:${roomCode}`);
  const session = activeSessions.get(roomCode);
  if (session) {
    session.peers.delete(userId);
    if (session.peers.size === 0) {
      activeSessions.delete(roomCode);
    }
  }
  ns.to(`meeting:${roomCode}`).emit('peer:left', { userId, socketId: socket.id });
}

/**
 * Get the active session details for a room code.
 * @param {string} roomCode
 * @returns {{ peers: Map<string, string>, hostId: string, startedAt: number } | undefined}
 */
export function getActiveSession(roomCode) {
  return activeSessions.get(roomCode);
}

/**
 * Get all active meeting room codes.
 * @returns {string[]}
 */
export function getActiveMeetingRooms() {
  return Array.from(activeSessions.keys());
}
