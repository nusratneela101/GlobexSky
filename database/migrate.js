#!/usr/bin/env node
/**
 * database/migrate.js — Migration runner
 *
 * Usage (run from repo root):
 *   node database/migrate.js           # run all pending UP migrations
 *   node database/migrate.js --down 005_create_shipments  # roll back a specific migration
 *   node database/migrate.js --list    # list applied migrations
 *   node database/migrate.js --sql database/migrations/002_additional_tables.sql  # run a SQL file
 *
 * Prerequisites:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env (or env vars).
 *   2. Create the exec_sql helper in your Supabase SQL editor once:
 *        CREATE OR REPLACE FUNCTION exec_sql(sql text)
 *          RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
 *        $$ BEGIN EXECUTE sql; END; $$;
 *   3. Install @supabase/supabase-js and dotenv in the backend:
 *        cd backend && npm install
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';

// ─── Bootstrap env ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load backend/.env (fall back to root .env)
config({ path: resolve(__dirname, '../backend/.env') });
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Copy backend/.env.example → backend/.env and fill in the values.');
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── SQL executor via exec_sql RPC ────────────────────────────────────────────
/**
 * Execute raw SQL via the `exec_sql` Supabase RPC function.
 * The function must exist in your database:
 *   CREATE OR REPLACE FUNCTION exec_sql(sql text)
 *     RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
 *   $$ BEGIN EXECUTE sql; END; $$;
 */
async function executeSql(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql: sql.trim() });
  if (error) {
    throw new Error(
      `SQL execution failed: ${error.message}\n` +
      `  Hint: Make sure exec_sql function exists in your Supabase project.\n` +
      `  SQL: ${sql.slice(0, 120).replace(/\n/g, ' ')}...`
    );
  }
}

// ─── Migration tracking table ─────────────────────────────────────────────────
async function ensureMigrationsTable() {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('id');

  if (error) throw new Error(`Cannot read _migrations table: ${error.message}`);
  return new Set((data || []).map((r) => r.name));
}

async function recordMigration(name) {
  const { error } = await supabase.from('_migrations').insert({ name });
  if (error) throw new Error(`Cannot record migration ${name}: ${error.message}`);
}

async function deleteMigration(name) {
  const { error } = await supabase.from('_migrations').delete().eq('name', name);
  if (error) throw new Error(`Cannot delete migration record ${name}: ${error.message}`);
}

// ─── Migration file discovery ─────────────────────────────────────────────────
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function getMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => /^\d{3}_.*\.js$/.test(f))
    .sort();
}

/**
 * Execute a raw SQL migration file by splitting on statement boundaries.
 *
 * Limitations:
 *   - Only single-line comments (-- ...) are stripped before splitting.
 *     Block comments (/* ... *\/) inside statements are passed through as-is.
 *   - Semicolons inside string literals or $$ dollar-quoted blocks are not
 *     handled by this splitter. Migration SQL files should use simple DDL
 *     (CREATE TABLE, CREATE INDEX, ALTER TABLE, CREATE POLICY) which does
 *     not embed semicolons in string values.
 */
async function executeSqlFile(filePath) {
  const sql = await readFile(filePath, 'utf8');
  // Strip single-line comments (-- ...) before splitting
  const stripped = sql.replace(/--[^\n]*/g, '');
  // Split on semicolons followed by optional whitespace
  const statements = stripped
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await executeSql(stmt);
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
async function runUp() {
  console.log('🔄  Running pending migrations…\n');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files   = await getMigrationFiles();
  const pending  = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅  No pending migrations — database is up to date.');
    return;
  }

  for (const file of pending) {
    try {
      if (file.endsWith('.sql')) {
        process.stdout.write(`  ▶  ${file} … `);
        await executeSqlFile(join(MIGRATIONS_DIR, file));
      } else {
        const { up } = await import(pathToFileURL(join(MIGRATIONS_DIR, file)).href);
        if (typeof up !== 'function') {
          console.warn(`  ⚠  ${file} has no up() export — skipping.`);
          continue;
        }
        process.stdout.write(`  ▶  ${file} … `);
        await up(executeSql);
      }
      await recordMigration(file);
      console.log('✔');
    } catch (err) {
      console.log('✗');
      console.error(`\n❌  Migration failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n✅  Applied ${pending.length} migration(s).`);
}

async function runDown(target) {
  console.log(`🔄  Rolling back migration: ${target}\n`);

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files   = await getMigrationFiles();

  // Find the target file (exact name or prefix match)
  const file = files.find((f) => f === target || f.startsWith(target));
  if (!file) {
    console.error(`❌  Migration not found: ${target}`);
    process.exit(1);
  }

  if (!applied.has(file)) {
    console.warn(`⚠  Migration ${file} has not been applied — nothing to roll back.`);
    return;
  }

  if (file.endsWith('.sql')) {
    console.warn(`⚠  SQL migrations do not support automatic rollback. Manually reverse ${file} if needed.`);
    return;
  }

  const { down } = await import(pathToFileURL(join(MIGRATIONS_DIR, file)).href);
  if (typeof down !== 'function') {
    console.error(`❌  ${file} has no down() export.`);
    process.exit(1);
  }

  process.stdout.write(`  ▶  ${file} (down) … `);
  try {
    await down(executeSql);
    await deleteMigration(file);
    console.log('✔');
  } catch (err) {
    console.log('✗');
    console.error(`\n❌  Rollback failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\n✅  Rollback complete.');
}

async function listMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files   = await getMigrationFiles();

  console.log('\nMigration Status\n' + '─'.repeat(60));
  for (const file of files) {
    const status = applied.has(file) ? '✔ applied' : '○ pending';
    console.log(`  ${status}  ${file}`);
  }
  console.log('─'.repeat(60));
  console.log(`  ${applied.size} applied, ${files.length - applied.size} pending\n`);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--list')) {
  listMigrations().catch((err) => { console.error(err.message); process.exit(1); });
} else if (args.includes('--down')) {
  const idx    = args.indexOf('--down');
  const target = args[idx + 1];
  if (!target) {
    console.error('❌  Usage: node database/migrate.js --down <migration_name>');
    process.exit(1);
  }
  runDown(target).catch((err) => { console.error(err.message); process.exit(1); });
} else if (args.includes('--sql')) {
  // Run a standalone SQL file (e.g. a reference migration like 002_additional_tables.sql)
  const idx  = args.indexOf('--sql');
  const file = args[idx + 1];
  if (!file) {
    console.error('❌  Usage: node database/migrate.js --sql <path/to/file.sql>');
    process.exit(1);
  }
  const filePath = resolve(__dirname, file);
  console.log(`🔄  Executing SQL file: ${filePath}\n`);
  executeSqlFile(filePath)
    .then(() => console.log('✅  SQL file executed successfully.'))
    .catch((err) => { console.error(`❌  ${err.message}`); process.exit(1); });
} else {
  runUp().catch((err) => { console.error(err.message); process.exit(1); });
}
