-- Shopping Cart Migration
-- Creates carts, cart_items, and coupons tables

CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES profiles(id),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  saved_for_later BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,
  discount_type  VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage','fixed')) DEFAULT 'percentage',
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

-- Trigger: keep carts.updated_at in sync
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

-- Row Level Security
ALTER TABLE carts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own cart"
  ON carts FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users can manage their own cart items"
  ON cart_items FOR ALL
  USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));

CREATE POLICY "coupons are readable by authenticated users"
  ON coupons FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "only admins can manage coupons"
  ON coupons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ));
