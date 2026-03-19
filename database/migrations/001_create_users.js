/**
 * Migration 001: Users & Auth tables
 * Tables: profiles, addresses, supplier_profiles, carrier_profiles
 */

export async function up(executeSql) {
  await executeSql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS profiles (
      id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name           TEXT,
      avatar_url          TEXT,
      phone               TEXT,
      company_name        TEXT,
      role                TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','buyer','supplier','carrier','inspector')),
      verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified')),
      language            TEXT NOT NULL DEFAULT 'en',
      currency            TEXT NOT NULL DEFAULT 'USD',
      timezone            TEXT NOT NULL DEFAULT 'UTC',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_profiles_role    ON profiles(role);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS addresses (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      label       TEXT DEFAULT 'Home',
      street      TEXT NOT NULL,
      city        TEXT NOT NULL,
      state       TEXT,
      country     TEXT NOT NULL,
      postal_code TEXT,
      is_default  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);`);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS supplier_profiles (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id          UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      company_name     TEXT NOT NULL,
      business_type    TEXT,
      country          TEXT,
      verified         BOOLEAN NOT NULL DEFAULT FALSE,
      rating           NUMERIC(3,2) DEFAULT 0,
      response_rate    NUMERIC(5,2) DEFAULT 0,
      on_time_delivery NUMERIC(5,2) DEFAULT 0,
      membership_tier  TEXT DEFAULT 'basic',
      commission_rate  NUMERIC(5,2) DEFAULT 5.00,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS carrier_profiles (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id           UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      passport_number   TEXT,
      passport_verified BOOLEAN NOT NULL DEFAULT FALSE,
      facial_verified   BOOLEAN NOT NULL DEFAULT FALSE,
      total_trips       INTEGER NOT NULL DEFAULT 0,
      total_earnings    NUMERIC(12,2) NOT NULL DEFAULT 0,
      success_rate      NUMERIC(5,2) DEFAULT 0,
      rating            NUMERIC(3,2) DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS carrier_profiles;`);
  await executeSql(`DROP TABLE IF EXISTS supplier_profiles;`);
  await executeSql(`DROP TABLE IF EXISTS addresses;`);
  await executeSql(`DROP TABLE IF EXISTS profiles;`);
}
