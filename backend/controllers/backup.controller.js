import * as service from '../services/backup.service.js';

/** POST /api/v1/backup */
export async function createBackup(req, res, next) {
  try {
    const { type = 'full' } = req.body;
    if (!['full', 'incremental'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be "full" or "incremental".' });
    }
    const backup = await service.createBackup(type, req.user?.id);
    res.status(201).json({ success: true, data: backup });
  } catch (err) { next(err); }
}

/** GET /api/v1/backup */
export async function listBackups(req, res, next) {
  try {
    const backups = service.listBackups();
    res.json({ success: true, data: backups });
  } catch (err) { next(err); }
}

/** POST /api/v1/backup/:id/restore */
export async function restoreBackup(req, res, next) {
  try {
    const result = await service.restoreBackup(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Backup not found.') return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

/** DELETE /api/v1/backup/:id */
export async function deleteBackup(req, res, next) {
  try {
    const result = service.deleteBackup(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Backup not found.') return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

/** GET /api/v1/backup/schedule */
export async function getBackupSchedule(req, res, next) {
  try {
    res.json({ success: true, data: service.getSchedule() });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/backup/schedule */
export async function updateBackupSchedule(req, res, next) {
  try {
    const updated = service.updateSchedule(req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}
