/**
 * Integration tests for Product routes.
 * Tests: GET /api/v1/products, GET /api/v1/products/:id,
 * POST /api/v1/products (supplier auth), PUT, DELETE
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const mockProductId = uuidv4();

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

jest.mock('../../middleware/upload.js', () => ({
  uploadProduct: {
    array: () => (_req, _res, next) => next(),
  },
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import productRoutes from '../../routes/product.routes.js';

const app = createTestApp(['/api/v1/products', productRoutes]);

const mockProducts = [
  {
    id: mockProductId,
    title: 'Test Product',
    price: 99.99,
    category_id: uuidv4(),
    supplier_id: 'supplier-uuid-001',
    status: 'active',
  },
];

function createQueryChain(data) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(data),
    maybeSingle: jest.fn().mockResolvedValue(data),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: Array.isArray(data?.data) ? data.data : [], error: null, count: 0 }).then(cb)
    ),
  };
  return chain;
}

describe('Product Routes — GET /api/v1/products', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue(createQueryChain({ data: mockProducts, error: null }));
  });

  it('should return 200 with a list of products', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should accept pagination query parameters', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=10');
    expect(res.status).toBe(200);
  });

  it('should return featured products', async () => {
    const res = await request(app).get('/api/v1/products/featured');
    expect(res.status).toBe(200);
  });
});

describe('Product Routes — GET /api/v1/products/:id', () => {
  it('should return 200 with product data for a valid UUID', async () => {
    supabase.from.mockReturnValue(createQueryChain({ data: mockProducts[0], error: null }));

    const res = await request(app).get(`/api/v1/products/${mockProductId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 422 for a non-UUID product id', async () => {
    const res = await request(app).get('/api/v1/products/not-a-uuid');
    expect(res.status).toBe(422);
  });

  it('should return error status when product is not found', async () => {
    supabase.from.mockReturnValue(
      createQueryChain({ data: null, error: { message: 'Not found' } })
    );

    const res = await request(app).get(`/api/v1/products/${uuidv4()}`);
    expect([400, 404, 500]).toContain(res.status);
  });
});

describe('Product Routes — POST /api/v1/products (supplier auth required)', () => {
  it('should return 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .send({ title: 'New Product', price: 50, category_id: uuidv4() });

    expect(res.status).toBe(401);
  });

  it('should return 401 for an invalid auth token', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', 'Bearer invalid-token')
      .send({ title: 'Product', price: 50, category_id: uuidv4() });

    expect(res.status).toBe(401);
  });
});

describe('Product Routes — DELETE /api/v1/products/:id', () => {
  it('should return 401 without auth when deleting a product', async () => {
    const res = await request(app).delete(`/api/v1/products/${mockProductId}`);
    expect(res.status).toBe(401);
  });
});

describe('Product Routes — Search', () => {
  it('should return 200 for a valid search query', async () => {
    supabase.from.mockReturnValue(createQueryChain({ data: mockProducts, error: null }));
    const res = await request(app).get('/api/v1/products/search?q=test');
    expect(res.status).toBe(200);
  });

  it('should return 422 for an empty search query', async () => {
    const res = await request(app).get('/api/v1/products/search?q=');
    expect(res.status).toBe(422);
  });
});
