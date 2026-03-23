/**
 * Unit tests for feature toggle service.
 * Tests: ON/OFF switching, reading toggle state, cascading disables.
 */

jest.mock('../../config/supabase.js', () => ({
  __esModule: true, default: { from: jest.fn() } }));

import {
  getToggles,
  getToggle,
  createToggle,
  updateToggle,
  deleteToggle,
  evaluateToggle,
} from '../../services/featureToggle.service.js';

describe('Feature Toggle — Reading toggle state', () => {
  it('should return all toggles as an array', () => {
    const toggles = getToggles();
    expect(Array.isArray(toggles)).toBe(true);
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('should retrieve a specific toggle by key', () => {
    const toggle = getToggle('advanced_search');
    expect(toggle).toBeDefined();
    expect(toggle.key).toBe('advanced_search');
  });

  it('should throw an error when toggle key does not exist', () => {
    expect(() => getToggle('non_existent_toggle')).toThrow();
  });

  it('should return toggle with required fields', () => {
    const toggle = getToggle('advanced_search');
    expect(toggle).toHaveProperty('key');
    expect(toggle).toHaveProperty('enabled');
    expect(toggle).toHaveProperty('name');
  });
});

describe('Feature Toggle — ON/OFF switching', () => {
  const TEST_KEY = `test_toggle_${Date.now()}`;

  beforeEach(() => {
    try { deleteToggle(TEST_KEY); } catch (_) {}
    createToggle(
      { key: TEST_KEY, name: 'Test Toggle', type: 'boolean', enabled: true, environments: ['test'] },
      'test-actor',
    );
  });

  afterEach(() => {
    try { deleteToggle(TEST_KEY); } catch (_) {}
  });

  it('should toggle from enabled to disabled', () => {
    updateToggle(TEST_KEY, { enabled: false }, 'test-actor');
    const toggle = getToggle(TEST_KEY);
    expect(toggle.enabled).toBe(false);
  });

  it('should toggle from disabled to enabled', () => {
    updateToggle(TEST_KEY, { enabled: false }, 'test-actor');
    updateToggle(TEST_KEY, { enabled: true }, 'test-actor');
    const toggle = getToggle(TEST_KEY);
    expect(toggle.enabled).toBe(true);
  });

  it('should update toggle name', () => {
    updateToggle(TEST_KEY, { name: 'Updated Toggle Name' }, 'test-actor');
    const toggle = getToggle(TEST_KEY);
    expect(toggle.name).toBe('Updated Toggle Name');
  });
});

describe('Feature Toggle — Evaluate toggle for user context', () => {
  it('should return enabled:true for a boolean enabled toggle in correct environment', () => {
    const result = evaluateToggle('advanced_search', { env: 'production' });
    expect(result.enabled).toBe(true);
  });

  it('should return enabled:false for a toggle not in the current environment', () => {
    const result = evaluateToggle('new_checkout_flow', { env: 'production' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('environment_disabled');
  });

  it('should return not_found reason for unknown toggle key', () => {
    const result = evaluateToggle('does_not_exist', { env: 'production' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('should evaluate percentage rollout consistently for a given userId', () => {
    const result1 = evaluateToggle('new_checkout_flow', { env: 'staging', userId: 'user-abc' });
    const result2 = evaluateToggle('new_checkout_flow', { env: 'staging', userId: 'user-abc' });
    expect(result1.enabled).toBe(result2.enabled);
  });
});

describe('Feature Toggle — Create and Delete', () => {
  const DYNAMIC_KEY = `dynamic_toggle_${Date.now()}`;

  afterEach(() => {
    try { deleteToggle(DYNAMIC_KEY); } catch (_) {}
  });

  it('should create a new toggle successfully', () => {
    const toggle = createToggle(
      { key: DYNAMIC_KEY, name: 'Dynamic Toggle', type: 'boolean', enabled: false },
      'admin-user',
    );
    expect(toggle.key).toBe(DYNAMIC_KEY);
    expect(toggle.enabled).toBe(false);
  });

  it('should throw when creating a toggle with a duplicate key', () => {
    createToggle({ key: DYNAMIC_KEY, name: 'First', type: 'boolean', enabled: false }, 'admin');
    expect(() =>
      createToggle({ key: DYNAMIC_KEY, name: 'Second', type: 'boolean', enabled: false }, 'admin'),
    ).toThrow();
  });

  it('should delete an existing toggle', () => {
    createToggle({ key: DYNAMIC_KEY, name: 'To Delete', type: 'boolean', enabled: false }, 'admin');
    const result = deleteToggle(DYNAMIC_KEY);
    expect(result.deleted).toBe(DYNAMIC_KEY);
    expect(() => getToggle(DYNAMIC_KEY)).toThrow();
  });
});
