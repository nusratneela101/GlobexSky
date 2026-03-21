-- Supplier Management & Verification Database Schema
-- Migration: supplier.sql

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Company Info
  company_name TEXT NOT NULL,
  business_type TEXT CHECK (business_type IN ('manufacturer','trading','manufacturer_trading','wholesaler','agent')),
  established_year INTEGER,
  description TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  -- Business Details
  employees TEXT,
  annual_revenue TEXT,
  production_capacity TEXT,
  export_markets TEXT,
  oem_odm TEXT,
  main_categories TEXT[] DEFAULT '{}',
  -- Documents
  business_license_url TEXT,
  registration_cert_url TEXT,
  certifications JSONB DEFAULT '[]',
  factory_photos JSONB DEFAULT '[]',
  -- Verification
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','under_review','verified','rejected','suspended')),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Membership
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free','basic','gold','platinum','diamond')),
  tier_expires_at TIMESTAMPTZ,
  -- Performance
  rating NUMERIC(3,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(14,2) DEFAULT 0,
  response_rate NUMERIC(5,2) DEFAULT 0,
  on_time_delivery_rate NUMERIC(5,2) DEFAULT 0,
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Supplier Products (extends products with supplier-specific fields)
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  -- Product fields (if not linked to existing product)
  name TEXT,
  description TEXT,
  category TEXT,
  images JSONB DEFAULT '[]',
  -- Pricing
  unit_price NUMERIC(12,2),
  bulk_price_tiers JSONB DEFAULT '[]', -- [{min_qty: 100, price: 8.50}, ...]
  moq INTEGER DEFAULT 1,
  unit TEXT DEFAULT 'piece',
  -- Specifications
  specifications JSONB DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  -- Availability
  stock_quantity INTEGER,
  lead_time_days INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Reviews
CREATE TABLE IF NOT EXISTS supplier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  shipping_rating INTEGER CHECK (shipping_rating BETWEEN 1 AND 5),
  photos JSONB DEFAULT '[]',
  is_verified BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Assessment / Scorecard
CREATE TABLE IF NOT EXISTS supplier_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  assessment_type TEXT DEFAULT 'periodic',
  quality_score NUMERIC(5,2),
  delivery_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  compliance_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_verification ON suppliers(verification_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_tier ON suppliers(tier);
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(rating);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_reviews_supplier ON supplier_reviews(supplier_id);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers
  USING GIN (to_tsvector('english', company_name || ' ' || COALESCE(description, '')));

-- Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_reviews ENABLE ROW LEVEL SECURITY;

-- Suppliers manage own profile
CREATE POLICY suppliers_own ON suppliers
  FOR ALL USING (user_id = auth.uid());

-- Verified suppliers are public
CREATE POLICY suppliers_public_verified ON suppliers
  FOR SELECT USING (verification_status = 'verified' AND is_active = TRUE);

-- Suppliers manage own products
CREATE POLICY supplier_products_own ON supplier_products
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
  );

-- Active supplier products are public
CREATE POLICY supplier_products_public ON supplier_products
  FOR SELECT USING (is_active = TRUE);

-- Reviews are public readable
CREATE POLICY supplier_reviews_public ON supplier_reviews
  FOR SELECT USING (TRUE);

-- Buyers write own reviews
CREATE POLICY supplier_reviews_buyer_write ON supplier_reviews
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Function to update supplier rating after new review
CREATE OR REPLACE FUNCTION update_supplier_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM supplier_reviews
      WHERE supplier_id = NEW.supplier_id
    )
  WHERE id = NEW.supplier_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_supplier_rating
AFTER INSERT OR UPDATE ON supplier_reviews
FOR EACH ROW EXECUTE FUNCTION update_supplier_rating();
