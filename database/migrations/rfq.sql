-- RFQ (Request for Quotation) System Database Schema
-- Migration: rfq.sql

-- RFQs
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  source_country TEXT,
  -- Quantity & Pricing
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT 'pieces',
  target_price NUMERIC(12,2),
  total_budget NUMERIC(12,2),
  -- Specifications
  specifications TEXT,
  sample_required TEXT DEFAULT 'no' CHECK (sample_required IN ('no','yes_free','yes_paid')),
  packaging TEXT,
  certifications TEXT[] DEFAULT '{}',
  required_delivery_date DATE,
  -- Deadline
  deadline DATE NOT NULL,
  -- Attachments
  attachments JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  remarks TEXT,
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','open','closed','awarded','cancelled')),
  -- Counters
  quotation_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotations (responses from suppliers)
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pricing
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2),
  moq INTEGER NOT NULL DEFAULT 1,
  -- Details
  lead_time INTEGER NOT NULL,
  -- ^ lead_time is in days (e.g. 25 = 25 days from order confirmation to shipment)
  payment_terms TEXT,
  sample TEXT DEFAULT 'no',
  custom_logo TEXT DEFAULT 'no',
  certifications TEXT[] DEFAULT '{}',
  warranty TEXT,
  shipping_methods TEXT[] DEFAULT '{}',
  notes TEXT NOT NULL,
  -- Attachments
  attachments JSONB DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected','negotiating')),
  -- Negotiation
  counter_price NUMERIC(12,2),
  counter_message TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

-- RFQ Messages (buyer-supplier negotiation)
CREATE TABLE IF NOT EXISTS rfq_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update quotation count
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

CREATE TRIGGER trg_rfq_quotation_count
AFTER INSERT OR DELETE ON quotations
FOR EACH ROW EXECUTE FUNCTION update_rfq_quotation_count();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category ON rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_deadline ON rfqs(deadline);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_rfq_id ON rfq_messages(rfq_id);

-- Row Level Security
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_messages ENABLE ROW LEVEL SECURITY;

-- Buyers manage own RFQs
CREATE POLICY rfqs_buyer_own ON rfqs
  FOR ALL USING (buyer_id = auth.uid());

-- Open RFQs visible to suppliers
CREATE POLICY rfqs_public_open ON rfqs
  FOR SELECT USING (status = 'open');

-- Suppliers manage own quotations
CREATE POLICY quotations_supplier_own ON quotations
  FOR ALL USING (supplier_id = auth.uid());

-- Buyer can see quotations on own RFQs
CREATE POLICY quotations_buyer_see ON quotations
  FOR SELECT USING (
    rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = auth.uid())
  );

-- Messages visible to participants
CREATE POLICY rfq_messages_visible ON rfq_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = auth.uid()) OR
    quotation_id IN (SELECT id FROM quotations WHERE supplier_id = auth.uid())
  );
