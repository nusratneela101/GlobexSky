/**
 * Tests for email.service.js — extended coverage.
 * Tests sendVerificationEmail, sendOrderConfirmation, sendPasswordReset,
 * sendWelcomeEmail, and other email functions.
 * Uses mock nodemailer transport.
 */

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-msg-extended' }),
    })),
  },
}));

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import nodemailer from 'nodemailer';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendShippingUpdateEmail,
  sendOrderDeliveredEmail,
  sendRefundProcessedEmail,
  sendPaymentReceiptEmail,
  sendAccountVerificationEmail,
  sendShipmentUpdateEmail,
  sendGenericEmail,
} from '../../services/email.service.js';

function getTransport() {
  return nodemailer.createTransport.mock.results[0].value;
}

describe('Email Service — Extended Coverage', () => {
  beforeEach(() => {
    getTransport().sendMail.mockClear();
  });

  describe('sendWelcomeEmail', () => {
    it('should send a welcome email', async () => {
      await sendWelcomeEmail('user@test.com', {
        userName: 'Test User',
        verificationUrl: 'https://test.com/verify?token=abc',
      });
      expect(getTransport().sendMail).toHaveBeenCalled();
    });

    it('should send welcome email to correct recipient', async () => {
      await sendWelcomeEmail('recipient@example.com', {
        userName: 'Recipient',
        verificationUrl: 'https://test.com/verify',
      });
      const callArg = getTransport().sendMail.mock.calls[0][0];
      expect(callArg.to).toBe('recipient@example.com');
    });

    it('should handle missing userName gracefully', async () => {
      await expect(
        sendWelcomeEmail('test@test.com', {})
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email', async () => {
      await sendPasswordResetEmail('user@test.com', {
        userName: 'Test User',
        resetUrl: 'https://test.com/reset?token=xyz',
        expiresIn: '1 hour',
      });
      expect(getTransport().sendMail).toHaveBeenCalled();
    });

    it('should include reset URL in email content', async () => {
      await sendPasswordResetEmail('user@test.com', {
        userName: 'Test User',
        resetUrl: 'https://test.com/reset?token=unique123',
      });
      const callArg = getTransport().sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('https://test.com/reset?token=unique123');
    });

    it('should use default expiry when not specified', async () => {
      await expect(
        sendPasswordResetEmail('user@test.com', { userName: 'User', resetUrl: 'https://test.com/r' })
      ).resolves.not.toThrow();
    });
  });

  describe('sendOrderConfirmationEmail', () => {
    const mockOrder = {
      id: 'order-123',
      items: [{ title: 'Product A', qty: 2, price: 50 }],
      total: 100,
      currency: 'USD',
      buyerName: 'John Doe',
    };

    it('should send an order confirmation email', async () => {
      await sendOrderConfirmationEmail('buyer@test.com', mockOrder);
      expect(getTransport().sendMail).toHaveBeenCalled();
    });

    it('should include order ID in the email', async () => {
      await sendOrderConfirmationEmail('buyer@test.com', mockOrder);
      const callArg = getTransport().sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('order-123');
    });

    it('should send to correct recipient', async () => {
      await sendOrderConfirmationEmail('buyer123@test.com', mockOrder);
      const callArg = getTransport().sendMail.mock.calls[0][0];
      expect(callArg.to).toBe('buyer123@test.com');
    });
  });

  describe('sendAccountVerificationEmail', () => {
    it('should send a verification email', async () => {
      await sendAccountVerificationEmail('verify@test.com', {
        userName: 'New User',
        verificationUrl: 'https://test.com/verify?token=verifyabc',
      });
      expect(getTransport().sendMail).toHaveBeenCalled();
    });

    it('should include verification URL in the email', async () => {
      await sendAccountVerificationEmail('verify@test.com', {
        userName: 'New User',
        verificationUrl: 'https://test.com/verify?token=verifytoken123',
      });
      const callArg = getTransport().sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('verifytoken123');
    });
  });

  describe('sendShippingUpdateEmail', () => {
    it('should send a shipping update email', async () => {
      const order = { id: 'ord-ship', trackingNumber: 'TRK123', carrier: 'DHL' };
      await sendShippingUpdateEmail('buyer@test.com', order);
      expect(getTransport().sendMail).toHaveBeenCalled();
    });
  });

  describe('sendRefundProcessedEmail', () => {
    it('should send a refund processed email', async () => {
      const refund = { id: 'ref-1', amount: 50, currency: 'USD', orderId: 'ord-1' };
      await sendRefundProcessedEmail('buyer@test.com', refund);
      expect(getTransport().sendMail).toHaveBeenCalled();
    });
  });

  describe('sendGenericEmail', () => {
    it('should send a generic email with subject and html', async () => {
      await sendGenericEmail('recipient@test.com', 'Test Subject', '<p>Hello</p>');
      expect(getTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@test.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should propagate sendMail errors', async () => {
      getTransport().sendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      await expect(
        sendWelcomeEmail('err@test.com', { userName: 'ErrUser', verificationUrl: 'http://x' })
      ).rejects.toThrow('SMTP connection failed');
    });
  });
});


  describe('sendWelcomeEmail', () => {
    it('should send a welcome email', async () => {
      const transport = nodemailer.createTransport();
      await sendWelcomeEmail('user@test.com', {
        userName: 'Test User',
        verificationUrl: 'https://test.com/verify?token=abc',
      });
      expect(transport.sendMail).toHaveBeenCalled();
    });

    it('should send welcome email to correct recipient', async () => {
      const transport = nodemailer.createTransport();
      await sendWelcomeEmail('recipient@example.com', {
        userName: 'Recipient',
        verificationUrl: 'https://test.com/verify',
      });
      const callArg = transport.sendMail.mock.calls[0][0];
      expect(callArg.to).toBe('recipient@example.com');
    });

    it('should handle missing userName gracefully', async () => {
      const transport = nodemailer.createTransport();
      await expect(
        sendWelcomeEmail('test@test.com', {})
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email', async () => {
      const transport = nodemailer.createTransport();
      await sendPasswordResetEmail('user@test.com', {
        userName: 'Test User',
        resetUrl: 'https://test.com/reset?token=xyz',
        expiresIn: '1 hour',
      });
      expect(transport.sendMail).toHaveBeenCalled();
    });

    it('should include reset URL in email content', async () => {
      const transport = nodemailer.createTransport();
      await sendPasswordResetEmail('user@test.com', {
        userName: 'Test User',
        resetUrl: 'https://test.com/reset?token=unique123',
      });
      const callArg = transport.sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('https://test.com/reset?token=unique123');
    });

    it('should use default expiry when not specified', async () => {
      const transport = nodemailer.createTransport();
      await expect(
        sendPasswordResetEmail('user@test.com', { userName: 'User', resetUrl: 'https://test.com/r' })
      ).resolves.not.toThrow();
    });
  });

  describe('sendOrderConfirmationEmail', () => {
    const mockOrder = {
      id: 'order-123',
      items: [{ title: 'Product A', qty: 2, price: 50 }],
      total: 100,
      currency: 'USD',
      buyerName: 'John Doe',
    };

    it('should send an order confirmation email', async () => {
      const transport = nodemailer.createTransport();
      await sendOrderConfirmationEmail('buyer@test.com', mockOrder);
      expect(transport.sendMail).toHaveBeenCalled();
    });

    it('should include order ID in the email', async () => {
      const transport = nodemailer.createTransport();
      await sendOrderConfirmationEmail('buyer@test.com', mockOrder);
      const callArg = transport.sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('order-123');
    });

    it('should send to correct recipient', async () => {
      const transport = nodemailer.createTransport();
      await sendOrderConfirmationEmail('buyer123@test.com', mockOrder);
      const callArg = transport.sendMail.mock.calls[0][0];
      expect(callArg.to).toBe('buyer123@test.com');
    });
  });

  describe('sendAccountVerificationEmail', () => {
    it('should send a verification email', async () => {
      const transport = nodemailer.createTransport();
      await sendAccountVerificationEmail('verify@test.com', {
        userName: 'New User',
        verificationUrl: 'https://test.com/verify?token=verifyabc',
      });
      expect(transport.sendMail).toHaveBeenCalled();
    });

    it('should include verification URL in the email', async () => {
      const transport = nodemailer.createTransport();
      await sendAccountVerificationEmail('verify@test.com', {
        userName: 'New User',
        verificationUrl: 'https://test.com/verify?token=verifytoken123',
      });
      const callArg = transport.sendMail.mock.calls[0][0];
      expect(callArg.html).toContain('verifytoken123');
    });
  });

  describe('sendShippingUpdateEmail', () => {
    it('should send a shipping update email', async () => {
      const transport = nodemailer.createTransport();
      const order = { id: 'ord-ship', trackingNumber: 'TRK123', carrier: 'DHL' };
      await sendShippingUpdateEmail('buyer@test.com', order);
      expect(transport.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendRefundProcessedEmail', () => {
    it('should send a refund processed email', async () => {
      const transport = nodemailer.createTransport();
      const refund = { id: 'ref-1', amount: 50, currency: 'USD', orderId: 'ord-1' };
      await sendRefundProcessedEmail('buyer@test.com', refund);
      expect(transport.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendGenericEmail', () => {
    it('should send a generic email with subject and html', async () => {
      const transport = nodemailer.createTransport();
      await sendGenericEmail('recipient@test.com', 'Test Subject', '<p>Hello</p>');
      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@test.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should propagate sendMail errors', async () => {
      nodemailer.createTransport.mockImplementationOnce(() => ({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection failed')),
      }));

      await expect(
        sendWelcomeEmail('err@test.com', { userName: 'ErrUser', verificationUrl: 'http://x' })
      ).rejects.toThrow('SMTP connection failed');
    });
  });
});
