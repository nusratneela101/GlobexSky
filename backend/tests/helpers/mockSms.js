/**
 * Mock SMS/Twilio client for testing SMS functions without sending real messages.
 */

const sentMessages = [];

const mockSmsClient = {
  messages: {
    create: jest.fn(({ to, body }) => {
      const msg = { to, body, sid: `SM-mock-${Date.now()}`, status: 'queued', sentAt: new Date().toISOString() };
      sentMessages.push(msg);
      return Promise.resolve(msg);
    }),
  },
};

export function getMockSmsClient() {
  return mockSmsClient;
}

export function getSentMessages() {
  return [...sentMessages];
}

export function clearSentMessages() {
  sentMessages.length = 0;
  mockSmsClient.messages.create.mockClear();
}

export function getLastSentMessage() {
  return sentMessages[sentMessages.length - 1] || null;
}

export default mockSmsClient;
