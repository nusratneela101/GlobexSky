/**
 * Helper to generate test JWT tokens for buyer, supplier, and admin roles.
 */
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

/**
 * Generate a test JWT token for a given role.
 * @param {'buyer'|'supplier'|'admin'} role
 * @param {object} overrides - Additional payload fields
 * @returns {string} JWT token
 */
export function generateTestToken(role = 'buyer', overrides = {}) {
  const payload = {
    sub: overrides.id || `test-${role}-id`,
    id: overrides.id || `test-${role}-id`,
    email: overrides.email || `${role}@test.com`,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return jwt.sign(payload, TEST_JWT_SECRET);
}

export function generateBuyerToken(overrides = {}) {
  return generateTestToken('buyer', overrides);
}

export function generateSupplierToken(overrides = {}) {
  return generateTestToken('supplier', overrides);
}

export function generateAdminToken(overrides = {}) {
  return generateTestToken('admin', overrides);
}

export function generateExpiredToken(role = 'buyer') {
  const payload = {
    sub: `test-${role}-id`,
    id: `test-${role}-id`,
    email: `${role}@test.com`,
    role,
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  return jwt.sign(payload, TEST_JWT_SECRET);
}

export function decodeToken(token) {
  return jwt.decode(token);
}
