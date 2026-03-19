#!/usr/bin/env node
/**
 * database/seed.js — Seed runner
 *
 * Usage (run from repo root):
 *   node database/seed.js                        # run all seed files in order
 *   node database/seed.js --file 001_seed_users  # run a single seed file
 *
 * Prerequisites:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env (or env vars).
 *   2. Run migrations first: node database/migrate.js
 *   3. Install @supabase/supabase-js and dotenv in the backend:
 *        cd backend && npm install
 */

import { createClient } from '@supabase/supabase-js';
import { readdir } from 'fs/promises';
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

// ─── Seed file discovery ──────────────────────────────────────────────────────
const SEEDS_DIR = join(__dirname, 'seeds');

async function getSeedFiles() {
  const files = await readdir(SEEDS_DIR);
  return files
    .filter((f) => /^\d{3}_seed_.*\.js$/.test(f))
    .sort();
}

// ─── Run all seeds ────────────────────────────────────────────────────────────
async function runAllSeeds() {
  console.log('🌱  Running all seed files…\n');

  const files = await getSeedFiles();

  if (files.length === 0) {
    console.log('⚠   No seed files found in database/seeds/');
    return;
  }

  for (const file of files) {
    await runSeedFile(file);
  }

  console.log(`\n✅  Seeding complete — ${files.length} file(s) processed.`);
}

// ─── Run a single seed file ───────────────────────────────────────────────────
async function runSeedFile(file) {
  // Allow matching without the .js extension or full filename prefix
  const files = await getSeedFiles();
  const target = files.find(
    (f) => f === file || f === `${file}.js` || f.startsWith(file)
  );

  if (!target) {
    console.error(`❌  Seed file not found: ${file}`);
    process.exit(1);
  }

  const { run } = await import(pathToFileURL(join(SEEDS_DIR, target)).href);

  if (typeof run !== 'function') {
    console.warn(`  ⚠  ${target} has no run() export — skipping.`);
    return;
  }

  process.stdout.write(`  ▶  ${target} … `);
  try {
    await run(supabase);
    // run() is expected to log its own success message with indentation
  } catch (err) {
    console.log('\n  ✗');
    console.error(`\n❌  Seed failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--file')) {
  const idx  = args.indexOf('--file');
  const name = args[idx + 1];
  if (!name) {
    console.error('❌  Usage: node database/seed.js --file <seed_name>');
    process.exit(1);
  }
  runSeedFile(name).then(() => {
    console.log('\n✅  Seed complete.');
  }).catch((err) => { console.error(err.message); process.exit(1); });
} else {
  runAllSeeds().catch((err) => { console.error(err.message); process.exit(1); });
}
