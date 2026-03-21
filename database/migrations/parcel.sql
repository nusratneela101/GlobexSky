-- Parcel Service Database Schema
-- Migration: parcel.sql

-- Shipping Destinations (pricing per country)
CREATE TABLE IF NOT EXISTS shipping_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  min_weight_kg NUMERIC(8,2) DEFAULT 0.1,
  max_weight_kg NUMERIC(8,2) DEFAULT 30,
  base_fee NUMERIC(10,2) NOT NULL DEFAULT 10,
  rate_per_kg NUMERIC(10,2) NOT NULL DEFAULT 10,
  express_surcharge NUMERIC(10,2) DEFAULT 15,
  economy_discount_percent NUMERIC(5,2) DEFAULT 10,
  estimated_days_standard TEXT DEFAULT '7-14',
  estimated_days_express TEXT DEFAULT '3-5',
  is_restricted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code)
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  -- Destination
  destination_country TEXT NOT NULL,
  destination_country_code TEXT,
  destination_address TEXT NOT NULL,
  destination_city TEXT,
  destination_postal_code TEXT,
  -- Receiver
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT,
  receiver_email TEXT,
  -- Package Details
  package_type TEXT DEFAULT 'parcel' CHECK (package_type IN ('parcel','document','fragile','liquid')),
  weight_kg NUMERIC(8,2) NOT NULL,
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  declared_value NUMERIC(12,2),
  declared_contents TEXT,
  special_handling JSONB DEFAULT '[]',
  -- Shipping
  shipping_method TEXT DEFAULT 'standard' CHECK (shipping_method IN ('standard','express','economy')),
  carrier TEXT,
  tracking_number TEXT,
  -- Pricing
  base_fee NUMERIC(10,2) DEFAULT 0,
  weight_fee NUMERIC(10,2) DEFAULT 0,
  special_handling_fee NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','payment_pending','payment_confirmed',
    'received_at_warehouse','processing','customs_clearance',
    'in_transit','out_for_delivery','delivered','returned','cancelled'
  )),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- Sender info
  sender_courier TEXT,
  sender_tracking_no TEXT,
  courier_receipt_url TEXT,
  dispatched_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Shipment Timeline / Tracking Events
CREATE TABLE IF NOT EXISTS shipment_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT NOT NULL,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_reference ON shipments(reference_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment ON shipment_timeline(shipment_id);

-- Row Level Security
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_timeline ENABLE ROW LEVEL SECURITY;

-- Users can see own shipments
CREATE POLICY shipments_own ON shipments
  FOR ALL USING (user_id = auth.uid());

-- Timeline is readable by shipment owner
CREATE POLICY shipment_timeline_readable ON shipment_timeline
  FOR SELECT USING (
    shipment_id IN (SELECT id FROM shipments WHERE user_id = auth.uid())
  );

-- Function to generate reference number
CREATE OR REPLACE FUNCTION generate_shipment_reference()
RETURNS TEXT AS $$
DECLARE
  ref TEXT;
BEGIN
  ref := 'GS-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('shipment_ref_seq')::TEXT, 5, '0');
  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Sequence for reference numbers
CREATE SEQUENCE IF NOT EXISTS shipment_ref_seq START 1;

-- Seed shipping destinations
INSERT INTO shipping_destinations (country, country_code, base_fee, rate_per_kg, express_surcharge, economy_discount_percent, estimated_days_standard, estimated_days_express) VALUES
  ('United Kingdom', 'GB', 10.00, 12.00, 15.00, 10, '7-10', '3-5'),
  ('United States', 'US', 12.00, 14.00, 20.00, 8, '8-12', '4-6'),
  ('Australia', 'AU', 15.00, 16.00, 25.00, 12, '10-14', '5-7'),
  ('United Arab Emirates', 'AE', 8.00, 10.00, 12.00, 5, '5-7', '2-3'),
  ('Canada', 'CA', 12.00, 13.00, 18.00, 8, '8-12', '4-6'),
  ('Germany', 'DE', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('France', 'FR', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('Malaysia', 'MY', 6.00, 8.00, 10.00, 5, '4-7', '2-3'),
  ('Singapore', 'SG', 6.00, 8.00, 10.00, 5, '3-5', '1-2'),
  ('Saudi Arabia', 'SA', 9.00, 11.00, 14.00, 6, '5-8', '2-4'),
  ('Qatar', 'QA', 9.00, 11.00, 14.00, 6, '5-7', '2-3'),
  ('Italy', 'IT', 11.00, 13.00, 16.00, 10, '7-10', '3-5'),
  ('Japan', 'JP', 13.00, 14.00, 18.00, 8, '7-10', '3-5'),
  ('South Korea', 'KR', 11.00, 12.00, 16.00, 8, '6-9', '3-4'),
  ('Netherlands', 'NL', 11.00, 13.00, 16.00, 10, '7-10', '3-5')
ON CONFLICT (country_code) DO NOTHING;
