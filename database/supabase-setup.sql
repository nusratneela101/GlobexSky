-- ============================================================
-- GlobexSky — Supabase Database Setup
-- Run this entire file in Supabase SQL Editor to set up the
-- database tables, RLS policies, triggers, and sample data.
-- ============================================================

-- ─── User Profiles ────────────────────────────────────────────
-- Extends Supabase auth.users with additional profile data.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  email       TEXT,
  role        TEXT DEFAULT 'buyer',  -- buyer | supplier | admin
  avatar_url  TEXT,
  phone       TEXT,
  country     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  price          DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  stock          INTEGER DEFAULT 0,
  category       TEXT,
  subcategory    TEXT,
  images         TEXT[],
  supplier_id    UUID REFERENCES profiles(id),
  rating         DECIMAL(3,2) DEFAULT 0,
  review_count   INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Cart Items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ─── Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id),
  items            JSONB NOT NULL,
  total_amount     DECIMAL(12,2) NOT NULL,
  status           TEXT DEFAULT 'pending',  -- pending | confirmed | shipped | delivered | cancelled
  shipping_address JSONB,
  payment_status   TEXT DEFAULT 'unpaid',
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Wishlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ─── Reviews ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id),
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Contact Messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Newsletter Subscribers ───────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Products: public read
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Cart items
CREATE POLICY "Users manage own cart"
  ON cart_items FOR ALL
  USING (auth.uid() = user_id);

-- Orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Wishlist
CREATE POLICY "Users manage own wishlist"
  ON wishlist FOR ALL
  USING (auth.uid() = user_id);

-- Reviews: anyone can read, authenticated users can write
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can write reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Contact messages: anyone can insert (public contact form)
CREATE POLICY "Anyone can submit contact form"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

-- Newsletter: anyone can subscribe
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Trigger: Auto-create profile on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Sample Products Data
-- ============================================================

INSERT INTO products (name, description, price, original_price, stock, category, images) VALUES
(
  'Wireless Bluetooth Headphones',
  'Premium sound quality with active noise cancellation. Up to 30 hours battery life. Foldable design for easy travel.',
  29.99, 49.99, 100, 'Electronics',
  ARRAY['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400']
),
(
  'Smart Watch Pro',
  'Feature-rich smartwatch with health monitoring, GPS, and 7-day battery life. Water resistant.',
  89.99, 129.99, 50, 'Electronics',
  ARRAY['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400']
),
(
  'Men''s Premium Cotton T-Shirt',
  'Comfortable everyday wear made from 100% organic cotton. Available in multiple colors.',
  9.99, 19.99, 200, 'Fashion',
  ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400']
),
(
  'Stainless Steel Water Bottle',
  'Double-wall insulation keeps drinks cold for 24 hours and hot for 12 hours. BPA-free.',
  19.99, 34.99, 150, 'Home & Living',
  ARRAY['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400']
),
(
  'Laptop Backpack 40L',
  'Anti-theft waterproof backpack with USB charging port. Fits laptops up to 17 inches.',
  39.99, 59.99, 75, 'Bags',
  ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400']
),
(
  'LED Adjustable Desk Lamp',
  'Adjustable brightness and color temperature. Eye-care technology reduces eye strain.',
  24.99, 39.99, 120, 'Home & Living',
  ARRAY['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400']
),
(
  'Portable Phone Stand',
  'Adjustable aluminum phone stand compatible with all smartphones and tablets.',
  12.99, 22.99, 300, 'Electronics',
  ARRAY['https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=400']
),
(
  'Women''s Running Shoes',
  'Lightweight and breathable running shoes with memory foam insoles.',
  49.99, 79.99, 80, 'Fashion',
  ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400']
)
ON CONFLICT DO NOTHING;
