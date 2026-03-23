/**
 * Tests for websocket.service.js
 * Mocks Socket.io.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      update: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

jest.mock('../../config/websocket.js', () => ({
  __esModule: true,
  default: {
    cors: { origin: '*' },
    rateLimits: {
      message: { windowMs: 60000, max: 100 },
    },
    namespaces: {
      chat: '/chat',
      videoMeeting: '/video-meeting',
      notifications: '/notifications',
    },
  },
}));

import {
  initializeWebSocket,
  getOnlineUserIds,
  isUserOnline,
} from '../../services/websocket.service.js';

// ─── Socket mock factory ──────────────────────────────────────────────────────
function createMockSocket(id = 'socket-1') {
  const socket = {
    id,
    data: {},
    handshake: { auth: {}, query: {} },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    broadcast: {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    },
    to: jest.fn().mockReturnThis(),
    on: jest.fn(),
    disconnect: jest.fn(),
  };
  return socket;
}

// ─── IO mock factory ─────────────────────────────────────────────────────────
function createMockIo() {
  const handlers = {};
  const mockNs = {
    use: jest.fn(),
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    sockets: { sockets: new Map() },
    _handlers: handlers,
  };
  const io = {
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    of: jest.fn(() => mockNs),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    use: jest.fn(),
    sockets: { sockets: new Map() },
    _handlers: handlers,
    _mockNs: mockNs,
  };
  return io;
}

describe('WebSocket Service', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = createMockIo();
  });

  describe('initializeWebSocket', () => {
    it('should register a connection handler on io', () => {
      initializeWebSocket(io);
      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should not throw when called with a valid io instance', () => {
      expect(() => initializeWebSocket(io)).not.toThrow();
    });
  });

  describe('getOnlineUserIds', () => {
    it('should return an array', () => {
      initializeWebSocket(io);
      const onlineIds = getOnlineUserIds();
      expect(Array.isArray(onlineIds)).toBe(true);
    });

    it('should return an empty array initially', () => {
      initializeWebSocket(io);
      const onlineIds = getOnlineUserIds();
      expect(onlineIds).toHaveLength(0);
    });
  });

  describe('isUserOnline', () => {
    it('should return false for a user who has not connected', () => {
      initializeWebSocket(io);
      const result = isUserOnline('user-not-online');
      expect(result).toBe(false);
    });

    it('should return false for undefined userId', () => {
      initializeWebSocket(io);
      const result = isUserOnline(undefined);
      expect(result).toBe(false);
    });
  });

  describe('Connection handling', () => {
    it('should handle a new socket connection without throwing', () => {
      initializeWebSocket(io);
      const connectionHandler = io._handlers['connection'];
      const socket = createMockSocket('socket-connect-test');
      socket.handshake.auth = {};

      expect(() => connectionHandler(socket)).not.toThrow();
    });

    it('should register disconnect handler on each socket', () => {
      initializeWebSocket(io);
      const connectionHandler = io._handlers['connection'];
      const socket = createMockSocket('socket-2');

      connectionHandler(socket);

      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should register message event handlers on each socket', () => {
      initializeWebSocket(io);
      const connectionHandler = io._handlers['connection'];
      const socket = createMockSocket('socket-3');

      connectionHandler(socket);

      const registeredEvents = socket.on.mock.calls.map((c) => c[0]);
      expect(registeredEvents.length).toBeGreaterThan(0);
    });
  });
});
