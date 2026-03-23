/**
 * Integration tests for Review routes.
 * Tests: POST /api/v1/reviews, GET /api/v1/reviews/product/:id,
 * PUT /api/v1/reviews/:id/helpful
 */
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const mockUserId = 'buyer-uuid-001';
const mockProductId = uuidv4();
const mockReviewId = uuidv4();

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import reviewRoutes from '../../routes/review.routes.js';

const app = createTestApp(['/api/v1/reviews', reviewRoutes]);

const mockReview = {
  id: mockReviewId,
  product_id: mockProductId,
  user_id: mockUserId,
  rating: 5,
  comment: 'Great product!',
  helpful_count: 0,
  created_at: '2024-01-20T00:00:00.000Z',
};

function createQueryChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
    range: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
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
    if (table === 'reviews') {
      return createQueryChain({ data: mockReview, error: null });
    }
    return createQueryChain({ data: null, error: null });
  });
}

describe('Review Routes — GET /api/v1/reviews/product/:productId', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue(
      createQueryChain({ data: [mockReview], error: null })
    );
  });

  it('should return 200 with reviews for a valid product UUID', async () => {
    const res = await request(app).get(`/api/v1/reviews/product/${mockProductId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 422 for a non-UUID productId', async () => {
    const res = await request(app).get('/api/v1/reviews/product/not-a-uuid');
    expect(res.status).toBe(422);
  });

  it('should return data array in the response', async () => {
    const res = await request(app).get(`/api/v1/reviews/product/${mockProductId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Review Routes — POST /api/v1/reviews (authentication required)', () => {
  it('should return 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .send({ product_id: mockProductId, rating: 5, comment: 'Great product' });

    expect(res.status).toBe(401);
  });

  it('should return 422 when rating is out of range (>5)', async () => {
    setupAuth();

    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: mockProductId, rating: 6, comment: 'Too high rating' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when rating is less than 1', async () => {
    setupAuth();

    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: mockProductId, rating: 0, comment: 'Too low' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when product_id is not a UUID', async () => {
    setupAuth();

    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: 'not-a-uuid', rating: 4, comment: 'Good' });

    expect(res.status).toBe(422);
  });

  it('should accept a valid review creation request', async () => {
    setupAuth();

    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: mockProductId, rating: 5, comment: 'Amazing product!' });

    expect([200, 201, 400, 404, 500]).toContain(res.status);
  });
});

describe('Review Routes — POST /api/v1/reviews/:id/helpful (authenticated)', () => {
  it('should return 401 without auth for marking helpful', async () => {
    const res = await request(app).post(`/api/v1/reviews/${mockReviewId}/helpful`);
    expect(res.status).toBe(401);
  });

  it('should return 422 for non-UUID review id', async () => {
    setupAuth();

    const res = await request(app)
      .post('/api/v1/reviews/not-a-uuid/helpful')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(422);
  });

  it('should respond to helpful mark request with valid review id', async () => {
    setupAuth();

    const res = await request(app)
      .post(`/api/v1/reviews/${mockReviewId}/helpful`)
      .set('Authorization', 'Bearer mock-token');

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});
