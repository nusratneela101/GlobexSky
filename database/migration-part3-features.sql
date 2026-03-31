-- ═══════════════════════════════════════════════════════════════════════════
-- GlobexSky Platform — Migration Part 3: Features
-- (Payments, Escrow, RFQ, Chat, Notifications, Reviews, Cart, etc.)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER migration-part2-commerce.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Payments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  amount      NUMERIC(12,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  method      TEXT NOT NULL CHECK (method IN ('card','paypal','bank_transfer','escrow','cod','stripe','bkash','nagad')),
  provider    TEXT,
  provider_id TEXT,
  gateway     TEXT,
  gateway_transaction_id TEXT,
  gateway_response       JSONB,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','completed','failed','refunded','held','cancelled')),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_id);

-- ── Refunds ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id        UUID REFERENCES payments(id) ON DELETE RESTRICT,
  order_id          UUID REFERENCES orders(id) ON DELETE CASCADE,
  dispute_id        UUID,
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','approved','completed','failed','rejected')),
  gateway_refund_id TEXT,
  processed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id        ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status            ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id ON refunds(gateway_refund_id);

-- ── Transactions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id               UUID REFERENCES orders(id) ON DELETE SET NULL,
  type                   TEXT NOT NULL
                           CHECK (type IN ('payment','refund','payout','commission','subscription','adjustment')),
  amount                 NUMERIC(12,2) NOT NULL,
  fee                    NUMERIC(10,2) DEFAULT 0,
  net_amount             NUMERIC(12,2),
  currency               TEXT NOT NULL DEFAULT 'USD',
  status                 TEXT NOT NULL DEFAULT 'completed'
                           CHECK (status IN ('pending','completed','failed','refunded','cancelled')),
  payment_method         TEXT,
  payment_gateway        TEXT,
  gateway_transaction_id TEXT,
  description            TEXT,
  metadata               JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order   ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- ── Payouts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT NOT NULL DEFAULT 'bank_transfer',
  type         TEXT NOT NULL DEFAULT 'supplier'
                 CHECK (type IN ('supplier','carrier','affiliate')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  notes        TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_user    ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status  ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_type    ON payouts(type);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- ── Supplier Payouts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payouts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id   UUID NOT NULL REFERENCES supplier_profiles(id),
  amount        NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','failed')),
  payout_method TEXT,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Escrow ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id           UUID REFERENCES orders(id) ON DELETE SET NULL,
  buyer_id           UUID NOT NULL REFERENCES auth.users(id),
  seller_id          UUID NOT NULL REFERENCES auth.users(id),
  amount             NUMERIC(12,2) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held','released','disputed','refunded','cancelled')),
  release_conditions TEXT,
  released_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_order  ON escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer  ON escrow(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow(status);

-- ── Escrow Transactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  buyer_id      UUID NOT NULL REFERENCES auth.users(id),
  supplier_id   UUID NOT NULL REFERENCES auth.users(id),
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
  status        VARCHAR(20) NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held','holding','released','refunded','disputed','cancelled')),
  milestone_id  UUID,
  milestone     TEXT,
  held_at       TIMESTAMPTZ,
  released_at   TIMESTAMPTZ,
  refunded_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_order_id    ON escrow_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer_id    ON escrow_transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_supplier_id ON escrow_transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status      ON escrow_transactions (status);

-- ── Escrow Milestones ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_milestones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id    UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','released')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow_id ON escrow_milestones (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status    ON escrow_milestones (status);

-- ── Escrow Audit Log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id  UUID NOT NULL REFERENCES escrow_transactions (id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  actor_id   UUID NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_escrow_id ON escrow_audit_log (escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_actor_id  ON escrow_audit_log (actor_id);

-- ── Escrow Config ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_escrow_config_key ON escrow_config (key);

-- ── RFQs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfqs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number          TEXT UNIQUE,
  buyer_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  source_country      TEXT,
  quantity            NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit                TEXT DEFAULT 'pieces',
  target_price        NUMERIC(12,2),
  total_budget        NUMERIC(12,2),
  currency            TEXT NOT NULL DEFAULT 'USD',
  specifications      TEXT,
  specifications_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  sample_required     TEXT DEFAULT 'no'
                        CHECK (sample_required IN ('no','yes_free','yes_paid')),
  packaging           TEXT,
  certifications      TEXT[] DEFAULT '{}',
  required_delivery_date DATE,
  deadline            DATE,
  attachments         JSONB DEFAULT '[]',
  tags                TEXT[] DEFAULT '{}',
  remarks             TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','open','closed','awarded','cancelled')),
  quotation_count     INTEGER DEFAULT 0,
  quotations_count    INTEGER NOT NULL DEFAULT 0,
  view_count          INTEGER DEFAULT 0,
  awarded_supplier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id    ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status      ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category    ON rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_category_id ON rfqs(category_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_deadline    ON rfqs(deadline);

-- ── Quotations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id         UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price    NUMERIC(14,2),
  moq            INTEGER NOT NULL DEFAULT 1,
  min_order_qty  INTEGER NOT NULL DEFAULT 1,
  lead_time      INTEGER NOT NULL DEFAULT 1,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  validity_days  INTEGER NOT NULL DEFAULT 30,
  payment_terms  TEXT,
  sample         TEXT DEFAULT 'no',
  custom_logo    TEXT DEFAULT 'no',
  certifications TEXT[] DEFAULT '{}',
  warranty       TEXT,
  shipping_methods TEXT[] DEFAULT '{}',
  notes          TEXT NOT NULL DEFAULT '',
  attachments    JSONB DEFAULT '[]',
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted','under_review','accepted','rejected','negotiating','withdrawn')),
  counter_price  NUMERIC(12,2),
  counter_message TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id      ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status      ON quotations(status);

-- ── RFQ Messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id       UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES auth.users(id),
  message      TEXT NOT NULL,
  attachments  JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_messages_rfq_id ON rfq_messages(rfq_id);

-- ── RFQ Matches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_matches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id        UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL,
  match_score   NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_reasons JSONB DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','notified','viewed','quoted','expired')),
  notified_at   TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  quoted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_matches_rfq_id   ON rfq_matches (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_supplier ON rfq_matches (supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_score    ON rfq_matches (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_matches_status   ON rfq_matches (status);

-- ── RFQ Marketplace ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_marketplace (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id       UUID NOT NULL UNIQUE REFERENCES rfqs(id) ON DELETE CASCADE,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  category_id  UUID,
  tags         TEXT[] DEFAULT '{}',
  budget_range TEXT,
  urgency      TEXT NOT NULL DEFAULT 'medium'
                 CHECK (urgency IN ('low','medium','high','urgent')),
  views_count  INTEGER NOT NULL DEFAULT 0,
  quotes_count INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_rfq_id   ON rfq_marketplace (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_public   ON rfq_marketplace (is_public);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_category ON rfq_marketplace (category_id);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_urgency  ON rfq_marketplace (urgency);
CREATE INDEX IF NOT EXISTS idx_rfq_marketplace_expires  ON rfq_marketplace (expires_at);

-- ── RFQ Match Config ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_match_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT NOT NULL UNIQUE,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_rfq_match_config_key ON rfq_match_config (key);

-- ── RFQ Quotes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_quotes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id       UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES auth.users(id),
  price        NUMERIC(12,2) NOT NULL,
  lead_time    INTEGER,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted','accepted','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq_id      ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier_id ON rfq_quotes(supplier_id);

-- ── Conversations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids  UUID[] NOT NULL,
  type             TEXT NOT NULL DEFAULT 'buyer_supplier'
                     CHECK (type IN ('buyer_supplier','support','group')),
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON conversations USING gin(participant_ids);

-- ── Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id    UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id          UUID NOT NULL REFERENCES auth.users(id),
  content            TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'text'
                       CHECK (type IN ('text','image','file','voice')),
  file_url           TEXT,
  attachments        TEXT[] DEFAULT '{}',
  is_read            BOOLEAN NOT NULL DEFAULT FALSE,
  read_at            TIMESTAMPTZ,
  translated_content TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created      ON messages(created_at DESC);

-- ── Chat Rooms ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_rooms (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id              UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  last_message          TEXT,
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

-- ── Chat Messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  message         TEXT,
  type            TEXT NOT NULL DEFAULT 'text'
                    CHECK (type IN ('text','image','file','audio','video','system')),
  file_url        TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  translated_text JSONB DEFAULT '{}',
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room    ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender  ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ── Notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'info'
               CHECK (type IN ('info','success','warning','error','order','payment',
                               'shipment','message','promotion','system')),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}'::JSONB,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  channel    TEXT        NOT NULL DEFAULT 'in_app'
               CHECK (channel IN ('in_app','email','sms','push')),
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ── Notification Preferences ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  order_updates BOOLEAN NOT NULL DEFAULT TRUE,
  messages      BOOLEAN NOT NULL DEFAULT TRUE,
  promotions    BOOLEAN NOT NULL DEFAULT TRUE,
  system_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Push Subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ── Reviews ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id             UUID REFERENCES orders(id),
  rating               SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                TEXT,
  content              TEXT,
  photos               TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count        INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'published'
                         CHECK (status IN ('published','hidden','flagged','pending','approved','rejected')),
  seller_response      TEXT,
  seller_response_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating  ON reviews(product_id, rating);

-- ── Review Votes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);

-- ── Review Reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- ── Review Images ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);

-- ── Carts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

-- ── Cart Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES profiles(id),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  saved_for_later BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- ── Coupons ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(50) NOT NULL UNIQUE,
  discount_type  VARCHAR(20) NOT NULL DEFAULT 'percentage'
                   CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order      NUMERIC(12,2),
  max_discount   NUMERIC(12,2),
  valid_from     TIMESTAMPTZ,
  valid_to       TIMESTAMPTZ,
  usage_limit    INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ── Campaigns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'discount'
                CHECK (type IN ('discount','flash_sale','bundle','referral','seasonal')),
  discount    NUMERIC(5,2),
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ,
  conditions  JSONB DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Products ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount    NUMERIC(5,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, product_id)
);

-- ── Flash Sales ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flash_sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  description      TEXT,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  product_ids      UUID[] DEFAULT '{}',
  quantity_limit   INTEGER,
  max_quantity     INTEGER,
  sold_count       INTEGER DEFAULT 0,
  banner_url       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_times  ON flash_sales(start_time, end_time);

-- ── Flash Sale Products ───────────────────────────────────────────────────
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

-- ── Chat Translations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_translations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id         UUID NOT NULL,
  original_text      TEXT NOT NULL,
  translated_text    TEXT NOT NULL,
  source_language    TEXT NOT NULL,
  target_language    TEXT NOT NULL,
  provider           TEXT NOT NULL DEFAULT 'google',
  confidence         NUMERIC(5,4) DEFAULT 0.0000,
  cached             BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_translations_message_id ON chat_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_translations_languages  ON chat_translations(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_chat_translations_provider   ON chat_translations(provider);

-- ── Translation Cache ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text_hash       TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'google',
  hit_count       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '720 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache(text_hash, source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);

-- ── Translation Config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT UNIQUE NOT NULL,
  value        TEXT NOT NULL DEFAULT '',
  description  TEXT DEFAULT '',
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_config_key ON translation_config(key);

-- ── Image Search History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_history (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID,
  image_url          TEXT,
  search_type        TEXT NOT NULL DEFAULT 'upload'
                       CHECK (search_type IN ('upload','camera','url')),
  results            JSONB NOT NULL DEFAULT '[]',
  provider           TEXT,
  processing_time_ms INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_search_history_user_id    ON image_search_history (user_id);
CREATE INDEX IF NOT EXISTS idx_image_search_history_created_at ON image_search_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_search_history_provider   ON image_search_history (provider);

-- ── Image Search Config ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_search_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_image_search_config_key ON image_search_config (key);

-- ── Product Comparisons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_comparisons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  products    JSONB NOT NULL DEFAULT '[]',
  name        TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  share_token TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_comparisons_user_id     ON product_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_share_token ON product_comparisons(share_token);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_is_public   ON product_comparisons(is_public);

-- ── Comparison Attributes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comparison_attributes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id    UUID REFERENCES categories(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  attribute_key  TEXT NOT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_attributes_category_id ON comparison_attributes(category_id);
CREATE INDEX IF NOT EXISTS idx_comparison_attributes_is_active   ON comparison_attributes(is_active);

-- ── Product Comparison Config ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_comparison_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_comparison_config_key ON product_comparison_config(key);

-- ── User Interactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_interactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  product_id       UUID NOT NULL,
  interaction_type TEXT NOT NULL
                     CHECK (interaction_type IN ('view','click','cart','purchase','wishlist')),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id    ON user_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_product_id ON user_interactions (product_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type       ON user_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions (created_at);

-- ── Product Recommendations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_recommendations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL,
  product_id UUID NOT NULL,
  score      NUMERIC(5,4) NOT NULL DEFAULT 0,
  algorithm  TEXT NOT NULL DEFAULT 'hybrid',
  reason     TEXT,
  is_shown   BOOLEAN NOT NULL DEFAULT FALSE,
  is_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_recs_user_id    ON product_recommendations (user_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_product_id ON product_recommendations (product_id);
CREATE INDEX IF NOT EXISTS idx_product_recs_score      ON product_recommendations (score DESC);
CREATE INDEX IF NOT EXISTS idx_product_recs_expires_at ON product_recommendations (expires_at);

-- ── Recommendation Config ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT UNIQUE NOT NULL,
  value        TEXT,
  description  TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_recommendation_config_key ON recommendation_config (key);

-- ── Triggers for Part 3 ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_cart_timestamp();

CREATE OR REPLACE FUNCTION escrow_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_transactions_updated_at ON escrow_transactions;
CREATE TRIGGER trg_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_milestones_updated_at ON escrow_milestones;
CREATE TRIGGER trg_escrow_milestones_updated_at
  BEFORE UPDATE ON escrow_milestones
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

DROP TRIGGER IF EXISTS trg_escrow_config_updated_at ON escrow_config;
CREATE TRIGGER trg_escrow_config_updated_at
  BEFORE UPDATE ON escrow_config
  FOR EACH ROW EXECUTE FUNCTION escrow_set_updated_at();

CREATE OR REPLACE FUNCTION update_rfq_quotation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rfqs SET quotation_count = quotation_count + 1 WHERE id = NEW.rfq_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rfqs SET quotation_count = GREATEST(0, quotation_count - 1) WHERE id = OLD.rfq_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfq_quotation_count ON quotations;
CREATE TRIGGER trg_rfq_quotation_count
AFTER INSERT OR DELETE ON quotations
FOR EACH ROW EXECUTE FUNCTION update_rfq_quotation_count();

CREATE OR REPLACE FUNCTION image_search_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_image_search_config_updated_at ON image_search_config;
CREATE TRIGGER trg_image_search_config_updated_at
  BEFORE UPDATE ON image_search_config
  FOR EACH ROW EXECUTE FUNCTION image_search_config_set_updated_at();

CREATE OR REPLACE FUNCTION recommendation_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommendation_config_updated_at ON recommendation_config;
CREATE TRIGGER trg_recommendation_config_updated_at
  BEFORE UPDATE ON recommendation_config
  FOR EACH ROW EXECUTE FUNCTION recommendation_config_set_updated_at();
