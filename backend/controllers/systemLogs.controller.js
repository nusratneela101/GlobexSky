/**
 * Globex Sky — systemLogs.controller.js
 * Controller for system logs, audit trail, health dashboard,
 * performance metrics, and log export.
 */

import * as monitor from '../services/systemMonitor.service.js';

// ─── GET /api/v1/admin/logs/errors ───────────────────────────────────────────
export async function getErrorLogs(req, res, next) {
  try {
    const { level, search, date_from, date_to, page = 1, limit = 50 } = req.query;
    const result = monitor.getErrorLogs({
      level,
      search,
      dateFrom: date_from,
      dateTo:   date_to,
      page:     +page,
      limit:    Math.min(+limit, 200),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/admin/logs/activity ─────────────────────────────────────────
export async function getActivityLogs(req, res, next) {
  try {
    const { user_id, action, search, date_from, date_to, page = 1, limit = 50 } = req.query;
    const result = monitor.getActivityLogs({
      userId:   user_id,
      action,
      search,
      dateFrom: date_from,
      dateTo:   date_to,
      page:     +page,
      limit:    Math.min(+limit, 200),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/admin/logs/audit ────────────────────────────────────────────
export async function getAuditTrail(req, res, next) {
  try {
    const { entity, admin_id, search, date_from, date_to, page = 1, limit = 50 } = req.query;
    const result = monitor.getAuditTrail({
      entity,
      adminId:  admin_id,
      search,
      dateFrom: date_from,
      dateTo:   date_to,
      page:     +page,
      limit:    Math.min(+limit, 200),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/admin/system/health ─────────────────────────────────────────
export async function getSystemHealth(req, res, next) {
  try {
    const health = await monitor.getSystemHealth();
    const alerts = await monitor.checkAlertThresholds();
    res.json({ success: true, data: health, alerts });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/admin/system/performance ────────────────────────────────────
export async function getPerformanceMetrics(req, res, next) {
  try {
    const metrics = monitor.getPerformanceMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) { next(err); }
}

// ─── GET /api/v1/admin/logs/export ───────────────────────────────────────────
export async function exportLogs(req, res, next) {
  try {
    const { type = 'errors', format = 'json', date_from, date_to } = req.query;

    let data;
    switch (type) {
      case 'activity':
        data = monitor.getActivityLogs({ dateFrom: date_from, dateTo: date_to, limit: 10000 }).data;
        break;
      case 'audit':
        data = monitor.getAuditTrail({ dateFrom: date_from, dateTo: date_to, limit: 10000 }).data;
        break;
      default:
        data = monitor.getErrorLogs({ dateFrom: date_from, dateTo: date_to, limit: 10000 }).data;
    }

    const filename = `${type}_logs_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send('No data available\n');
      }
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row =>
        Object.values(row).map(v => {
          const s = v === null || v === undefined ? '' : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        }).join(','),
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(`${headers}\n${rows.join('\n')}`);
    }

    // JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.send(JSON.stringify({ exported_at: new Date().toISOString(), type, count: data.length, data }, null, 2));
  } catch (err) { next(err); }
}
