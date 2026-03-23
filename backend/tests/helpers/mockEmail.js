/**
 * Mock nodemailer transport for testing email functions without sending real emails.
 */

const sentEmails = [];

const mockTransport = {
  sendMail: jest.fn((mailOptions) => {
    sentEmails.push({ ...mailOptions, sentAt: new Date().toISOString() });
    return Promise.resolve({ messageId: `mock-msg-${Date.now()}` });
  }),
};

export function createMockTransport() {
  return mockTransport;
}

export function getSentEmails() {
  return [...sentEmails];
}

export function clearSentEmails() {
  sentEmails.length = 0;
  mockTransport.sendMail.mockClear();
}

export function getLastSentEmail() {
  return sentEmails[sentEmails.length - 1] || null;
}

export default mockTransport;
