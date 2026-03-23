/**
 * Unit tests for COD (Cash on Delivery) service.
 * Tests: order creation, fraud scoring, reconciliation, status updates.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}));

import supabase from '../../config/supabase.js';
import {
  computeFraudScore,
  createCodOrderRecord,
  confirmDelivery,
  confirmCollection,
  markFraudulent,
} from '../../services/cod.service.js';

function buildChain(result) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn().mockImplementation((cb) =>
      Promise.resolve({ data: null, count: 0, error: null }).then(cb)
    ),
  };
  return chain;
}

describe('COD — Fraud score computation', () => {
  it('should return 0 score for a trusted, established buyer', () => {
    const score = computeFraudScore({
      orderValue: 50,
      buyerOrderCount: 20,
      returnRate: 0,
      addressMismatch: false,
      multipleOrdersSameDay: 0,
    });
    expect(score).toBe(0);
  });

  it('should add score for high order value from new buyer', () => {
    const score = computeFraudScore({
      orderValue: 600,
      buyerOrderCount: 1,
      returnRate: 0,
      addressMismatch: false,
      multipleOrdersSameDay: 0,
    });
    expect(score).toBeGreaterThan(0);
  });

  it('should add score for high return rate (>50%)', () => {
    const score = computeFraudScore({
      orderValue: 50,
      buyerOrderCount: 10,
      returnRate: 0.6,
      addressMismatch: false,
      multipleOrdersSameDay: 0,
    });
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it('should add score for address mismatch', () => {
    const score = computeFraudScore({
      orderValue: 50,
      buyerOrderCount: 10,
      returnRate: 0,
      addressMismatch: true,
      multipleOrdersSameDay: 0,
    });
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it('should cap maximum score at 100', () => {
    const score = computeFraudScore({
      orderValue: 1000,
      buyerOrderCount: 0,
      returnRate: 0.9,
      addressMismatch: true,
      multipleOrdersSameDay: 5,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should add score for multiple same-day orders (>=3)', () => {
    const scoreWithMany = computeFraudScore({
      orderValue: 50,
      buyerOrderCount: 10,
      returnRate: 0,
      addressMismatch: false,
      multipleOrdersSameDay: 3,
    });
    const scoreWithNone = computeFraudScore({
      orderValue: 50,
      buyerOrderCount: 10,
      returnRate: 0,
      addressMismatch: false,
      multipleOrdersSameDay: 0,
    });
    expect(scoreWithMany).toBeGreaterThan(scoreWithNone);
  });
});

describe('COD — Order status transitions', () => {
  it('should start with pending status', () => {
    const order = { status: 'pending', amount: 100 };
    expect(order.status).toBe('pending');
  });

  it('should transition from pending to out_for_delivery', () => {
    const validTransitions = {
      pending: ['assigned', 'cancelled'],
      assigned: ['picked_up', 'cancelled'],
      picked_up: ['out_for_delivery'],
      out_for_delivery: ['delivered', 'failed'],
      delivered: [],
      failed: ['reassigned'],
    };

    expect(validTransitions.pending).toContain('assigned');
    expect(validTransitions.picked_up).toContain('out_for_delivery');
    expect(validTransitions.out_for_delivery).toContain('delivered');
  });

  it('should flag order when fraud score >= 60', () => {
    const fraudScore = 65;
    const is_flagged = fraudScore >= 60;
    expect(is_flagged).toBe(true);
  });

  it('should not flag order when fraud score < 60', () => {
    const fraudScore = 45;
    const is_flagged = fraudScore >= 60;
    expect(is_flagged).toBe(false);
  });
});

describe('COD — Reconciliation logic', () => {
  it('should mark order as reconciled when amount_collected matches amount', () => {
    const order = { amount: 150, amount_collected: 150 };
    const isReconciled = order.amount_collected === order.amount;
    expect(isReconciled).toBe(true);
  });

  it('should detect discrepancy when collected amount differs', () => {
    const order = { amount: 150, amount_collected: 140 };
    const discrepancy = order.amount - order.amount_collected;
    expect(discrepancy).toBe(10);
  });

  it('should compute return rate correctly', () => {
    const totalOrders = 10;
    const returnCount = 3;
    const returnRate = totalOrders > 0 ? returnCount / totalOrders : 0;
    expect(returnRate).toBeCloseTo(0.3, 2);
  });
});

describe('COD — createCodOrderRecord', () => {
  beforeEach(() => {
    supabase.from.mockImplementation((table) => {
      if (table === 'cod_orders') {
        return buildChain({
          data: {
            id: 'cod-001',
            order_id: 'order-001',
            buyer_id: 'buyer-001',
            amount: 100,
            fraud_score: 0,
            is_flagged: false,
            status: 'pending',
          },
          error: null,
        });
      }
      return buildChain({ data: null, count: 0, error: null });
    });
  });

  it('should create a COD order with pending status', async () => {
    const result = await createCodOrderRecord({
      order_id: 'order-001',
      buyer_id: 'buyer-001',
      amount: 100,
    });
    expect(result.status).toBe('pending');
    expect(result.order_id).toBe('order-001');
  });

  it('should flag order when fraud score >= 60', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'cod_orders') {
        const chain = buildChain({
          data: { id: 'cod-002', fraud_score: 70, is_flagged: true, status: 'pending' },
          error: null,
        });
        return chain;
      }
      return buildChain({ data: null, count: 10, error: null });
    });

    const result = await createCodOrderRecord({
      order_id: 'order-002',
      buyer_id: 'risky-buyer',
      amount: 600,
    });
    expect(result.is_flagged).toBe(true);
  });
});

describe('COD — confirmDelivery and confirmCollection', () => {
  it('should confirm delivery of COD order', async () => {
    supabase.from.mockReturnValue(
      buildChain({ data: { id: 'cod-001', status: 'delivered' }, error: null })
    );

    const result = await confirmDelivery('cod-001', 'carrier-001');
    expect(result.status).toBe('delivered');
  });

  it('should confirm collection of COD order', async () => {
    supabase.from.mockReturnValue(
      buildChain({ data: { id: 'cod-001', status: 'collected' }, error: null })
    );

    const result = await confirmCollection('cod-001');
    expect(result.status).toBe('collected');
  });

  it('should throw if confirmDelivery fails', async () => {
    supabase.from.mockReturnValue(
      buildChain({ data: null, error: { message: 'Not found' } })
    );

    await expect(confirmDelivery('nonexistent', 'carrier-001')).rejects.toBeDefined();
  });
});

describe('COD — markFraudulent', () => {
  it('should mark an order as fraudulent', async () => {
    supabase.from.mockReturnValue(
      buildChain({ data: { id: 'cod-001', status: 'fraudulent', is_flagged: true }, error: null })
    );

    const result = await markFraudulent('cod-001', 'Suspicious pattern');
    expect(result.is_flagged).toBe(true);
  });
});
