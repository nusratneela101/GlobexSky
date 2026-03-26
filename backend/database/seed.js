#!/usr/bin/env node
/**
 * backend/database/seed.js — Run seed.sql against Supabase.
 *
 * Usage (from the backend directory):
 *   npm run seed
 *   node database/seed.js
 *
 * Prerequisites:
 *   1. Run `npm run migrate` first to create all tables.
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from backend/
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Copy backend/.env.example → backend/.env and fill in the values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Execute each SQL statement in the seed file.
 */
async function executeSeedFile(filePath) {
  const sql = await readFile(filePath, 'utf-8');

  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let executed = 0;
  let skipped  = 0;
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) {
      if (
        error.message.includes('duplicate key') ||
        error.message.includes('already exists') ||
        error.message.includes('ON CONFLICT')
      ) {
        skipped++;
        continue;
      }
      console.warn(`⚠️  Seed warning: ${error.message}`);
      console.warn(`   Statement: ${stmt.slice(0, 120)}…`);
    } else {
      executed++;
    }
  }
  return { executed, skipped };
}

async function main() {
  const seedPath = join(__dirname, 'seed.sql');
  console.log('🌱  Running GlobexSky database seed…');
  console.log(`   Seed file: ${seedPath}`);
  console.log(`   Target:    ${SUPABASE_URL}`);

  try {
    const { executed, skipped } = await executeSeedFile(seedPath);
    console.log(`✅  Seed complete — ${executed} insert(s) applied, ${skipped} skipped (conflict).`);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
}

main();
