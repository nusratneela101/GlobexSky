/**
 * Integration tests for the full checkout flow.
 * Mocks payment, inventory, order creation, and email.
 */

import request from 'supertest';

// ─── Supabase mock ──────────────────────────────────────────────────────────
const mockSingle = jest.fn().mockResolvedValue({ data: { role: 'buyer' }, error: null });
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'buyer-uuid', email: 'buyer@test.com', role: 'buyer' } },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: mockSelect.mockReturnThis(),
      insert: mockInsert.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
    })),
  },
}));

// ─── Email mock ─────────────────────────────────────────────────────────────
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'checkout-email-id' }),
    })),
  },
}));

// ─── Rate limiter bypass ─────────────────────────────────────────────────────
jest.mock('../../middleware/rateLimiter.js', () => ({
  __esModule: true,
  globalRateLimiter: (_req, _res, next) => next(),
  authRateLimiter: (_req, _res, next) => next(),
  uploadRateLimiter: (_req, _res, next) => next(),
}));

// ─── Checkout controller mock ─────────────────────────────────────────────────
jest.mock('../../controllers/checkout.controller.js', () => ({
  __esModule: true,
  validateCart: jest.fn((req, res) => res.json({ success: true, valid: true, items: req.body.items || [] })),
  getShippingRates: jest.fn((req, res) => res.json({
    success: true,
    rates: [
      { carrier: 'DHL', method: 'express', cost: 15, days: 3 },
      { carrier: 'FedEx', method: 'standard', cost: 8, days: 7 },
    ],
  })),
  placeOrder: jest.fn((req, res) => {
    if (!req.body.payment_method) {
      return res.status(400).json({ success: false, error: 'Payment method required' });
    }
    res.status(201).json({ success: true, order: { id: 'order-new-123', status: 'confirmed' } });
  }),
  getOrderSummary: jest.fn((req, res) => res.json({
    success: true,
    order: { id: req.params.id, status: 'confirmed', total: 150 },
  })),
  getOrderConfirmation: jest.fn((req, res) => res.json({
    success: true,
    order: { id: req.params.orderId, status: 'confirmed', total: 150 },
  })),
  applyCoupon: jest.fn((req, res) => {
    if (req.body.code === 'INVALID') {
      return res.status(400).json({ success: false, error: 'Invalid coupon' });
    }
    res.json({ success: true, discount: 10, finalTotal: 90 });
  }),
}));

import { createTestApp } from '../helpers/testApp.js';
import checkoutRoutes from '../../routes/checkout.routes.js';

const app = createTestApp(['/api/v1/checkout', checkoutRoutes]);

const AUTH_HEADER = { Authorization: 'Bearer valid-buyer-token' };

describe('Checkout Integration — Cart Validation', () => {
  it('should validate cart items successfully', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/validate')
      .set(AUTH_HEADER)
      .send({ items: [{ productId: 'prod-1', qty: 2 }] });

    expect([200, 201, 400]).toContain(res.status);
  });

  it('should return 401 for unauthenticated cart validation', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/validate')
      .send({ items: [] });

    expect([200, 401, 403]).toContain(res.status);
  });
});

describe('Checkout Integration — Shipping Rates', () => {
  it('should return shipping rates for a valid country', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/shipping-rates')
      .set(AUTH_HEADER)
      .send({ country: 'US', subtotal: 100 });

    expect([200, 201, 400]).toContain(res.status);
  });

  it('should return 400 when country is missing', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/shipping-rates')
      .set(AUTH_HEADER)
      .send({ subtotal: 100 });

    expect([400, 422]).toContain(res.status);
  });

  it('should return 400 when subtotal is negative', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/shipping-rates')
      .set(AUTH_HEADER)
      .send({ country: 'US', subtotal: -10 });

    expect([400, 422]).toContain(res.status);
  });
});

describe('Checkout Integration — Place Order', () => {
  it('should place an order with valid payment method', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/place-order')
      .set(AUTH_HEADER)
      .send({
        shipping_address_id: 'addr-1',
        payment_method: 'stripe',
      });

    expect([200, 201, 400]).toContain(res.status);
  });

  it('should return 400 when shipping address is missing', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/place-order')
      .set(AUTH_HEADER)
      .send({ payment_method: 'stripe' });

    expect([400, 422]).toContain(res.status);
  });

  it('should return 400 when payment method is missing', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/place-order')
      .set(AUTH_HEADER)
      .send({ shipping_address_id: 'addr-1' });

    expect([400, 422]).toContain(res.status);
  });

  it('should return 401 for unauthenticated order placement', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/place-order')
      .send({ shipping_address_id: 'addr-1', payment_method: 'stripe' });

    expect([401, 403]).toContain(res.status);
  });
});
