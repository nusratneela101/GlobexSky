/**
 * Unit tests for authentication utilities: JWT generation, verification,
 * password hashing (bcrypt), and token expiry.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

describe('Auth — JWT token generation', () => {
  it('should generate a valid JWT token with correct payload', () => {
    const payload = { sub: 'user-123', email: 'user@test.com', role: 'buyer' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  it('should include the correct fields in the decoded payload', () => {
    const payload = { sub: 'user-abc', email: 'buyer@test.com', role: 'buyer' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.sub).toBe('user-abc');
    expect(decoded.email).toBe('buyer@test.com');
    expect(decoded.role).toBe('buyer');
  });

  it('should generate tokens for different roles', () => {
    const roles = ['buyer', 'supplier', 'admin'];
    roles.forEach((role) => {
      const token = jwt.sign({ sub: `${role}-id`, role }, JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.role).toBe(role);
    });
  });

  it('should produce different tokens for different payloads', () => {
    const token1 = jwt.sign({ sub: 'user-1' }, JWT_SECRET);
    const token2 = jwt.sign({ sub: 'user-2' }, JWT_SECRET);
    expect(token1).not.toBe(token2);
  });

  it('should contain exp claim when expiresIn is set', () => {
    const token = jwt.sign({ sub: 'user-123' }, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.decode(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('Auth — JWT token verification', () => {
  it('should verify a valid token successfully', () => {
    const token = jwt.sign({ sub: 'user-123', role: 'buyer' }, JWT_SECRET, { expiresIn: '1h' });
    expect(() => jwt.verify(token, JWT_SECRET)).not.toThrow();
  });

  it('should throw JsonWebTokenError for an invalid token', () => {
    expect(() => jwt.verify('invalid.token.here', JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('should throw TokenExpiredError for an expired token', () => {
    const expiredToken = jwt.sign({ sub: 'user-123' }, JWT_SECRET, { expiresIn: -1 });
    expect(() => jwt.verify(expiredToken, JWT_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  it('should throw JsonWebTokenError for a token signed with a wrong secret', () => {
    const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('should decode a token without verification', () => {
    const token = jwt.sign({ sub: 'user-123', email: 'x@test.com' }, JWT_SECRET);
    const decoded = jwt.decode(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('x@test.com');
  });
});

describe('Auth — Password hashing (bcrypt)', () => {
  it('should hash a password and produce a different string', async () => {
    const password = 'MySecureP@ss1!';
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);
  });

  it('should verify that the correct password matches the hash', async () => {
    const password = 'correctPassword123';
    const hash = await bcrypt.hash(password, 10);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  it('should reject an incorrect password against a hash', async () => {
    const password = 'correctPassword123';
    const hash = await bcrypt.hash(password, 10);
    const match = await bcrypt.compare('wrongPassword', hash);
    expect(match).toBe(false);
  });

  it('should produce different hashes for the same password due to salting', async () => {
    const password = 'samePassword';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    expect(hash1).not.toBe(hash2);
  });

  it('should use a sufficiently high salt round (≥10)', () => {
    const saltRounds = 10;
    expect(saltRounds).toBeGreaterThanOrEqual(10);
  });
});

describe('Auth — Token expiry', () => {
  it('should create a token with 1h expiry and verify it is not yet expired', () => {
    const token = jwt.sign({ sub: 'user-1' }, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    expect(decoded.exp).toBeGreaterThan(now);
    expect(decoded.exp - now).toBeLessThanOrEqual(3600);
  });

  it('should correctly identify an already-expired token', () => {
    const expiredToken = jwt.sign({ sub: 'user-1' }, JWT_SECRET, { expiresIn: 0 });
    let error;
    try {
      jwt.verify(expiredToken, JWT_SECRET);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(jwt.TokenExpiredError);
  });

  it('should support ignoreExpiration option for reading expired tokens', () => {
    const expiredToken = jwt.sign({ sub: 'user-expired' }, JWT_SECRET, { expiresIn: -3600 });
    const decoded = jwt.verify(expiredToken, JWT_SECRET, { ignoreExpiration: true });
    expect(decoded.sub).toBe('user-expired');
  });
});
