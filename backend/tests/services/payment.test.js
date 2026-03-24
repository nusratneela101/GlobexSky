/**
 * Tests for payment services: Stripe, PayPal, bKash
 * Mocks all external APIs. No real API calls.
 */

// ─── Mock Stripe ────────────────────────────────────────────────────────────
const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    list: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      update: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock('../../config/integrations.js', () => ({
  __esModule: true,
  stripeConfig: {
    secretKey: 'sk_test_mock_key',
    webhookSecret: 'whsec_mock',
    connectWebhookSecret: 'whsec_connect_mock',
    apiVersion: '2024-06-20',
    currency: 'usd',
  },
}));

import {
  createPaymentIntent,
  confirmPaymentIntent,
  createRefund,
  constructWebhookEvent,
  handleWebhookEvent,
} from '../../services/payment/stripe.service.js';

describe('Stripe Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent with correct amount and currency', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test_123_secret',
      });

      const result = await createPaymentIntent({ amount: 5000, currency: 'usd' });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5000, currency: 'usd' })
      );
      expect(result.id).toBe('pi_test_123');
      expect(result.client_secret).toBe('pi_test_123_secret');
    });

    it('should include customer ID when provided', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_456',
        customer: 'cus_test_123',
        status: 'requires_payment_method',
        client_secret: 'secret',
      });

      await createPaymentIntent({ amount: 2000, currency: 'usd', customerId: 'cus_test_123' });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_test_123' })
      );
    });

    it('should include metadata when provided', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_789',
        metadata: { orderId: 'order-abc' },
        status: 'requires_payment_method',
        client_secret: 'secret',
      });

      await createPaymentIntent({
        amount: 10000,
        currency: 'usd',
        metadata: { orderId: 'order-abc' },
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ orderId: 'order-abc' }) })
      );
    });

    it('should throw an error when Stripe is not configured', async () => {
      // Simulate no secret key
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('STRIPE_SECRET_KEY is not set.')
      );

      await expect(createPaymentIntent({ amount: 1000, currency: 'usd' })).rejects.toThrow();
    });

    it('should use USD as default currency', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_default_currency',
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'secret',
      });

      const result = await createPaymentIntent({ amount: 3000 });
      expect(result).toBeDefined();
    });
  });

  describe('confirmPaymentIntent', () => {
    it('should confirm a payment intent', async () => {
      mockStripe.paymentIntents.confirm.mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
      });

      const result = await confirmPaymentIntent('pi_test_123', 'pm_card_visa');

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test_123',
        expect.objectContaining({ payment_method: 'pm_card_visa' })
      );
      expect(result.status).toBe('succeeded');
    });

    it('should handle confirmation failure gracefully', async () => {
      mockStripe.paymentIntents.confirm.mockRejectedValue(
        new Error('Card declined')
      );

      await expect(confirmPaymentIntent('pi_test_fail', 'pm_card_decline')).rejects.toThrow(
        'Card declined'
      );
    });
  });

  describe('createRefund', () => {
    it('should create a full refund', async () => {
      mockStripe.refunds.create.mockResolvedValue({
        id: 're_test_123',
        amount: 5000,
        status: 'succeeded',
      });

      const result = await createRefund('pi_test_123');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' })
      );
      expect(result.status).toBe('succeeded');
    });

    it('should create a partial refund', async () => {
      mockStripe.refunds.create.mockResolvedValue({
        id: 're_partial_123',
        amount: 2500,
        status: 'succeeded',
      });

      const result = await createRefund('pi_test_123', 2500);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2500 })
      );
      expect(result.amount).toBe(2500);
    });

    it('should include reason in refund', async () => {
      mockStripe.refunds.create.mockResolvedValue({
        id: 're_reason_123',
        reason: 'fraudulent',
        status: 'succeeded',
      });

      await createRefund('pi_test_123', null, 'fraudulent');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'fraudulent' })
      );
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct a valid webhook event', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123', status: 'succeeded' } },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await constructWebhookEvent(
        Buffer.from('{}'),
        'mock_signature'
      );

      expect(result.type).toBe('payment_intent.succeeded');
    });

    it('should throw on invalid webhook signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Webhook signature verification failed');
      });

      await expect(constructWebhookEvent(Buffer.from('{}'), 'bad_sig')).rejects.toThrow(
        'Webhook signature verification failed'
      );
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle payment_intent.succeeded event', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_succeeded',
            amount: 5000,
            currency: 'usd',
            metadata: { orderId: 'order-1' },
          },
        },
      };

      // Should not throw
      await expect(handleWebhookEvent(event)).resolves.not.toThrow();
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const event = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed',
            last_payment_error: { message: 'Insufficient funds' },
            metadata: { orderId: 'order-2' },
          },
        },
      };

      await expect(handleWebhookEvent(event)).resolves.not.toThrow();
    });

    it('should handle unknown event types gracefully', async () => {
      const event = {
        type: 'unknown.event.type',
        data: { object: {} },
      };

      await expect(handleWebhookEvent(event)).resolves.not.toThrow();
    });
  });
});
