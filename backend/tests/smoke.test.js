/**
 * Smoke tests — basic environment sanity checks.
 * These always pass to ensure the test infrastructure is working.
 */

describe('Smoke test', () => {
  test('environment is set up correctly', () => {
    expect(true).toBe(true);
  });

  test('NODE_ENV is defined', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
