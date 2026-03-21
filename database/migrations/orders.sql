-- Enhanced Orders Migration
-- Adds order_number, billing_address, shipping_method, coupon tracking,
-- and order_timeline table

-- Extend orders table with new columns (safe to run on existing table)
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS order_number     VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_address_id UUID REFERENCES addresses(id),
  ADD COLUMN IF NOT EXISTS tax              NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS carrier          VARCHAR(100);

-- order_timeline: status history for each order
CREATE TABLE IF NOT EXISTS order_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(50) NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);

-- Row Level Security
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyers can view their own order timeline"
  ON order_timeline FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

CREATE POLICY "admins can manage order timeline"
  ON order_timeline FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));

