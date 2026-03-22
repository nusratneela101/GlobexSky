/**
 * Migration 017: Row Level Security policies for tables added in migration 016
 */

export async function up(executeSql) {
  // ── Enable RLS on new tables ──────────────────────────────────────────────
  const tables = [
    'carry_products',
    'carry_deliveries',
    'parcel_shipments',
    'carrier_payments',
    'ai_recommendations',
    'fraud_checks',
    'search_analytics',
    'chatbot_conversations',
    'chatbot_training_data',
    'trade_finance_applications',
    'escrow_transactions',
    'currency_rates',
    'advertisements',
    'sponsored_products',
    'flash_sales',
    'flash_sale_products',
    'loyalty_points',
    'loyalty_transactions',
    'supplier_memberships',
    'chat_rooms',
    'chat_messages',
    'video_meetings',
    'inspectors',
    'live_streams',
    'live_stream_products',
    'live_stream_chat',
    'audit_logs',
    'system_settings',
    'backup_records',
  ];

  for (const table of tables) {
    await executeSql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  }

  // ── carry_products ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass carry_products"
      ON carry_products USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Carriers view own carry products"
      ON carry_products FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM carry_requests cr
          WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
        )
      );
  `);

  // ── carry_deliveries ──────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass carry_deliveries"
      ON carry_deliveries USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Carriers manage own carry deliveries"
      ON carry_deliveries FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM carry_requests cr
          WHERE cr.id = carry_request_id AND cr.carrier_id = auth.uid()
        )
      );
  `);

  // ── parcel_shipments ──────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass parcel_shipments"
      ON parcel_shipments USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Senders view own parcel shipments"
      ON parcel_shipments FOR SELECT
      USING (auth.uid() = sender_id);
  `);
  await executeSql(`
    CREATE POLICY "Senders create parcel shipments"
      ON parcel_shipments FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  `);

  // ── carrier_payments ──────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass carrier_payments"
      ON carrier_payments USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Carriers view own payments"
      ON carrier_payments FOR SELECT
      USING (auth.uid() = carrier_id);
  `);

  // ── ai_recommendations ────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass ai_recommendations"
      ON ai_recommendations USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Users view own recommendations"
      ON ai_recommendations FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  `);

  // ── fraud_checks ──────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass fraud_checks"
      ON fraud_checks USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Admins view fraud checks"
      ON fraud_checks FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── search_analytics ──────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass search_analytics"
      ON search_analytics USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Admins view search analytics"
      ON search_analytics FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);
  await executeSql(`
    CREATE POLICY "Anyone can insert search analytics"
      ON search_analytics FOR INSERT
      WITH CHECK (TRUE);
  `);

  // ── chatbot_conversations ─────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass chatbot_conversations"
      ON chatbot_conversations USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Users view own chatbot conversations"
      ON chatbot_conversations FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  `);
  await executeSql(`
    CREATE POLICY "Users manage own chatbot conversations"
      ON chatbot_conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  `);

  // ── chatbot_training_data ─────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass chatbot_training_data"
      ON chatbot_training_data USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public can read active chatbot training data"
      ON chatbot_training_data FOR SELECT
      USING (is_active = TRUE);
  `);
  await executeSql(`
    CREATE POLICY "Admins manage chatbot training data"
      ON chatbot_training_data FOR ALL
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── trade_finance_applications ────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass trade_finance_applications"
      ON trade_finance_applications USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Buyers and suppliers view own trade finance"
      ON trade_finance_applications FOR SELECT
      USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);
  `);
  await executeSql(`
    CREATE POLICY "Buyers create trade finance applications"
      ON trade_finance_applications FOR INSERT
      WITH CHECK (auth.uid() = buyer_id);
  `);

  // ── escrow_transactions ───────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass escrow_transactions"
      ON escrow_transactions USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Buyers and suppliers view own escrow"
      ON escrow_transactions FOR SELECT
      USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);
  `);

  // ── currency_rates ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass currency_rates"
      ON currency_rates USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public read currency rates"
      ON currency_rates FOR SELECT
      USING (TRUE);
  `);
  await executeSql(`
    CREATE POLICY "Admins manage currency rates"
      ON currency_rates FOR ALL
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── advertisements ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass advertisements"
      ON advertisements USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view active advertisements"
      ON advertisements FOR SELECT
      USING (status = 'active');
  `);
  await executeSql(`
    CREATE POLICY "Suppliers manage own advertisements"
      ON advertisements FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM supplier_profiles sp
          WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
        )
      );
  `);

  // ── sponsored_products ────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass sponsored_products"
      ON sponsored_products USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view active sponsored products"
      ON sponsored_products FOR SELECT
      USING (status = 'active');
  `);
  await executeSql(`
    CREATE POLICY "Suppliers manage own sponsored products"
      ON sponsored_products FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM supplier_profiles sp
          WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
        )
      );
  `);

  // ── flash_sales ───────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass flash_sales"
      ON flash_sales USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view active flash sales"
      ON flash_sales FOR SELECT
      USING (status IN ('scheduled', 'active'));
  `);
  await executeSql(`
    CREATE POLICY "Admins manage flash sales"
      ON flash_sales FOR ALL
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── flash_sale_products ───────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass flash_sale_products"
      ON flash_sale_products USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view flash sale products"
      ON flash_sale_products FOR SELECT
      USING (TRUE);
  `);

  // ── loyalty_points ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass loyalty_points"
      ON loyalty_points USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Users view own loyalty points"
      ON loyalty_points FOR SELECT
      USING (auth.uid() = user_id);
  `);

  // ── loyalty_transactions ──────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass loyalty_transactions"
      ON loyalty_transactions USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Users view own loyalty transactions"
      ON loyalty_transactions FOR SELECT
      USING (auth.uid() = user_id);
  `);

  // ── supplier_memberships ──────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass supplier_memberships"
      ON supplier_memberships USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Suppliers view own memberships"
      ON supplier_memberships FOR SELECT
      USING (auth.uid() = supplier_id);
  `);

  // ── chat_rooms ────────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass chat_rooms"
      ON chat_rooms USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Participants view own chat rooms"
      ON chat_rooms FOR SELECT
      USING (auth.uid() = buyer_id OR auth.uid() = supplier_id);
  `);
  await executeSql(`
    CREATE POLICY "Buyers create chat rooms"
      ON chat_rooms FOR INSERT
      WITH CHECK (auth.uid() = buyer_id);
  `);

  // ── chat_messages ─────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass chat_messages"
      ON chat_messages USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Room participants view messages"
      ON chat_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM chat_rooms cr
          WHERE cr.id = room_id
            AND (cr.buyer_id = auth.uid() OR cr.supplier_id = auth.uid())
        )
      );
  `);
  await executeSql(`
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
  `);

  // ── video_meetings ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass video_meetings"
      ON video_meetings USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Organizers manage own meetings"
      ON video_meetings FOR ALL
      USING (auth.uid() = organizer_id);
  `);
  await executeSql(`
    CREATE POLICY "Participants view meetings"
      ON video_meetings FOR SELECT
      USING (auth.uid() = ANY(participant_ids));
  `);

  // ── inspectors ────────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass inspectors"
      ON inspectors USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view available inspectors"
      ON inspectors FOR SELECT
      USING (is_available = TRUE);
  `);
  await executeSql(`
    CREATE POLICY "Inspectors manage own profile"
      ON inspectors FOR ALL
      USING (auth.uid() = user_id);
  `);

  // ── live_streams ──────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass live_streams"
      ON live_streams USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view live and scheduled streams"
      ON live_streams FOR SELECT
      USING (status IN ('live','scheduled'));
  `);
  await executeSql(`
    CREATE POLICY "Suppliers manage own streams"
      ON live_streams FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM supplier_profiles sp
          WHERE sp.user_id = supplier_id AND sp.user_id = auth.uid()
        )
      );
  `);

  // ── live_stream_products ──────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass live_stream_products"
      ON live_stream_products USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public view live stream products"
      ON live_stream_products FOR SELECT
      USING (TRUE);
  `);

  // ── live_stream_chat ──────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass live_stream_chat"
      ON live_stream_chat USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public read live stream chat"
      ON live_stream_chat FOR SELECT
      USING (is_deleted = FALSE);
  `);
  await executeSql(`
    CREATE POLICY "Authenticated users send stream chat"
      ON live_stream_chat FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  `);

  // ── audit_logs ────────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass audit_logs"
      ON audit_logs USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Admins view audit logs"
      ON audit_logs FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── system_settings ───────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass system_settings"
      ON system_settings USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Public read system settings"
      ON system_settings FOR SELECT
      USING (TRUE);
  `);
  await executeSql(`
    CREATE POLICY "Admins manage system settings"
      ON system_settings FOR ALL
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);

  // ── backup_records ────────────────────────────────────────────────────────
  await executeSql(`
    CREATE POLICY "Service role bypass backup_records"
      ON backup_records USING (auth.role() = 'service_role');
  `);
  await executeSql(`
    CREATE POLICY "Admins view backup records"
      ON backup_records FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
      );
  `);
}

export async function down(executeSql) {
  const tables = [
    'carry_products',
    'carry_deliveries',
    'parcel_shipments',
    'carrier_payments',
    'ai_recommendations',
    'fraud_checks',
    'search_analytics',
    'chatbot_conversations',
    'chatbot_training_data',
    'trade_finance_applications',
    'escrow_transactions',
    'currency_rates',
    'advertisements',
    'sponsored_products',
    'flash_sales',
    'flash_sale_products',
    'loyalty_points',
    'loyalty_transactions',
    'supplier_memberships',
    'chat_rooms',
    'chat_messages',
    'video_meetings',
    'inspectors',
    'live_streams',
    'live_stream_products',
    'live_stream_chat',
    'audit_logs',
    'system_settings',
    'backup_records',
  ];

  for (const table of tables) {
    await executeSql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
  }
}
