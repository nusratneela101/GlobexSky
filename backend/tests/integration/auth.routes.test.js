/**
 * Integration tests for Auth routes.
 * Tests: POST /api/v1/auth/register, POST /api/v1/auth/login,
 * POST /api/v1/auth/logout, POST /api/v1/auth/forgot-password
 */
import request from 'supertest';

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    auth: {
      admin: {
        createUser: jest.fn(),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } }),
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    })),
  },
}));

jest.mock('../../middleware/rateLimiter.js', () => ({
  __esModule: true,
  globalRateLimiter: (_req, _res, next) => next(),
  authRateLimiter: (_req, _res, next) => next(),
  uploadRateLimiter: (_req, _res, next) => next(),
}));

import supabase from '../../config/supabase.js';
import { createTestApp } from '../helpers/testApp.js';
import authRoutes from '../../routes/auth.routes.js';

const app = createTestApp(['/api/v1/auth', authRoutes]);

describe('Auth Routes — POST /api/v1/auth/register', () => {
  beforeEach(() => {
    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'test@test.com' } },
      error: null,
    });
  });

  it('should register a new user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@test.com', password: 'Password123!', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/registration successful/i);
  });

  it('should return 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ password: 'Password123!', name: 'User' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@test.com', password: '123', name: 'User' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when name is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@test.com', password: 'Password123!', name: 'X' });

    expect(res.status).toBe(422);
  });

  it('should return 400 when supabase returns an error', async () => {
    supabase.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: 'Email already exists' },
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'existing@test.com', password: 'Password123!', name: 'Existing User' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth Routes — POST /api/v1/auth/login', () => {
  it('should return token on successful login', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-id', email: 'buyer@test.com' },
        session: { access_token: 'mock-token-123', refresh_token: 'mock-refresh-123' },
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'buyer@test.com', password: 'ValidPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should return 401 on invalid credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'buyer@test.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 422 when email is missing from login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'Password123!' });

    expect(res.status).toBe(422);
  });

  it('should return 422 when password is missing from login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com' });

    expect(res.status).toBe(422);
  });
});

describe('Auth Routes — POST /api/v1/auth/forgot-password', () => {
  it('should return success for a valid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'user@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 422 for an invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
  });
});
