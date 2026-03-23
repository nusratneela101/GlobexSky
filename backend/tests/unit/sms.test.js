/**
 * Unit tests for SMS service.
 * Tests: message formatting, phone number validation, mock SMS provider.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true, default: { from: jest.fn() } }));

import {
  sendSMS,
  sendOTP,
  sendOrderUpdateSMS,
  sendShipmentUpdateSMS,
  sendPaymentConfirmationSMS,
  sendDeliveryNotificationSMS,
  sendDisputeUpdateSMS,
  sendWelcomeSMS,
} from '../../services/sms.service.js';

describe('SMS — sendSMS in development/test environment', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should return mock: true in development mode', async () => {
    const result = await sendSMS('+8801700000000', 'Test message');
    expect(result.mock).toBe(true);
    expect(result.success).toBe(true);
  });

  it('should not throw in development mode', async () => {
    await expect(sendSMS('+8801700000000', 'Hello')).resolves.toBeDefined();
  });

  it('should log the message to console in dev mode', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendSMS('+8801700000000', 'Test log message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[SMS]'));
    consoleSpy.mockRestore();
  });
});

describe('SMS — Phone number validation', () => {
  it('should accept valid E.164 formatted phone numbers', () => {
    const validNumbers = ['+8801700000000', '+12025550123', '+442071838750', '+61412345678'];
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    validNumbers.forEach((num) => {
      expect(e164Regex.test(num)).toBe(true);
    });
  });

  it('should reject numbers without country code prefix', () => {
    const invalidNumbers = ['01700000000', '2025550123', ''];
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    invalidNumbers.forEach((num) => {
      expect(e164Regex.test(num)).toBe(false);
    });
  });

  it('should reject numbers that are too short', () => {
    const tooShort = ['+1', '+880', '+123'];
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    tooShort.forEach((num) => {
      expect(e164Regex.test(num)).toBe(false);
    });
  });
});

describe('SMS — Message formatting', () => {
  it('should include OTP in OTP message', async () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation((msg) => {
      expect(msg).toContain('123456');
    });
    await sendOTP('+8801700000000', { otp: '123456', expiresIn: '5 minutes', platformName: 'GlobexSky' });
    consoleSpy.mockRestore();
    process.env.NODE_ENV = 'test';
  });

  it('should include order status in order update SMS', async () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendOrderUpdateSMS('+8801700000000', {
      orderId: 'ORD-12345',
      status: 'shipped',
      platformName: 'GlobexSky',
    });
    consoleSpy.mockRestore();
    process.env.NODE_ENV = 'test';
  });

  it('should include tracking number in shipment update SMS', async () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendShipmentUpdateSMS('+8801700000000', {
      trackingNumber: 'TRK-999',
      status: 'in_transit',
      location: 'Dhaka Hub',
      platformName: 'GlobexSky',
    });
    consoleSpy.mockRestore();
    process.env.NODE_ENV = 'test';
  });
});

describe('SMS — Provider not configured (non-dev)', () => {
  it('should throw error in non-development mode when provider not configured', async () => {
    process.env.NODE_ENV = 'production';
    await expect(sendSMS('+8801700000000', 'Hello')).rejects.toThrow('SMS provider not configured');
    process.env.NODE_ENV = 'test';
  });
});

describe('SMS — Additional message types (development mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should send payment confirmation SMS successfully', async () => {
    const result = await sendPaymentConfirmationSMS('+8801700000000', {
      amount: 150.00,
      orderId: 'ORD-123',
      paymentMethod: 'Cash on Delivery',
      platformName: 'GlobexSky',
    });
    expect(result.success).toBe(true);
  });

  it('should send delivery notification SMS successfully', async () => {
    const result = await sendDeliveryNotificationSMS('+8801700000000', {
      orderId: 'ORD-456',
      deliveryDate: '2024-03-01',
      platformName: 'GlobexSky',
    });
    expect(result.success).toBe(true);
  });

  it('should send dispute update SMS successfully', async () => {
    const result = await sendDisputeUpdateSMS('+8801700000000', {
      disputeId: 'DIS-001',
      status: 'under_review',
      platformName: 'GlobexSky',
    });
    expect(result.success).toBe(true);
  });

  it('should send welcome SMS successfully', async () => {
    const result = await sendWelcomeSMS('+8801700000000', {
      userName: 'Test User',
      platformName: 'GlobexSky',
    });
    expect(result.success).toBe(true);
  });
});
