-- Quality Inspection System Database Schema
-- Migration: inspections.sql

-- Inspectors
CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT NOT NULL,
  country TEXT,
  specializations TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0,
  total_inspections INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Requests
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  inspector_id UUID REFERENCES inspectors(id),
  -- Type
  type TEXT NOT NULL CHECK (type IN ('pre_production','during_production','pre_shipment','full_audit')),
  -- Factory / Supplier Info
  supplier_name TEXT NOT NULL,
  factory_address TEXT NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  -- Product Info
  product_name TEXT NOT NULL,
  product_category TEXT,
  quantity INTEGER,
  product_details TEXT,
  specifications TEXT,
  -- Scheduling
  preferred_date DATE,
  scheduled_date DATE,
  -- Pricing
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','payment_pending','scheduled','in_progress','completed','cancelled'
  )),
  -- Attachments
  attachments JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Reports
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE UNIQUE,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass','fail','conditional_pass')),
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  -- Findings
  units_sampled INTEGER,
  units_passed INTEGER,
  defect_rate NUMERIC(5,2),
  findings JSONB DEFAULT '[]',
  -- Media
  photos JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  -- Recommendations
  recommendations TEXT,
  inspector_notes TEXT,
  -- Report metadata
  report_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Timeline Events
CREATE TABLE IF NOT EXISTS inspection_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  description TEXT,
  photos JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Pricing Configuration
CREATE TABLE IF NOT EXISTS inspection_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  report_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inspections_buyer_id ON inspections(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspection ON inspection_reports(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_timeline_inspection ON inspection_timeline(inspection_id);

-- Row Level Security
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;

-- Buyers can see own inspections
CREATE POLICY inspections_buyer_own ON inspections
  FOR ALL USING (buyer_id = auth.uid());

-- Reports visible to buyer
CREATE POLICY inspection_reports_readable ON inspection_reports
  FOR SELECT USING (
    inspection_id IN (SELECT id FROM inspections WHERE buyer_id = auth.uid())
  );

-- Seed inspection pricing
INSERT INTO inspection_pricing (type, price, duration_days, report_hours) VALUES
  ('pre_production', 199.00, 1, 24),
  ('during_production', 249.00, 2, 24),
  ('pre_shipment', 179.00, 1, 12),
  ('full_audit', 499.00, 3, 48)
ON CONFLICT (type) DO NOTHING;

-- Seed sample inspectors
INSERT INTO inspectors (name, location, country, specializations, rating, total_inspections) VALUES
  ('Zhang Wei', 'Shenzhen, Guangdong', 'CN', ARRAY['Electronics','Machinery'], 4.9, 148),
  ('Li Ming', 'Shanghai', 'CN', ARRAY['Clothing','Textiles','Accessories'], 4.8, 112),
  ('Wang Fang', 'Guangzhou', 'CN', ARRAY['Electronics','Consumer Goods'], 4.7, 89),
  ('Chen Jing', 'Yiwu', 'CN', ARRAY['Toys','Accessories','General Merchandise'], 4.6, 76),
  ('Ravi Kumar', 'Mumbai', 'IN', ARRAY['Textiles','Garments','Handicrafts'], 4.8, 94)
ON CONFLICT DO NOTHING;
