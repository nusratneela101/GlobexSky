/**
 * Integration tests for Order routes.
 * Tests: POST /api/v1/orders, GET /api/v1/orders/:id,
 * PATCH /api/v1/orders/:id/status, POST /api/v1/orders/:id/cancel
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const mockOrderId = uuidv4();
const mockAddressId = uuidv4();
const mockUserId = 'buyer-uuid-001';

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import orderRoutes from '../../routes/order.routes.js';

const app = createTestApp(['/api/v1/orders', orderRoutes]);

const mockUser = {
  id: mockUserId,
  email: 'buyer@test.com',
  role: 'buyer',
};

const mockOrder = {
  id: mockOrderId,
  buyer_id: mockUserId,
  status: 'pending',
  total: 199.98,
  items: [{ product_id: uuidv4(), quantity: 2, unit_price: 99.99 }],
  shipping_address_id: mockAddressId,
  created_at: '2024-01-10T00:00:00.000Z',
};

function createQueryChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: result ? [result.data] : [], error: null }).then(cb)
    ),
  };
  return chain;
}

function setupAuthenticatedUser() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });
  supabase.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return createQueryChain({ data: { role: 'buyer', user_id: mockUserId }, error: null });
    }
    if (table === 'orders') {
      return createQueryChain({ data: mockOrder, error: null });
    }
    return createQueryChain({ data: null, error: null });
  });
}

describe('Order Routes — Authentication required', () => {
  it('should return 401 for GET /orders without auth token', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /orders without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ product_id: uuidv4(), quantity: 1 }], shipping_address_id: mockAddressId });

    expect(res.status).toBe(401);
  });

  it('should return 401 for GET /orders/:id without auth', async () => {
    const res = await request(app).get(`/api/v1/orders/${mockOrderId}`);
    expect(res.status).toBe(401);
  });
});

describe('Order Routes — GET /api/v1/orders/:id (authenticated)', () => {
  beforeEach(() => { setupAuthenticatedUser(); });

  it('should return 200 with order data for valid UUID', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${mockOrderId}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 422 for a non-UUID order id', async () => {
    const res = await request(app)
      .get('/api/v1/orders/not-a-valid-uuid')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(422);
  });
});

describe('Order Routes — POST /api/v1/orders (authenticated)', () => {
  beforeEach(() => { setupAuthenticatedUser(); });

  it('should return 422 when items array is missing', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer mock-token')
      .send({ shipping_address_id: mockAddressId });

    expect(res.status).toBe(422);
  });

  it('should return 422 when shipping_address_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer mock-token')
      .send({ items: [{ product_id: uuidv4(), quantity: 1 }] });

    expect(res.status).toBe(422);
  });

  it('should return 422 when items is empty', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer mock-token')
      .send({ items: [], shipping_address_id: mockAddressId });

    expect(res.status).toBe(422);
  });
});

describe('Order Routes — PATCH /api/v1/orders/:id/status (authenticated)', () => {
  beforeEach(() => { setupAuthenticatedUser(); });

  it('should return 422 when status is missing', async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${mockOrderId}/status`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
  });

  it('should return 422 for a non-UUID order id in status update', async () => {
    const res = await request(app)
      .patch('/api/v1/orders/invalid-id/status')
      .set('Authorization', 'Bearer mock-token')
      .send({ status: 'shipped' });

    expect(res.status).toBe(422);
  });
});
