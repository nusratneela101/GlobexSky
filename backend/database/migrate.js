#!/usr/bin/env node
/**
 * backend/database/migrate.js — Run the schema.sql against Supabase.
 *
 * Usage (from the backend directory):
 *   npm run migrate
 *   node database/migrate.js
 *
 * Prerequisites:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
 *   2. Create the exec_sql helper in your Supabase SQL editor ONCE:
 *        CREATE OR REPLACE FUNCTION exec_sql(sql text)
 *          RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
 *        $$ BEGIN EXECUTE sql; END; $$;
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
 * Execute a SQL string via the exec_sql RPC function.
 * Splits on semicolons and runs each statement individually.
 */
async function executeSqlFile(filePath) {
  const sql = await readFile(filePath, 'utf-8');

  // Split into individual statements (crude but sufficient for DDL files).
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let executed = 0;
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) {
      // Log non-fatal "already exists" style errors and continue.
      if (error.message.includes('already exists')) {
        continue;
      }
      console.warn(`⚠️  Statement warning: ${error.message}`);
      console.warn(`   Statement: ${stmt.slice(0, 120)}…`);
    }
    executed++;
  }
  return executed;
}

async function main() {
  const schemaPath = join(__dirname, 'schema.sql');
  console.log('🚀  Running GlobexSky database migration…');
  console.log(`   Schema file: ${schemaPath}`);
  console.log(`   Target:      ${SUPABASE_URL}`);

  try {
    const count = await executeSqlFile(schemaPath);
    console.log(`✅  Migration complete — ${count} statement(s) executed.`);
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  }
}

main();
