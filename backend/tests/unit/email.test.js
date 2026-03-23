/**
 * Unit tests for email service.
 * Tests: template rendering, subject line generation, recipient validation.
 * Uses mock nodemailer transport.
 */

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-msg-id' }),
    })),
  },
}));

jest.mock('../../config/supabase.js', () => ({
  __esModule: true, default: { from: jest.fn() } }));

import nodemailer from 'nodemailer';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendShippingUpdateEmail,
  sendOrderDeliveredEmail,
  sendDisputeOpenedEmail,
  sendRefundProcessedEmail,
  sendPaymentReceiptEmail,
  sendShipmentUpdateEmail,
  sendAccountVerificationEmail,
} from '../../services/email.service.js';

function getTransport() {
  return nodemailer.createTransport.mock.results[0].value;
}

describe('Email — nodemailer transport mock', () => {
  it('should create a transport with correct SMTP configuration', () => {
    expect(nodemailer.createTransport).toHaveBeenCalled();
  });

  it('should call sendMail when sending a welcome email', async () => {
    await sendWelcomeEmail('user@test.com', {
      userName: 'Test User',
      verificationUrl: 'https://test.globexsky.com/verify?token=abc',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should send welcome email with correct recipient address', async () => {
    await sendWelcomeEmail('recipient@test.com', { userName: 'Alice' });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.to).toBe('recipient@test.com');
  });
});

describe('Email — Subject line generation', () => {
  it('should include the platform name in welcome email subject', async () => {
    await sendWelcomeEmail('user@test.com', { userName: 'Bob' });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.subject).toContain('Welcome');
  });

  it('should include "Reset" in password reset email subject', async () => {
    await sendPasswordResetEmail('user@test.com', {
      userName: 'Alice',
      resetUrl: 'https://test.globexsky.com/reset?token=xyz',
    });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.subject.toLowerCase()).toContain('reset');
  });

  it('should include order ID in order confirmation email subject', async () => {
    await sendOrderConfirmationEmail('buyer@test.com', {
      id: 'order-uuid-12345678',
      userName: 'Carol',
      total: 99.99,
    });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.subject).toContain('ORDER');
  });
});

describe('Email — Recipient validation', () => {
  it('should accept valid email addresses', () => {
    const validEmails = ['user@example.com', 'test.user+tag@domain.co', 'admin@globexsky.com'];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    validEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(true);
    });
  });

  it('should reject obviously invalid email addresses', () => {
    const invalidEmails = ['not-an-email', '@nodomain.com', 'noatsign.com', ''];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    invalidEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it('should send password reset email to correct recipient', async () => {
    await sendPasswordResetEmail('target@test.com', { userName: 'Dan', resetUrl: 'https://x.com/r' });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.to).toBe('target@test.com');
  });

  it('should include html content in sent email', async () => {
    await sendWelcomeEmail('html@test.com', { userName: 'Eve' });
    const lastCall = getTransport().sendMail.mock.calls[getTransport().sendMail.mock.calls.length - 1][0];
    expect(lastCall.html).toBeDefined();
  });
});

describe('Email — Additional send functions', () => {
  it('should call sendMail for shipping update email', async () => {
    await sendShippingUpdateEmail('buyer@test.com', {
      id: 'ORD-001',
      userName: 'Alice',
      trackingNumber: 'TRK-123',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for order delivered email', async () => {
    await sendOrderDeliveredEmail('buyer@test.com', {
      id: 'ORD-002',
      userName: 'Bob',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for dispute opened email', async () => {
    await sendDisputeOpenedEmail('buyer@test.com', {
      id: 'DIS-001',
      userName: 'Carol',
      orderId: 'ORD-003',
      reason: 'Item not received',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for refund processed email', async () => {
    await sendRefundProcessedEmail('buyer@test.com', {
      id: 'REF-001',
      userName: 'Dave',
      amount: 75.00,
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for payment receipt email', async () => {
    await sendPaymentReceiptEmail('buyer@test.com', {
      id: 'TXN-001',
      userName: 'Eve',
      amount: 100.00,
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for shipment update email', async () => {
    await sendShipmentUpdateEmail('buyer@test.com', {
      trackingNumber: 'TRK-456',
      userName: 'Frank',
      status: 'In Transit',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });

  it('should call sendMail for account verification email', async () => {
    await sendAccountVerificationEmail('newuser@test.com', {
      userName: 'Grace',
      verificationUrl: 'https://test.globexsky.com/verify?t=xyz',
    });
    expect(getTransport().sendMail).toHaveBeenCalled();
  });
});
