/**
 * Globex Sky — systemMonitor.service.js
 * Monitors server health, database connectivity, CPU/memory/disk usage,
 * tracks API response times, and provides log rotation utilities.
 */

import os from 'os';
import supabase from '../config/supabase.js';

// ─── In-memory stores ────────────────────────────────────────────────────────
const _apiTimings = [];       // { path, method, durationMs, statusCode, ts }
const _errorLog   = [];       // { id, level, component, message, stack, file, ts }
const _activityLog = [];      // { id, userId, userEmail, action, entity, entityId, ip, ts }
const _auditLog   = [];       // { id, adminId, adminEmail, action, entity, entityId, before, after, ts }
let   _startTime  = Date.now();
let   _errorIdSeq = 1;
let   _actIdSeq   = 1;
let   _auditIdSeq = 1;

const MAX_ENTRIES = 5000;     // cap in-memory list size

// ─── Public: record API timing ───────────────────────────────────────────────
export function recordApiTiming({ path, method, durationMs, statusCode }) {
  _apiTimings.push({ path, method, durationMs, statusCode, ts: new Date().toISOString() });
  if (_apiTimings.length > MAX_ENTRIES) _apiTimings.shift();
}

// ─── Public: record error ────────────────────────────────────────────────────
export function recordError({ level = 'error', component = 'app', message, stack, file }) {
  const entry = {
    id: _errorIdSeq++,
    level,
    component,
    message: message || 'Unknown error',
    stack: stack || null,
    file: file || null,
    ts: new Date().toISOString(),
  };
  _errorLog.push(entry);
  if (_errorLog.length > MAX_ENTRIES) _errorLog.shift();
  return entry;
}

// ─── Public: record activity ─────────────────────────────────────────────────
export function recordActivity({ userId, userEmail, action, entity, entityId, ip }) {
  const entry = {
    id: _actIdSeq++,
    userId: userId || null,
    userEmail: userEmail || 'system',
    action,
    entity: entity || null,
    entityId: entityId || null,
    ip: ip || null,
    ts: new Date().toISOString(),
  };
  _activityLog.push(entry);
  if (_activityLog.length > MAX_ENTRIES) _activityLog.shift();
  return entry;
}

// ─── Public: record audit ────────────────────────────────────────────────────
export function recordAudit({ adminId, adminEmail, action, entity, entityId, before, after }) {
  const entry = {
    id: _auditIdSeq++,
    adminId: adminId || null,
    adminEmail: adminEmail || 'system',
    action,
    entity: entity || null,
    entityId: entityId || null,
    before: before !== undefined ? before : null,
    after: after !== undefined ? after : null,
    ts: new Date().toISOString(),
  };
  _auditLog.push(entry);
  if (_auditLog.length > MAX_ENTRIES) _auditLog.shift();
  return entry;
}

// ─── Public: get error logs (filtered) ──────────────────────────────────────
export function getErrorLogs({ level, search, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  let logs = [..._errorLog].reverse();

  if (level && level !== 'all') logs = logs.filter(e => e.level === level);
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(e =>
      e.message.toLowerCase().includes(q) ||
      (e.component && e.component.toLowerCase().includes(q)) ||
      (e.file && e.file.toLowerCase().includes(q)),
    );
  }
  if (dateFrom) logs = logs.filter(e => e.ts >= dateFrom);
  if (dateTo)   logs = logs.filter(e => e.ts <= dateTo + 'T23:59:59Z');

  const total = logs.length;
  const offset = (page - 1) * limit;
  return { data: logs.slice(offset, offset + limit), total, page: +page, limit: +limit };
}

// ─── Public: get activity logs (filtered) ────────────────────────────────────
export function getActivityLogs({ userId, action, search, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  let logs = [..._activityLog].reverse();

  if (userId) logs = logs.filter(e => e.userId === userId);
  if (action) logs = logs.filter(e => e.action === action);
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(e =>
      (e.userEmail && e.userEmail.toLowerCase().includes(q)) ||
      (e.action && e.action.toLowerCase().includes(q)) ||
      (e.entity && e.entity.toLowerCase().includes(q)),
    );
  }
  if (dateFrom) logs = logs.filter(e => e.ts >= dateFrom);
  if (dateTo)   logs = logs.filter(e => e.ts <= dateTo + 'T23:59:59Z');

  const total = logs.length;
  const offset = (page - 1) * limit;
  return { data: logs.slice(offset, offset + limit), total, page: +page, limit: +limit };
}

// ─── Public: get audit trail (filtered) ─────────────────────────────────────
export function getAuditTrail({ entity, adminId, search, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  let logs = [..._auditLog].reverse();

  if (entity)  logs = logs.filter(e => e.entity === entity);
  if (adminId) logs = logs.filter(e => e.adminId === adminId);
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(e =>
      (e.adminEmail && e.adminEmail.toLowerCase().includes(q)) ||
      (e.action && e.action.toLowerCase().includes(q)) ||
      (e.entity && e.entity.toLowerCase().includes(q)),
    );
  }
  if (dateFrom) logs = logs.filter(e => e.ts >= dateFrom);
  if (dateTo)   logs = logs.filter(e => e.ts <= dateTo + 'T23:59:59Z');

  const total = logs.length;
  const offset = (page - 1) * limit;
  return { data: logs.slice(offset, offset + limit), total, page: +page, limit: +limit };
}

// ─── Public: get system health ───────────────────────────────────────────────
export async function getSystemHealth() {
  const memTotal  = os.totalmem();
  const memFree   = os.freemem();
  const memUsed   = memTotal - memFree;
  const memPct    = Math.round((memUsed / memTotal) * 100);

  const cpuAvg    = _getCpuUsage();
  const uptimeMs  = Date.now() - _startTime;
  const osUptime  = os.uptime(); // seconds

  // Database connectivity check
  let dbStatus = 'unknown';
  let dbLatencyMs = null;
  if (supabase) {
    try {
      const t0 = Date.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      dbLatencyMs = Date.now() - t0;
      dbStatus = error ? 'degraded' : 'online';
    } catch {
      dbStatus = 'offline';
    }
  }

  // Disk — approximate using process memory as a fallback
  const heapUsed  = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;
  const rss       = process.memoryUsage().rss;

  return {
    server: {
      status: 'online',
      os: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    cpu: {
      usagePct: cpuAvg,
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'N/A',
    },
    memory: {
      totalMb: Math.round(memTotal / 1024 / 1024),
      usedMb:  Math.round(memUsed  / 1024 / 1024),
      freeMb:  Math.round(memFree  / 1024 / 1024),
      usagePct: memPct,
    },
    heap: {
      usedMb:  Math.round(heapUsed  / 1024 / 1024),
      totalMb: Math.round(heapTotal / 1024 / 1024),
      rssMb:   Math.round(rss       / 1024 / 1024),
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    uptime: {
      appMs:  uptimeMs,
      osSeconds: Math.round(osUptime),
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };
}

// ─── Public: get performance metrics ────────────────────────────────────────
export function getPerformanceMetrics() {
  const timings = [..._apiTimings];

  if (timings.length === 0) {
    return { avgResponseMs: 0, p95Ms: 0, slowQueries: [], routeStats: [], recentTimings: [] };
  }

  const durations = timings.map(t => t.durationMs).sort((a, b) => a - b);
  const avg = Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;

  // Per-route stats
  const byRoute = {};
  for (const t of timings) {
    const key = `${t.method} ${t.path}`;
    if (!byRoute[key]) byRoute[key] = { method: t.method, path: t.path, count: 0, totalMs: 0, maxMs: 0 };
    byRoute[key].count++;
    byRoute[key].totalMs += t.durationMs;
    byRoute[key].maxMs = Math.max(byRoute[key].maxMs, t.durationMs);
  }
  const routeStats = Object.values(byRoute)
    .map(r => ({ ...r, avgMs: Math.round(r.totalMs / r.count) }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 20);

  // Slow queries > 1 second
  const slowQueries = timings
    .filter(t => t.durationMs >= 1000)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 50);

  // Last 50 timings for chart
  const recentTimings = timings.slice(-50);

  return { avgResponseMs: avg, p95Ms: p95, slowQueries, routeStats, recentTimings };
}

// ─── Public: log rotation (clear old entries) ────────────────────────────────
export function rotateLogs(olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  const before = { errors: _errorLog.length, activity: _activityLog.length, audit: _auditLog.length };

  const prune = (arr) => {
    let i = 0;
    while (i < arr.length && arr[i].ts < cutoff) i++;
    arr.splice(0, i);
  };

  prune(_errorLog);
  prune(_activityLog);
  prune(_auditLog);

  return {
    before,
    after: { errors: _errorLog.length, activity: _activityLog.length, audit: _auditLog.length },
    cutoff,
  };
}

// ─── Public: check alert thresholds ─────────────────────────────────────────
export async function checkAlertThresholds() {
  const health = await getSystemHealth();
  const alerts = [];

  if (health.memory.usagePct > 90) {
    alerts.push({ level: 'critical', metric: 'memory', value: health.memory.usagePct, threshold: 90, message: `Memory usage at ${health.memory.usagePct}%` });
  } else if (health.memory.usagePct > 75) {
    alerts.push({ level: 'warning', metric: 'memory', value: health.memory.usagePct, threshold: 75, message: `Memory usage at ${health.memory.usagePct}%` });
  }

  if (health.cpu.usagePct > 85) {
    alerts.push({ level: 'critical', metric: 'cpu', value: health.cpu.usagePct, threshold: 85, message: `CPU usage at ${health.cpu.usagePct}%` });
  }

  if (health.database.status !== 'online') {
    alerts.push({ level: 'critical', metric: 'database', value: health.database.status, message: `Database is ${health.database.status}` });
  }

  return alerts;
}

// ─── Internal: CPU usage estimate ───────────────────────────────────────────
function _getCpuUsage() {
  try {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const cpu of cpus) {
      for (const type of Object.values(cpu.times)) total += type;
      idle += cpu.times.idle;
    }
    const usagePct = Math.round(100 - (idle / total) * 100);
    return Math.max(0, Math.min(100, usagePct));
  } catch {
    return 0;
  }
}
