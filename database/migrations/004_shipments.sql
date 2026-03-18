-- ─────────────────────────────────────────────────────────────────
-- Migration 004: Shipments (Carry + Parcel)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id      UUID REFERENCES carrier_profiles(id),
  flight_number   TEXT NOT NULL,
  departure_date  DATE NOT NULL,
  arrival_date    DATE,
  origin          TEXT NOT NULL,
  destination     TEXT NOT NULL,
  weight_capacity NUMERIC(8,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','full','cancelled','completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carry_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id  UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_category  TEXT NOT NULL,
  weight_kg         NUMERIC(8,2) NOT NULL,
  payment_per_kg    NUMERIC(8,2) NOT NULL,
  total_payment     NUMERIC(10,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcels (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id           UUID NOT NULL REFERENCES auth.users(id),
  receiver_name       TEXT NOT NULL,
  receiver_phone      TEXT,
  receiver_address    TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  weight_kg           NUMERIC(8,2) NOT NULL,
  dimensions          JSONB,
  declared_value      NUMERIC(10,2) DEFAULT 0,
  product_type        TEXT,
  shipping_method     TEXT,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','received','processing','shipped','in_transit','customs','delivered')),
  tracking_number     TEXT UNIQUE NOT NULL,
  carrier_tracking    TEXT,
  total_cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  reference_number    TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_sender          ON parcels(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_number ON parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_parcels_status          ON parcels(status);

CREATE TABLE IF NOT EXISTS parcel_tracking_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  photos      TEXT[] DEFAULT '{}',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_events_parcel ON parcel_tracking_events(parcel_id);
