/**
 * Globex Sky — WebSocket Configuration
 * Socket.io namespaces, rooms, rate limits, and connection settings.
 */

export const websocketConfig = {
  // Socket.io server options
  options: {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL_WWW,
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
      ].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  },

  // Namespaces
  namespaces: {
    chat: '/chat',
    videoMeeting: '/video-meeting',
    notifications: '/notifications',
  },

  // Chat rooms
  rooms: {
    buyerSupplier: 'buyer-supplier',
    support: 'support',
  },

  // Rate limits (events per window)
  rateLimits: {
    message: { max: 30, windowMs: 60000 },    // 30 messages/min
    typing: { max: 60, windowMs: 60000 },     // 60 typing events/min
    fileUpload: { max: 5, windowMs: 60000 },  // 5 files/min
  },

  // Message settings
  message: {
    maxLength: 5000,
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
  },
};

export default websocketConfig;
