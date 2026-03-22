-- Carry Service Database Schema
-- Migration: carry.sql

-- Carrier Profiles
CREATE TABLE IF NOT EXISTS carrier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passport_url TEXT,
  id_doc_url TEXT,
  selfie_url TEXT,
  facial_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  rating NUMERIC(3,2) DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  total_earnings NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Carry Rates (per kg payment to carriers)
CREATE TABLE IF NOT EXISTS carry_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  payment_per_kg NUMERIC(8,2) NOT NULL,
  max_weight_kg NUMERIC(8,2),
  platform_fee_percent NUMERIC(5,2) DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Requests (trips offered by carriers)
CREATE TABLE IF NOT EXISTS carry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  flight_ticket_url TEXT,
  flight_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  arrival_date DATE,
  weight_capacity NUMERIC(8,2) NOT NULL,
  available_weight NUMERIC(8,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','full','in_transit','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Items (products assigned to a carry request)
CREATE TABLE IF NOT EXISTS carry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC(8,2) NOT NULL,
  payment_amount NUMERIC(10,2) NOT NULL,
  buyer_id UUID REFERENCES auth.users(id),
  booked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry Deliveries
CREATE TABLE IF NOT EXISTS carry_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_request_id UUID NOT NULL REFERENCES carry_requests(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_phone TEXT,
  qr_code TEXT,
  delivery_receipt_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','collected','in_transit','delivered','failed')),
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carrier Earnings
CREATE TABLE IF NOT EXISTS carrier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES carrier_profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES carry_deliveries(id),
  gross_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','paid')),
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON carrier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier_id ON carry_requests(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carry_requests_status ON carry_requests(status);
CREATE INDEX IF NOT EXISTS idx_carry_items_request_id ON carry_items(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carry_deliveries_request_id ON carry_deliveries(carry_request_id);
CREATE INDEX IF NOT EXISTS idx_carrier_earnings_carrier_id ON carrier_earnings(carrier_id);

-- Row Level Security
ALTER TABLE carrier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_earnings ENABLE ROW LEVEL SECURITY;

-- Carrier can see own profile
CREATE POLICY carrier_own_profile ON carrier_profiles
  FOR ALL USING (user_id = auth.uid());

-- Carriers can manage own requests
CREATE POLICY carrier_own_requests ON carry_requests
  FOR ALL USING (
    carrier_id IN (SELECT id FROM carrier_profiles WHERE user_id = auth.uid())
  );

-- Carriers see own earnings
CREATE POLICY carrier_own_earnings ON carrier_earnings
  FOR SELECT USING (
    carrier_id IN (SELECT id FROM carrier_profiles WHERE user_id = auth.uid())
  );

-- Initial carry rates seed data
INSERT INTO carry_rates (product_category, payment_per_kg, max_weight_kg, platform_fee_percent) VALUES
  ('Electronics (Phones/Tablets)', 8.00, 5.00, 10),
  ('Clothing & Accessories', 5.00, 10.00, 10),
  ('Documents & Papers', 3.00, 1.00, 8),
  ('Cosmetics & Skincare', 6.00, 3.00, 10),
  ('Medicines & Supplements', 7.00, 2.00, 12),
  ('Jewelry & Accessories', 10.00, 1.00, 15),
  ('Books & Stationery', 3.50, 5.00, 8),
  ('Food & Snacks (sealed)', 4.00, 5.00, 10)
ON CONFLICT DO NOTHING;
