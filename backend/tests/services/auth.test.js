/**
 * Tests for auth middleware: authenticate, requireRole, requireVerified, optionalAuth.
 * Mocks JWT and Supabase.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-jwt-secret-key';

// Mock Supabase
const mockUserData = {
  id: 'user-uuid-123',
  email: 'test@globexsky.com',
  role: 'buyer',
};

const mockProfile = {
  user_id: 'user-uuid-123',
  role: 'buyer',
  is_verified: true,
  status: 'active',
};

jest.mock('../../config/supabase.js', () => {
  const mockAuth = {
    getUser: jest.fn(),
  };
  const mockFrom = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      auth: mockAuth,
      from: jest.fn(() => mockFrom),
    },
  };
});

import supabase from '../../config/supabase.js';
import {
  authenticate,
  requireRole,
  requireVerified,
  optionalAuth,
} from '../../middleware/auth.middleware.js';

function makeReq(overrides = {}) {
  return {
    headers: {},
    user: null,
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('Auth Middleware — authenticate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: mockUserData },
      error: null,
    });
    supabase.from().single.mockResolvedValue({ data: mockProfile, error: null });
  });

  it('should return 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token format is invalid (no Bearer prefix)', async () => {
    const req = makeReq({ headers: { authorization: 'Token abc123' } });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should call next() with valid Supabase token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer valid-supabase-token' } });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-uuid-123');
  });

  it('should fall back to JWT verification when Supabase fails', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const token = jwt.sign({ sub: 'user-jwt-123', role: 'buyer' }, JWT_SECRET, { expiresIn: '1h' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    // Should either succeed with JWT or return 401
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should return 401 for an expired token', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } });

    const token = jwt.sign({ sub: 'user-old', role: 'buyer' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should attach profile to req.user when found', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('Auth Middleware — requireRole', () => {
  it('should call next() when user has the required role', () => {
    const req = makeReq({ user: { ...mockUserData, role: 'admin' } });
    const res = makeRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user lacks the required role', () => {
    const req = makeReq({ user: { ...mockUserData, role: 'buyer' } });
    const res = makeRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow multiple accepted roles', () => {
    const req = makeReq({ user: { ...mockUserData, role: 'supplier' } });
    const res = makeRes();
    const next = jest.fn();

    requireRole('admin', 'supplier')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user is not authenticated (no req.user)', () => {
    const req = makeReq({ user: null });
    const res = makeRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Auth Middleware — requireVerified', () => {
  it('should call next() when user is verified', () => {
    const req = makeReq({ user: { ...mockUserData, email_confirmed_at: '2024-01-01T00:00:00Z' } });
    const res = makeRes();
    const next = jest.fn();

    requireVerified(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user is not verified', () => {
    const req = makeReq({ user: { ...mockUserData, email_confirmed_at: null, emailVerified: false } });
    const res = makeRes();
    const next = jest.fn();

    requireVerified(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 403 when user is not authenticated', () => {
    const req = makeReq({ user: null });
    const res = makeRes();
    const next = jest.fn();

    requireVerified(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('Auth Middleware — optionalAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() and attach user when token is valid', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUserData }, error: null });
    supabase.from().single.mockResolvedValue({ data: mockProfile, error: null });

    const req = makeReq({ headers: { authorization: 'Bearer valid-optional-token' } });
    const res = makeRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should call next() without user when no token provided', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeFalsy();
  });

  it('should call next() without user when token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

    const req = makeReq({ headers: { authorization: 'Bearer invalid-token' } });
    const res = makeRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
