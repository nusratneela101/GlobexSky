/**
 * Global test setup: environment variable mocks and console suppression.
 */

// Set required environment variables before any module is loaded
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'test-pass';
process.env.FRONTEND_URL = 'https://test.globexsky.com';
process.env.EXCHANGE_RATE_API_KEY = 'test-exchange-rate-key';

// Suppress console.error for expected errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Allow through errors that are not expected
    const msg = args[0]?.toString() || '';
    if (
      msg.includes('ExchangeRate') ||
      msg.includes('[CurrencyService]') ||
      msg.includes('DeprecationWarning')
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});
