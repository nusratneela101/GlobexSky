import crypto from 'crypto';

// ─── In-memory toggle store (replace with DB in production) ──────────────────
const toggleStore = new Map([
  ['advanced_search', {
    key: 'advanced_search', name: 'Advanced Search', type: 'boolean',
    enabled: true, environments: ['development', 'staging', 'production'],
    rolloutPercentage: 100, allowedUsers: [], createdAt: new Date().toISOString(),
    auditLog: [],
  }],
  ['currency_conversion', {
    key: 'currency_conversion', name: 'Real-time Currency Conversion', type: 'boolean',
    enabled: true, environments: ['development', 'staging', 'production'],
    rolloutPercentage: 100, allowedUsers: [], createdAt: new Date().toISOString(),
    auditLog: [],
  }],
  ['new_checkout_flow', {
    key: 'new_checkout_flow', name: 'New Checkout Flow', type: 'percentage',
    enabled: true, environments: ['staging'],
    rolloutPercentage: 25, allowedUsers: [], createdAt: new Date().toISOString(),
    auditLog: [],
  }],
]);

// ─── Get all toggles ──────────────────────────────────────────────────────────
export function getToggles() {
  return Array.from(toggleStore.values()).map(_sanitize);
}

// ─── Get single toggle ────────────────────────────────────────────────────────
export function getToggle(key) {
  const toggle = toggleStore.get(key);
  if (!toggle) throw new Error(`Feature toggle '${key}' not found.`);
  return _sanitize(toggle);
}

// ─── Create toggle ────────────────────────────────────────────────────────────
export function createToggle(data, actorId) {
  if (toggleStore.has(data.key)) throw new Error(`Toggle with key '${data.key}' already exists.`);
  const toggle = {
    key: data.key,
    name: data.name || data.key,
    type: data.type || 'boolean',
    enabled: data.enabled ?? false,
    environments: data.environments || ['development'],
    rolloutPercentage: data.rolloutPercentage ?? 100,
    allowedUsers: data.allowedUsers || [],
    createdAt: new Date().toISOString(),
    auditLog: [{ action: 'created', actorId, at: new Date().toISOString() }],
  };
  toggleStore.set(toggle.key, toggle);
  return _sanitize(toggle);
}

// ─── Update toggle ────────────────────────────────────────────────────────────
export function updateToggle(key, updates, actorId) {
  const toggle = toggleStore.get(key);
  if (!toggle) throw new Error(`Feature toggle '${key}' not found.`);

  const updatable = ['name', 'enabled', 'environments', 'rolloutPercentage', 'allowedUsers', 'type'];
  for (const field of updatable) {
    if (updates[field] !== undefined) toggle[field] = updates[field];
  }
  toggle.auditLog.push({ action: 'updated', changes: updates, actorId, at: new Date().toISOString() });
  return _sanitize(toggle);
}

// ─── Delete toggle ────────────────────────────────────────────────────────────
export function deleteToggle(key) {
  if (!toggleStore.has(key)) throw new Error(`Feature toggle '${key}' not found.`);
  toggleStore.delete(key);
  return { deleted: key };
}

// ─── Evaluate toggle for user context ────────────────────────────────────────
export function evaluateToggle(key, context = {}) {
  const toggle = toggleStore.get(key);
  if (!toggle) return { key, enabled: false, reason: 'not_found' };

  const env = context.env || process.env.NODE_ENV || 'development';

  // Check environment
  if (!toggle.environments.includes(env)) {
    return { key, enabled: false, reason: 'environment_disabled' };
  }

  // Boolean — directly on/off
  if (toggle.type === 'boolean') {
    return { key, enabled: toggle.enabled, reason: toggle.enabled ? 'enabled' : 'disabled' };
  }

  // User list — check if user is in list
  if (toggle.type === 'user_list') {
    const userId = context.userId;
    const enabled = userId && toggle.allowedUsers.includes(userId);
    return { key, enabled: !!enabled, reason: enabled ? 'user_allowed' : 'user_not_in_list' };
  }

  // Percentage rollout — consistent hashing
  if (toggle.type === 'percentage') {
    if (!toggle.enabled) return { key, enabled: false, reason: 'disabled' };
    const userId = context.userId || 'anonymous';
    const hash = crypto.createHash('sha256').update(`${key}:${userId}`).digest('hex');
    const bucket = (parseInt(hash.slice(0, 8), 16) % 100);
    const enabled = bucket < toggle.rolloutPercentage;
    return { key, enabled, reason: enabled ? 'in_rollout' : 'outside_rollout', bucket };
  }

  return { key, enabled: toggle.enabled, reason: 'default' };
}

// ─── Private: strip audit log from public output ──────────────────────────────
function _sanitize(toggle) {
  const { auditLog, ...rest } = toggle;
  return { ...rest, auditLogCount: auditLog.length };
}

// ─── Get audit log for a toggle (admin only) ──────────────────────────────────
export function getToggleAuditLog(key) {
  const toggle = toggleStore.get(key);
  if (!toggle) throw new Error(`Feature toggle '${key}' not found.`);
  return toggle.auditLog;
}
