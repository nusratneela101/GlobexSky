-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Additional Tables
-- Pure SQL reference — executed via 016_additional_tables.js
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shipping & Logistics ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carry_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  weight           NUMERIC(8,2) NOT NULL,
  unit_value       NUMERIC(12,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_products_request ON carry_products(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_products_product ON carry_products(product_id);

CREATE TABLE IF NOT EXISTS carry_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  delivery_status  TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending','in_transit','out_for_delivery','delivered','failed','returned'
  )),
  qr_code          TEXT,
  photos           TEXT[] DEFAULT '{}',
  signature        TEXT,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request ON carry_deliveries(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_deliveries_status  ON carry_deliveries(delivery_status);

CREATE TABLE IF NOT EXISTS parcel_shipments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id             UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  receiver_name         TEXT NOT NULL,
  receiver_phone        TEXT,
  receiver_email        TEXT,
  receiver_address      TEXT NOT NULL,
  receiver_city         TEXT,
  receiver_country      CHAR(2) NOT NULL,
  package_description   TEXT,
  weight                NUMERIC(8,2) NOT NULL,
  length_cm             NUMERIC(8,2),
  width_cm              NUMERIC(8,2),
  height_cm             NUMERIC(8,2),
  declared_value        NUMERIC(12,2),
  reference_number      TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','picked_up','in_transit','customs','delivered','returned','cancelled'
  )),
  shipping_fee          NUMERIC(12,2),
  insurance_fee         NUMERIC(12,2) DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_shipments_sender ON parcel_shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_status ON parcel_shipments(status);
CREATE INDEX IF NOT EXISTS idx_parcel_shipments_ref    ON parcel_shipments(reference_number);

CREATE TABLE IF NOT EXISTS carrier_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  carry_request_id UUID REFERENCES carry_requests(id) ON DELETE SET NULL,
  amount           NUMERIC(12,2) NOT NULL,
  bonus            NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(12,2) GENERATED ALWAYS AS (amount + bonus - platform_fee) STORED,
  payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending','processing','paid','failed','cancelled'
  )),
  payment_method    TEXT,
  payment_reference TEXT,
  notes             TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_payments_carrier ON carrier_payments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_payments_status  ON carrier_payments(payment_status);

-- ── AI & Analytics ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  algorithm   TEXT NOT NULL DEFAULT 'collaborative_filtering',
  score       NUMERIC(5,4),
  context     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user    ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires ON ai_recommendations(expires_at);

CREATE TABLE IF NOT EXISTS fraud_checks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  risk_score     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  flags          JSONB DEFAULT '[]',
  decision       TEXT NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow','review','block')),
  reviewed_by    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_checks_transaction ON fraud_checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_user        ON fraud_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_decision    ON fraud_checks(decision);

CREATE TABLE IF NOT EXISTS search_analytics (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query              TEXT NOT NULL,
  user_id            UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  filters_applied    JSONB DEFAULT '{}',
  session_id         TEXT,
  ip_address         INET,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user  ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_ts    ON search_analytics(timestamp);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  session_id     TEXT NOT NULL,
  messages_json  JSONB NOT NULL DEFAULT '[]',
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  escalated      BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_to   UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  language       TEXT NOT NULL DEFAULT 'en',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_convos_user    ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_convos_session ON chatbot_conversations(session_id);

CREATE TABLE IF NOT EXISTS chatbot_training_data (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT,
  language   TEXT NOT NULL DEFAULT 'en',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  priority   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_training_category ON chatbot_training_data(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_training_language ON chatbot_training_data(language);

-- ── Trade & Finance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_finance_applications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  supplier_id   UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('letter_of_credit','bank_guarantee','trade_insurance','factoring')),
  amount        NUMERIC(15,2) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','under_review','approved','rejected','active','expired'
  )),
  documents     JSONB DEFAULT '[]',
  notes         TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_finance_buyer    ON trade_finance_applications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_supplier ON trade_finance_applications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_trade_finance_status   ON trade_finance_applications(status);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  supplier_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  amount       NUMERIC(15,2) NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  status       TEXT NOT NULL DEFAULT 'holding' CHECK (status IN (
    'holding','released','refunded','disputed','cancelled'
  )),
  milestone    TEXT,
  held_at      TIMESTAMPTZ,
  released_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_order  ON escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer  ON escrow_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_transactions(status);

CREATE TABLE IF NOT EXISTS currency_rates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  rate          NUMERIC(18,8) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'system',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_currency_rates_pair    ON currency_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_updated ON currency_rates(updated_at);

-- ── Advertising & Campaigns ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advertisements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('banner','sidebar','featured','popup','email')),
  position    TEXT,
  title       TEXT,
  image_url   TEXT,
  link_url    TEXT,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','active','paused','expired','rejected'
  )),
  clicks      BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_supplier ON advertisements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_status   ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_dates    ON advertisements(start_date, end_date);

CREATE TABLE IF NOT EXISTS sponsored_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  cpc_bid      NUMERIC(10,4) NOT NULL DEFAULT 0,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent        NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  impressions  BIGINT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','exhausted','cancelled')),
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_products_product ON sponsored_products(product_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_products_status  ON sponsored_products(status);

CREATE TABLE IF NOT EXISTS flash_sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  description      TEXT,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  product_ids      UUID[] DEFAULT '{}',
  quantity_limit   INTEGER,
  banner_url       TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','active','ended','cancelled'
  )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_times  ON flash_sales(start_time, end_time);

CREATE TABLE IF NOT EXISTS flash_sale_products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id  UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_price NUMERIC(12,2) NOT NULL,
  sale_price     NUMERIC(12,2) NOT NULL,
  quantity_limit INTEGER,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale    ON flash_sale_products(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_product ON flash_sale_products(product_id);

-- ── Membership & Loyalty ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  points           BIGINT NOT NULL DEFAULT 0,
  tier             TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  lifetime_points  BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','adjust','bonus')),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_txns_user  ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_order ON loyalty_transactions(order_id);

CREATE TABLE IF NOT EXISTS supplier_memberships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  tier          TEXT NOT NULL CHECK (tier IN ('basic','standard','pro','enterprise')),
  start_date    TIMESTAMPTZ NOT NULL,
  end_date      TIMESTAMPTZ NOT NULL,
  price         NUMERIC(12,2) NOT NULL,
  features_json JSONB DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  auto_renew    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_memberships_supplier ON supplier_memberships(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_memberships_active   ON supplier_memberships(is_active);

-- ── Communication ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id              UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  last_message_at       TIMESTAMPTZ,
  unread_count_buyer    INTEGER NOT NULL DEFAULT 0,
  unread_count_supplier INTEGER NOT NULL DEFAULT 0,
  is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer    ON chat_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_supplier ON chat_rooms(supplier_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg ON chat_rooms(last_message_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  message         TEXT,
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','file','audio','video','system')),
  file_url        TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  read_at         TIMESTAMPTZ,
  translated_text JSONB DEFAULT '{}',
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room    ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender  ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS video_meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  title           TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','ongoing','completed','cancelled','no_show'
  )),
  meeting_url     TEXT,
  recording_url   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_meetings_organizer ON video_meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_scheduled ON video_meetings(scheduled_at);

-- ── Inspection ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspectors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  name            TEXT NOT NULL,
  location        TEXT,
  country         CHAR(2),
  specialization  TEXT[] DEFAULT '{}',
  certification   TEXT,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspectors_user    ON inspectors(user_id);
CREATE INDEX IF NOT EXISTS idx_inspectors_country ON inspectors(country);

-- ── Live Streaming ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_streams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  stream_key    TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','live','ended','cancelled'
  )),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  viewer_count  INTEGER NOT NULL DEFAULT 0,
  peak_viewers  INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  price         NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_supplier ON live_streams(supplier_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status   ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_featured ON live_streams(featured);

CREATE TABLE IF NOT EXISTS live_stream_products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id     UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  special_price NUMERIC(12,2),
  featured_at   TIMESTAMPTZ,
  sold_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(stream_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_products_stream  ON live_stream_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_products_product ON live_stream_products(product_id);

CREATE TABLE IF NOT EXISTS live_stream_chat (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id  UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON live_stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_ts     ON live_stream_chat(timestamp);

-- ── Audit & System ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id       UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address     INET,
  user_agent     TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin  ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts     ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_by  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key      ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

CREATE TABLE IF NOT EXISTS backup_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename     TEXT NOT NULL,
  size         BIGINT,
  type         TEXT NOT NULL DEFAULT 'full' CHECK (type IN ('full','incremental','schema_only')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  download_url TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_status  ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created ON backup_records(created_at);
