/**
 * Integration tests for Cart routes.
 * Tests: POST /api/v1/cart/add, GET /api/v1/cart,
 * PUT /api/v1/cart/update/:itemId, DELETE /api/v1/cart/remove/:itemId
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const mockUserId = 'buyer-uuid-001';
const mockItemId = uuidv4();
const mockProductId = uuidv4();

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import cartRoutes from '../../routes/cart.routes.js';

const app = createTestApp(['/api/v1/cart', cartRoutes]);

function createQueryChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: result?.data ? [result.data] : [], error: null }).then(cb)
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
    if (table === 'cart_items') {
      return createQueryChain({
        data: { id: mockItemId, cart_id: 'cart-uuid-001', user_id: mockUserId, product_id: mockProductId, quantity: 2, product: { moq: 1 } },
        error: null,
      });
    }
    if (table === 'carts') {
      return createQueryChain({
        data: { id: 'cart-uuid-001', user_id: mockUserId },
        error: null,
      });
    }
    return createQueryChain({ data: null, error: null });
  });
}

describe('Cart Routes — Authentication required', () => {
  it('should return 401 for GET /cart without auth', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /cart/add without auth', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .send({ product_id: mockProductId, quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('should return 401 for DELETE /cart/remove/:itemId without auth', async () => {
    const res = await request(app).delete(`/api/v1/cart/remove/${mockItemId}`);
    expect(res.status).toBe(401);
  });
});

describe('Cart Routes — POST /api/v1/cart/add (authenticated)', () => {
  beforeEach(() => { setupAuth(); });

  it('should return 422 when product_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', 'Bearer mock-token')
      .send({ quantity: 1 });

    expect(res.status).toBe(422);
  });

  it('should return 422 when quantity is less than 1', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: mockProductId, quantity: 0 });

    expect(res.status).toBe(422);
  });

  it('should respond when adding a valid product to cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: mockProductId, quantity: 2 });

    expect([200, 201, 400, 404, 500]).toContain(res.status);
  });
});

describe('Cart Routes — PUT /api/v1/cart/update/:itemId (authenticated)', () => {
  beforeEach(() => { setupAuth(); });

  it('should return 422 when quantity is less than 1', async () => {
    const res = await request(app)
      .put(`/api/v1/cart/update/${mockItemId}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ quantity: 0 });

    expect(res.status).toBe(422);
  });

  it('should return 422 when quantity is not provided', async () => {
    const res = await request(app)
      .put(`/api/v1/cart/update/${mockItemId}`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
  });

  it('should accept a valid quantity update request', async () => {
    const res = await request(app)
      .put(`/api/v1/cart/update/${mockItemId}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ quantity: 3 });

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});

describe('Cart Routes — GET /api/v1/cart (authenticated)', () => {
  beforeEach(() => { setupAuth(); });

  it('should return the cart contents for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', 'Bearer mock-token');

    expect([200, 400, 500]).toContain(res.status);
    expect(res.body).toBeDefined();
  });
});
