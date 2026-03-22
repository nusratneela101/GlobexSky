-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Row Level Security Policies for additional tables
-- Pure SQL reference — executed via 017_rls_policies.js
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE carry_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_shipments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_checks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_training_data      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_finance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points             ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspectors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_chat           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_records             ENABLE ROW LEVEL SECURITY;

-- ── carry_products ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass carry_products"
  ON carry_products USING (auth.role() = 'service_role');

CREATE POLICY "Carriers view own carry products"
  ON carry_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carry_requests cr
      WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
    )
  );

-- ── carry_deliveries ──────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass carry_deliveries"
  ON carry_deliveries USING (auth.role() = 'service_role');

CREATE POLICY "Carriers manage own carry deliveries"
  ON carry_deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM carry_requests cr
      WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
    )
  );

-- ── parcel_shipments ──────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass parcel_shipments"
  ON parcel_shipments USING (auth.role() = 'service_role');

CREATE POLICY "Senders view own parcel shipments"
  ON parcel_shipments FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders create parcel shipments"
  ON parcel_shipments FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ── carrier_payments ──────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass carrier_payments"
  ON carrier_payments USING (auth.role() = 'service_role');

CREATE POLICY "Carriers view own payments"
  ON carrier_payments FOR SELECT
  USING (auth.uid() = carrier_id);

-- ── ai_recommendations ────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass ai_recommendations"
  ON ai_recommendations USING (auth.role() = 'service_role');

CREATE POLICY "Users view own recommendations"
  ON ai_recommendations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ── fraud_checks ──────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass fraud_checks"
  ON fraud_checks USING (auth.role() = 'service_role');

CREATE POLICY "Admins view fraud checks"
  ON fraud_checks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── search_analytics ──────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass search_analytics"
  ON search_analytics USING (auth.role() = 'service_role');

CREATE POLICY "Admins view search analytics"
  ON search_analytics FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Anyone can insert search analytics"
  ON search_analytics FOR INSERT
  WITH CHECK (TRUE);

-- ── chatbot_conversations ─────────────────────────────────────────────────────

CREATE POLICY "Service role bypass chatbot_conversations"
  ON chatbot_conversations USING (auth.role() = 'service_role');

CREATE POLICY "Users view own chatbot conversations"
  ON chatbot_conversations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users manage own chatbot conversations"
  ON chatbot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── chatbot_training_data ─────────────────────────────────────────────────────

CREATE POLICY "Service role bypass chatbot_training_data"
  ON chatbot_training_data USING (auth.role() = 'service_role');

CREATE POLICY "Public can read active chatbot training data"
  ON chatbot_training_data FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins manage chatbot training data"
  ON chatbot_training_data FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── trade_finance_applications ────────────────────────────────────────────────

CREATE POLICY "Service role bypass trade_finance_applications"
  ON trade_finance_applications USING (auth.role() = 'service_role');

CREATE POLICY "Buyers and suppliers view own trade finance"
  ON trade_finance_applications FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

CREATE POLICY "Buyers create trade finance applications"
  ON trade_finance_applications FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ── escrow_transactions ───────────────────────────────────────────────────────

CREATE POLICY "Service role bypass escrow_transactions"
  ON escrow_transactions USING (auth.role() = 'service_role');

CREATE POLICY "Buyers and suppliers view own escrow"
  ON escrow_transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

-- ── currency_rates ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass currency_rates"
  ON currency_rates USING (auth.role() = 'service_role');

CREATE POLICY "Public read currency rates"
  ON currency_rates FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins manage currency rates"
  ON currency_rates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── advertisements ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass advertisements"
  ON advertisements USING (auth.role() = 'service_role');

CREATE POLICY "Public view active advertisements"
  ON advertisements FOR SELECT
  USING (status = 'active');

CREATE POLICY "Suppliers manage own advertisements"
  ON advertisements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── sponsored_products ────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass sponsored_products"
  ON sponsored_products USING (auth.role() = 'service_role');

CREATE POLICY "Public view active sponsored products"
  ON sponsored_products FOR SELECT
  USING (status = 'active');

CREATE POLICY "Suppliers manage own sponsored products"
  ON sponsored_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── flash_sales ───────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass flash_sales"
  ON flash_sales USING (auth.role() = 'service_role');

CREATE POLICY "Public view active flash sales"
  ON flash_sales FOR SELECT
  USING (status IN ('scheduled', 'active'));

CREATE POLICY "Admins manage flash sales"
  ON flash_sales FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── flash_sale_products ───────────────────────────────────────────────────────

CREATE POLICY "Service role bypass flash_sale_products"
  ON flash_sale_products USING (auth.role() = 'service_role');

CREATE POLICY "Public view flash sale products"
  ON flash_sale_products FOR SELECT
  USING (TRUE);

-- ── loyalty_points ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass loyalty_points"
  ON loyalty_points USING (auth.role() = 'service_role');

CREATE POLICY "Users view own loyalty points"
  ON loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

-- ── loyalty_transactions ──────────────────────────────────────────────────────

CREATE POLICY "Service role bypass loyalty_transactions"
  ON loyalty_transactions USING (auth.role() = 'service_role');

CREATE POLICY "Users view own loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── supplier_memberships ──────────────────────────────────────────────────────

CREATE POLICY "Service role bypass supplier_memberships"
  ON supplier_memberships USING (auth.role() = 'service_role');

CREATE POLICY "Suppliers view own memberships"
  ON supplier_memberships FOR SELECT
  USING (auth.uid() = supplier_id);

-- ── chat_rooms ────────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass chat_rooms"
  ON chat_rooms USING (auth.role() = 'service_role');

CREATE POLICY "Participants view own chat rooms"
  ON chat_rooms FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);

CREATE POLICY "Buyers create chat rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ── chat_messages ─────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass chat_messages"
  ON chat_messages USING (auth.role() = 'service_role');

CREATE POLICY "Room participants view messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.buyer_id = auth.uid() OR cr.supplier_id = auth.uid())
    )
  );

CREATE POLICY "Room participants send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_rooms cr
      WHERE cr.id = room_id
        AND (cr.buyer_id = auth.uid() OR cr.supplier_id = auth.uid())
    )
  );

-- ── video_meetings ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass video_meetings"
  ON video_meetings USING (auth.role() = 'service_role');

CREATE POLICY "Organizers manage own meetings"
  ON video_meetings FOR ALL
  USING (auth.uid() = organizer_id);

CREATE POLICY "Participants view meetings"
  ON video_meetings FOR SELECT
  USING (auth.uid() = ANY(participant_ids));

-- ── inspectors ────────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass inspectors"
  ON inspectors USING (auth.role() = 'service_role');

CREATE POLICY "Public view available inspectors"
  ON inspectors FOR SELECT
  USING (is_available = TRUE);

CREATE POLICY "Inspectors manage own profile"
  ON inspectors FOR ALL
  USING (auth.uid() = user_id);

-- ── live_streams ──────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass live_streams"
  ON live_streams USING (auth.role() = 'service_role');

CREATE POLICY "Public view live and scheduled streams"
  ON live_streams FOR SELECT
  USING (status IN ('live','scheduled'));

CREATE POLICY "Suppliers manage own streams"
  ON live_streams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles sp
      WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
    )
  );

-- ── live_stream_products ──────────────────────────────────────────────────────

CREATE POLICY "Service role bypass live_stream_products"
  ON live_stream_products USING (auth.role() = 'service_role');

CREATE POLICY "Public view live stream products"
  ON live_stream_products FOR SELECT
  USING (TRUE);

-- ── live_stream_chat ──────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass live_stream_chat"
  ON live_stream_chat USING (auth.role() = 'service_role');

CREATE POLICY "Public read live stream chat"
  ON live_stream_chat FOR SELECT
  USING (is_deleted = FALSE);

CREATE POLICY "Authenticated users send stream chat"
  ON live_stream_chat FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ── audit_logs ────────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass audit_logs"
  ON audit_logs USING (auth.role() = 'service_role');

CREATE POLICY "Admins view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── system_settings ───────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass system_settings"
  ON system_settings USING (auth.role() = 'service_role');

CREATE POLICY "Public read system settings"
  ON system_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins manage system settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ── backup_records ────────────────────────────────────────────────────────────

CREATE POLICY "Service role bypass backup_records"
  ON backup_records USING (auth.role() = 'service_role');

CREATE POLICY "Admins view backup records"
  ON backup_records FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );
