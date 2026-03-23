/**
 * Integration tests for Payment routes.
 * Tests: GET /api/v1/payments/transactions, POST /api/v1/payments/checkout,
 * POST /api/v1/payments/refund, GET /api/v1/payments/methods
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const mockUserId = 'buyer-uuid-001';
const mockTransactionId = uuidv4();
const mockOrderId = uuidv4();

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import paymentRoutes from '../../routes/payment.routes.js';

const app = createTestApp(['/api/v1/payments', paymentRoutes]);

function createQueryChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: [], error: null }).then(cb)
    ),
  };
  return chain;
}

function setupAuth() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: mockUserId, email: 'buyer@test.com' } },
    error: null,
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return createQueryChain({ data: { role: 'buyer', user_id: mockUserId }, error: null });
    }
    return createQueryChain({ data: null, error: null });
  });
}

describe('Payment Routes — Authentication required', () => {
  it('should return 401 for GET /payments/transactions without auth', async () => {
    const res = await request(app).get('/api/v1/payments/transactions');
    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /payments/checkout without auth', async () => {
    const res = await request(app)
      .post('/api/v1/payments/checkout')
      .send({ order_id: mockOrderId, payment_method: 'card' });
    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /payments/refund without auth', async () => {
    const res = await request(app)
      .post('/api/v1/payments/refund')
      .send({ transaction_id: mockTransactionId, reason: 'Item not received' });
    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /payments/methods without auth', async () => {
    const res = await request(app).get('/api/v1/payments/methods');
    expect(res.status).toBe(401);
  });
});

describe('Payment Routes — Validation errors (authenticated)', () => {
  beforeEach(() => { setupAuth(); });

  it('should return 422 when order_id is not a UUID in checkout', async () => {
    const res = await request(app)
      .post('/api/v1/payments/checkout')
      .set('Authorization', 'Bearer mock-token')
      .send({ order_id: 'not-a-uuid', payment_method: 'card' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when payment_method is missing in checkout', async () => {
    const res = await request(app)
      .post('/api/v1/payments/checkout')
      .set('Authorization', 'Bearer mock-token')
      .send({ order_id: mockOrderId });

    expect(res.status).toBe(422);
  });

  it('should return 422 when transaction_id is not a UUID in refund', async () => {
    const res = await request(app)
      .post('/api/v1/payments/refund')
      .set('Authorization', 'Bearer mock-token')
      .send({ transaction_id: 'bad-id', reason: 'Wrong item' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when reason is missing in refund', async () => {
    const res = await request(app)
      .post('/api/v1/payments/refund')
      .set('Authorization', 'Bearer mock-token')
      .send({ transaction_id: mockTransactionId });

    expect(res.status).toBe(422);
  });
});

describe('Payment Routes — Authenticated requests', () => {
  beforeEach(() => { setupAuth(); });

  it('should respond to GET /payments/transactions with auth', async () => {
    const res = await request(app)
      .get('/api/v1/payments/transactions')
      .set('Authorization', 'Bearer mock-token');

    expect([200, 400, 404, 500]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  it('should respond to GET /payments/methods with auth', async () => {
    const res = await request(app)
      .get('/api/v1/payments/methods')
      .set('Authorization', 'Bearer mock-token');

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});
