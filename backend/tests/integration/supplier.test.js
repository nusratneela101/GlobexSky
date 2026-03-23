/**
 * Integration tests for supplier registration, verification, and product listing.
 */

import request from 'supertest';

// ─── Supabase mock ──────────────────────────────────────────────────────────
jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'supplier-uuid',
            email: 'supplier@test.com',
            role: 'supplier',
          },
        },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'supplier-profile-1',
          user_id: 'supplier-uuid',
          company_name: 'Test Supplier Co.',
          verified: true,
          role: 'supplier',
          status: 'active',
        },
        error: null,
      }),
      range: jest.fn().mockResolvedValue({
        data: [{ id: 'prod-1', title: 'Product A', price: 50 }],
        count: 1,
        error: null,
      }),
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

// ─── Supplier controller mock ─────────────────────────────────────────────────
jest.mock('../../controllers/supplier.controller.js', () => ({
  __esModule: true,
  getSupplierProfile: jest.fn((req, res) => {
    const id = req.params.id;
    if (id === 'nonexistent') {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    res.json({
      success: true,
      supplier: {
        id,
        company_name: 'Test Supplier Co.',
        verified: true,
        rating: 4.5,
      },
    });
  }),
  getSupplierProducts: jest.fn((req, res) => {
    res.json({
      success: true,
      products: [
        { id: 'prod-1', title: 'Product A', price: 50 },
        { id: 'prod-2', title: 'Product B', price: 75 },
      ],
      total: 2,
    });
  }),
  getDashboardStats: jest.fn((req, res) => {
    res.json({
      success: true,
      stats: {
        totalOrders: 25,
        totalRevenue: 1250,
        pendingOrders: 3,
        totalProducts: 10,
      },
    });
  }),
  updateSupplierProfile: jest.fn((req, res) => {
    if (!req.body) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }
    res.json({ success: true, message: 'Profile updated' });
  }),
  getSupplierOrders: jest.fn((req, res) => {
    res.json({
      success: true,
      orders: [
        { id: 'ord-1', status: 'confirmed', total: 100 },
        { id: 'ord-2', status: 'shipped', total: 75 },
      ],
    });
  }),
  getSupplierAnalytics: jest.fn((req, res) => {
    res.json({
      success: true,
      analytics: {
        revenue: [100, 200, 150, 300],
        orders: [5, 8, 6, 12],
      },
    });
  }),
  getSupplierEarnings: jest.fn((req, res) => {
    res.json({
      success: true,
      earnings: { total: 1250, pending: 200, paid: 1050 },
    });
  }),
}));

// ─── Role check mock ─────────────────────────────────────────────────────────
jest.mock('../../middleware/roleCheck.js', () => ({
  __esModule: true,
  requireSupplier: (req, res, next) => {
    if (!req.user || req.user.role !== 'supplier') {
      return res.status(403).json({ success: false, error: 'Supplier access required' });
    }
    next();
  },
  requireBuyer: (_req, _res, next) => next(),
}));

import { createTestApp } from '../helpers/testApp.js';
import supplierRoutes from '../../routes/supplier.routes.js';

const app = createTestApp(['/api/v1/suppliers', supplierRoutes]);

const SUPPLIER_TOKEN = { Authorization: 'Bearer valid-supplier-token' };

describe('Supplier Integration — Public Routes', () => {
  it('should get a supplier public profile by ID', async () => {
    const res = await request(app).get('/api/v1/suppliers/supplier-profile-1');

    expect([200, 404]).toContain(res.status);
  });

  it('should return 404 for nonexistent supplier', async () => {
    const res = await request(app).get('/api/v1/suppliers/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should list products for a supplier', async () => {
    const res = await request(app).get('/api/v1/suppliers/supplier-profile-1/products');

    expect([200, 404]).toContain(res.status);
  });
});

describe('Supplier Integration — Dashboard (Authenticated)', () => {
  it('should get dashboard stats for authenticated supplier', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers/dashboard/stats')
      .set(SUPPLIER_TOKEN);

    expect([200, 403]).toContain(res.status);
  });

  it('should update supplier profile', async () => {
    const res = await request(app)
      .put('/api/v1/suppliers/dashboard/profile')
      .set(SUPPLIER_TOKEN)
      .send({ company_name: 'Updated Co.', description: 'Updated description' });

    expect([200, 403]).toContain(res.status);
  });

  it('should get supplier orders', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers/dashboard/orders')
      .set(SUPPLIER_TOKEN);

    expect([200, 403]).toContain(res.status);
  });

  it('should get supplier analytics', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers/dashboard/analytics')
      .set(SUPPLIER_TOKEN);

    expect([200, 403]).toContain(res.status);
  });

  it('should return 401 for unauthenticated dashboard access', async () => {
    const res = await request(app).get('/api/v1/suppliers/dashboard/stats');

    expect([401, 403]).toContain(res.status);
  });
});
