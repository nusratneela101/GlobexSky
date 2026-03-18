-- ─────────────────────────────────────────────────────────────────
-- Migration 011: Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks          ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access (used by backend)
CREATE POLICY "Service role bypass profiles"
  ON profiles USING (auth.role() = 'service_role');

-- ─── addresses ───────────────────────────────────────────────────
CREATE POLICY "Users manage own addresses"
  ON addresses USING (auth.uid() = user_id);

-- ─── products (public read) ──────────────────────────────────────
CREATE POLICY "Public can view active products"
  ON products FOR SELECT USING (status = 'active');

CREATE POLICY "Suppliers manage own products"
  ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── wishlists ───────────────────────────────────────────────────
CREATE POLICY "Users manage own wishlists"
  ON wishlists USING (auth.uid() = user_id);

-- ─── orders ──────────────────────────────────────────────────────
CREATE POLICY "Buyers see own orders"
  ON orders FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Suppliers see their orders"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM supplier_profiles sp WHERE sp.id = supplier_id AND sp.user_id = auth.uid())
  );

-- ─── transactions ────────────────────────────────────────────────
CREATE POLICY "Users see own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

-- ─── notifications ───────────────────────────────────────────────
CREATE POLICY "Users manage own notifications"
  ON notifications USING (auth.uid() = user_id);

-- ─── parcels ─────────────────────────────────────────────────────
CREATE POLICY "Senders see own parcels"
  ON parcels USING (auth.uid() = sender_id);

-- ─── rfqs ────────────────────────────────────────────────────────
CREATE POLICY "Buyers manage own RFQs"
  ON rfqs USING (auth.uid() = buyer_id);

CREATE POLICY "Suppliers view open RFQs"
  ON rfqs FOR SELECT USING (status = 'open');

-- ─── api_keys ────────────────────────────────────────────────────
CREATE POLICY "Users manage own API keys"
  ON api_keys USING (auth.uid() = user_id);

-- ─── webhooks ────────────────────────────────────────────────────
CREATE POLICY "Users manage own webhooks"
  ON webhooks USING (auth.uid() = user_id);
