/**
 * Globex Sky — Live Chat Support Service
 * Real-time WebSocket-based human support with AI-to-agent handoff,
 * queue management, chat transcripts, and typing indicators.
 */

import supabase from '../../config/supabase.js';

// ─── In-Memory State ──────────────────────────────────────────────────────────

/** Map<sessionId, { customerId, agentId, status, messages[], waitSince }> */
const chatSessions = new Map();

/** Map<agentId, { socketId, status: 'available'|'busy'|'away', activeChatCount }> */
const agentStatus = new Map();

/** Queue of sessions waiting for a human agent: [sessionId, ...] */
const waitingQueue = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId() {
  return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getAvailableAgent() {
  for (const [agentId, info] of agentStatus.entries()) {
    if (info.status === 'available' && info.activeChatCount < 3) {
      return agentId;
    }
  }
  return null;
}

/**
 * Save chat transcript to Supabase (best-effort; does not throw).
 * @param {string} sessionId
 * @param {object} session
 */
async function saveTranscript(sessionId, session) {
  try {
    await supabase.from('support_chat_transcripts').upsert({
      session_id: sessionId,
      customer_id: session.customerId || null,
      agent_id: session.agentId || null,
      status: session.status,
      messages: JSON.stringify(session.messages),
      topic: session.topic || null,
      started_at: session.startedAt,
      ended_at: session.endedAt || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
  } catch (_err) {
    // Non-fatal — transcript save failure should not break the chat
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initiate a new support chat session.
 * @param {{ customerId?: string, name?: string, topic?: string, history?: object[] }} opts
 * @returns {{ sessionId: string, queuePosition: number, estimatedWait: number }}
 */
export function initiateSession({ customerId, name = 'Guest', topic = '', history = [] } = {}) {
  const sessionId = generateSessionId();
  const session = {
    sessionId,
    customerId,
    name,
    topic,
    agentId: null,
    status: 'queued', // queued | active | ended
    messages: history.map(m => ({ ...m, source: 'history' })),
    startedAt: new Date().toISOString(),
    endedAt: null,
    waitSince: Date.now(),
  };
  chatSessions.set(sessionId, session);

  const availableAgent = getAvailableAgent();
  if (availableAgent) {
    session.status = 'assigned';
    session.agentId = availableAgent;
    const agentInfo = agentStatus.get(availableAgent);
    if (agentInfo) agentInfo.activeChatCount++;
    return { sessionId, queuePosition: 0, estimatedWait: 0 };
  }

  waitingQueue.push(sessionId);
  const queuePosition = waitingQueue.indexOf(sessionId) + 1;
  return { sessionId, queuePosition, estimatedWait: queuePosition * 3 };
}

/**
 * Get queue status.
 * @returns {{ queueLength: number, availableAgents: number, sessions: object[] }}
 */
export function getQueueStatus() {
  const available = [...agentStatus.values()].filter(a => a.status === 'available').length;
  const queuedSessions = waitingQueue
    .filter(id => chatSessions.has(id))
    .map((id, idx) => {
      const s = chatSessions.get(id);
      return {
        sessionId: id,
        customerName: s.name,
        topic: s.topic,
        waitTime: Math.floor((Date.now() - s.waitSince) / 1000),
        position: idx + 1,
      };
    });

  return {
    queueLength: waitingQueue.length,
    availableAgents: available,
    totalAgents: agentStatus.size,
    sessions: queuedSessions,
  };
}

/**
 * Get all active chat sessions (for agent dashboard).
 * @returns {object[]}
 */
export function getActiveSessions() {
  return [...chatSessions.entries()]
    .filter(([, s]) => s.status === 'active' || s.status === 'assigned')
    .map(([id, s]) => ({
      sessionId: id,
      customerName: s.name,
      agentId: s.agentId,
      topic: s.topic,
      messageCount: s.messages.length,
      startedAt: s.startedAt,
    }));
}

/**
 * Get a session's full details including message history.
 * @param {string} sessionId
 */
export function getSession(sessionId) {
  return chatSessions.get(sessionId) || null;
}

/**
 * Register a support agent (called on agent socket connect).
 * @param {string} agentId
 * @param {string} socketId
 */
export function registerAgent(agentId, socketId) {
  agentStatus.set(agentId, {
    socketId,
    status: 'available',
    activeChatCount: 0,
  });
}

/**
 * Update agent availability status.
 * @param {string} agentId
 * @param {'available'|'busy'|'away'} status
 */
export function updateAgentStatus(agentId, status) {
  const info = agentStatus.get(agentId);
  if (info) info.status = status;
}

/**
 * Deregister an agent on disconnect.
 * @param {string} agentId
 */
export function deregisterAgent(agentId) {
  agentStatus.delete(agentId);
}

/**
 * Agent picks up a queued session.
 * @param {string} agentId
 * @param {string} sessionId
 * @returns {{ success: boolean, session?: object }}
 */
export async function agentPickUpSession(agentId, sessionId) {
  const session = chatSessions.get(sessionId);
  if (!session) return { success: false, error: 'Session not found' };
  if (session.status === 'active') return { success: false, error: 'Already picked up' };

  session.agentId = agentId;
  session.status = 'active';

  // Remove from waiting queue
  const queueIdx = waitingQueue.indexOf(sessionId);
  if (queueIdx !== -1) waitingQueue.splice(queueIdx, 1);

  const agentInfo = agentStatus.get(agentId);
  if (agentInfo) agentInfo.activeChatCount++;

  await saveTranscript(sessionId, session);
  return { success: true, session };
}

/**
 * Add a message to a session and persist the transcript.
 * @param {string} sessionId
 * @param {{ sender: string, content: string, senderName?: string }} msg
 * @returns {object|null} The stored message, or null if session not found
 */
export async function addMessage(sessionId, { sender, content, senderName = '' }) {
  const session = chatSessions.get(sessionId);
  if (!session) return null;

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sender,
    senderName,
    content,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(message);
  await saveTranscript(sessionId, session);
  return message;
}

/**
 * End a chat session.
 * @param {string} sessionId
 * @param {string} endedBy
 */
export async function endSession(sessionId, endedBy = 'system') {
  const session = chatSessions.get(sessionId);
  if (!session) return;

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.endedBy = endedBy;

  if (session.agentId) {
    const agentInfo = agentStatus.get(session.agentId);
    if (agentInfo && agentInfo.activeChatCount > 0) agentInfo.activeChatCount--;
  }

  // Remove from queue if still there
  const queueIdx = waitingQueue.indexOf(sessionId);
  if (queueIdx !== -1) waitingQueue.splice(queueIdx, 1);

  await saveTranscript(sessionId, session);

  // Clean up after 10 minutes
  setTimeout(() => chatSessions.delete(sessionId), 10 * 60 * 1000);
}

/**
 * Initialize the live chat Socket.IO namespace.
 * @param {import('socket.io').Server} io
 */
export function initializeLiveChat(io) {
  const ns = io.of('/support');

  ns.on('connection', socket => {
    const { role, agentId, sessionId } = socket.handshake.auth || {};

    // ── Agent connections ───────────────────────────────────────────
    if (role === 'agent' && agentId) {
      registerAgent(agentId, socket.id);
      socket.join(`agent:${agentId}`);
      // Notify agent of queued sessions
      socket.emit('queue:update', getQueueStatus());

      socket.on('agent:status', ({ status }) => {
        updateAgentStatus(agentId, status);
        ns.emit('agent:status-changed', { agentId, status });
      });

      socket.on('agent:pickup', async ({ sessionId: sid }) => {
        const result = await agentPickUpSession(agentId, sid);
        if (result.success) {
          socket.join(`session:${sid}`);
          ns.to(`session:${sid}`).emit('chat:agent-joined', {
            agentId,
            sessionId: sid,
            message: 'A support agent has joined the chat.',
          });
          socket.emit('agent:pickup-success', { session: result.session });
          // Refresh queue for all agents
          ns.emit('queue:update', getQueueStatus());
        } else {
          socket.emit('agent:pickup-error', { error: result.error });
        }
      });

      socket.on('chat:message', async ({ sessionId: sid, content }) => {
        const msg = await addMessage(sid, { sender: 'agent', content, senderName: agentId });
        if (msg) ns.to(`session:${sid}`).emit('chat:message', { ...msg, sessionId: sid });
      });

      socket.on('chat:typing', ({ sessionId: sid, isTyping }) => {
        ns.to(`session:${sid}`).emit('chat:typing', { sender: 'agent', isTyping, sessionId: sid });
      });

      socket.on('chat:end', async ({ sessionId: sid }) => {
        await endSession(sid, agentId);
        ns.to(`session:${sid}`).emit('chat:ended', { sessionId: sid, endedBy: 'agent' });
        ns.emit('queue:update', getQueueStatus());
      });

      socket.on('disconnect', () => {
        deregisterAgent(agentId);
      });

    // ── Customer connections ──────────────────────────────────────────
    } else if (sessionId) {
      socket.join(`session:${sessionId}`);

      // If session already has an agent, emit agent-joined
      const session = chatSessions.get(sessionId);
      if (session && (session.status === 'active' || session.status === 'assigned')) {
        socket.emit('chat:agent-joined', {
          agentId: session.agentId,
          sessionId,
          message: 'You are connected to a support agent.',
        });
      }

      socket.on('chat:message', async ({ content }) => {
        const msg = await addMessage(sessionId, { sender: 'customer', content });
        if (msg) ns.to(`session:${sessionId}`).emit('chat:message', { ...msg, sessionId });
      });

      socket.on('chat:typing', ({ isTyping }) => {
        ns.to(`session:${sessionId}`).emit('chat:typing', { sender: 'customer', isTyping, sessionId });
      });

      socket.on('chat:end', async () => {
        await endSession(sessionId, 'customer');
        ns.to(`session:${sessionId}`).emit('chat:ended', { sessionId, endedBy: 'customer' });
      });

      socket.on('disconnect', () => {
        // Session stays in memory so customer can reconnect
      });
    }
  });

  // Periodically notify agents of queue updates (every 30 s)
  setInterval(() => {
    ns.emit('queue:update', getQueueStatus());
  }, 30_000);
}
