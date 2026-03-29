-- =============================================================================
-- GlobexSky Advanced Features — Supabase SQL
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ─── Chat ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, supplier_id, product_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Livestream ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'offline',  -- offline, live, ended
  viewer_count INTEGER DEFAULT 0,
  product_ids UUID[],
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stream_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  from_user UUID,
  to_user UUID,
  type TEXT,  -- offer, answer, ice-candidate
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Flash Sales ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flash_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  product_ids UUID[],
  is_active BOOLEAN DEFAULT true,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payment Settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  display_name TEXT,
  icon_url TEXT,
  config JSONB,  -- publishable/public keys only — never secret keys
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gateway TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',  -- pending, completed, failed, refunded
  transaction_id TEXT,
  gateway_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── App Settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS Policies ────────────────────────────────────────────────────────────

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Chat rooms: visible to buyer or supplier in the room
CREATE POLICY "chat_rooms_members" ON chat_rooms
  FOR ALL USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

-- Chat messages: visible to members of the room
CREATE POLICY "chat_messages_members" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE id = chat_messages.room_id
        AND (buyer_id = auth.uid() OR supplier_id = auth.uid())
    )
  );

-- Live streams: anyone can read, host can manage
CREATE POLICY "live_streams_read" ON live_streams
  FOR SELECT USING (true);
CREATE POLICY "live_streams_manage" ON live_streams
  FOR ALL USING (auth.uid() = host_id);

-- Stream signals: any authenticated user can read/write
CREATE POLICY "stream_signals_auth" ON stream_signals
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Flash sales: anyone can read active sales
CREATE POLICY "flash_sales_read" ON flash_sales
  FOR SELECT USING (true);

-- Payment settings: anyone can read active gateways
CREATE POLICY "payment_settings_read" ON payment_settings
  FOR SELECT USING (true);

-- Payments: user sees own payments
CREATE POLICY "payments_own" ON payments
  FOR ALL USING (auth.uid() = user_id);

-- App settings: anyone can read (keys are stored separately)
CREATE POLICY "app_settings_read" ON app_settings
  FOR SELECT USING (true);

-- ─── Default Data ────────────────────────────────────────────────────────────

INSERT INTO payment_settings (gateway, display_name, is_active, icon_url) VALUES
  ('stripe',     'Stripe (Visa/Mastercard/Amex)',      false, 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/stripe.svg'),
  ('bkash',      'bKash',                               false, ''),
  ('nagad',      'Nagad',                               false, ''),
  ('sslcommerz', 'SSLCommerz',                          false, ''),
  ('crypto',     'Cryptocurrency (Bitcoin/ETH/USDT)',   false, ''),
  ('wechat',     'WeChat Pay',                          false, ''),
  ('alipay',     'Alipay',                              false, ''),
  ('cod',        'Cash on Delivery',                    true,  ''),
  ('bank',       'Bank Transfer',                       true,  '')
ON CONFLICT (gateway) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES
  ('deepseek_api_key',      ''),
  ('site_name',             'GlobexSky'),
  ('site_currency',         'USD'),
  ('smtp_host',             ''),
  ('smtp_user',             ''),
  ('sms_provider',          ''),
  ('stripe_publishable_key','')
ON CONFLICT (key) DO NOTHING;

-- ─── Realtime: enable publications ──────────────────────────────────────────

-- Enable realtime for chat (run this in Supabase Dashboard → Realtime):
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE live_streams;
-- ALTER PUBLICATION supabase_realtime ADD TABLE stream_signals;
