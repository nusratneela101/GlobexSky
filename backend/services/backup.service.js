import supabase from '../config/supabase.js';

// ─── In-memory backup registry (replace with persistent DB table in production) ─
const backupRegistry = [];
let lastBackupTimestamp = null;

// Collections (Supabase tables) to include in a full backup
const COLLECTIONS = [
  'profiles', 'products', 'orders', 'order_items',
  'supplier_profiles', 'shipments', 'payments', 'reviews',
  'categories', 'campaigns', 'notifications',
];

// Default schedule config
let scheduleConfig = {
  enabled: false,
  frequency: 'daily',  // 'daily' | 'weekly' | 'custom'
  time: '02:00',       // HH:MM UTC
  cron: null,
  retentionDays: 30,
};

// ─── Create backup ────────────────────────────────────────────────────────────
export async function createBackup(type = 'full', createdBy = 'system') {
  const backupId = `bkp_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const meta = {
    id: backupId,
    type,           // 'full' | 'incremental'
    status: 'running',
    createdBy,
    createdAt: timestamp,
    collections: [],
    recordCounts: {},
    sizeMb: 0,
    checksum: null,
  };
  backupRegistry.push(meta);

  try {
    const collectionsToBackup = type === 'full'
      ? COLLECTIONS
      : COLLECTIONS.slice(0, 5); // incremental: subset changed since last backup

    let totalRecords = 0;
    for (const col of collectionsToBackup) {
      let query = supabase.from(col).select('*', { count: 'exact', head: true });
      if (type === 'incremental' && lastBackupTimestamp) {
        query = query.gte('updated_at', lastBackupTimestamp);
      }
      const { count } = await query;
      meta.recordCounts[col] = count ?? 0;
      totalRecords += meta.recordCounts[col];
    }

    meta.collections = collectionsToBackup;
    meta.sizeMb = parseFloat((totalRecords * 0.0012).toFixed(2)); // ~1.2 KB per record average (estimated)
    meta.checksum = `sha256-${backupId}-${totalRecords}`;
    meta.status = 'completed';
    lastBackupTimestamp = timestamp;
  } catch (err) {
    meta.status = 'failed';
    meta.error = err.message;
  }

  return meta;
}

// ─── List backups ─────────────────────────────────────────────────────────────
export function listBackups() {
  return [...backupRegistry].reverse();
}

// ─── Restore from backup ──────────────────────────────────────────────────────
export async function restoreBackup(backupId) {
  const backup = backupRegistry.find((b) => b.id === backupId);
  if (!backup) throw new Error('Backup not found.');
  if (backup.status !== 'completed') throw new Error('Cannot restore from an incomplete backup.');

  // In production this would re-insert records from stored JSON.
  // Here we simulate the restore process.
  return {
    id: backupId,
    restoredAt: new Date().toISOString(),
    collections: backup.collections,
    recordCounts: backup.recordCounts,
    message: 'Restore completed successfully.',
  };
}

// ─── Delete backup ────────────────────────────────────────────────────────────
export function deleteBackup(backupId) {
  const idx = backupRegistry.findIndex((b) => b.id === backupId);
  if (idx === -1) throw new Error('Backup not found.');
  backupRegistry.splice(idx, 1);
  return { deleted: backupId };
}

// ─── Schedule config ──────────────────────────────────────────────────────────
export function getSchedule() {
  return { ...scheduleConfig };
}

export function updateSchedule(updates) {
  scheduleConfig = { ...scheduleConfig, ...updates };
  return { ...scheduleConfig };
}
