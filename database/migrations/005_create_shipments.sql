-- Migration 005: Shipments and Shipment Events
-- ──────────────────────────────────────────────

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  carrier            TEXT,
  tracking_number    TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery',
                                         'delivered', 'failed', 'returned')),
  estimated_delivery DATE,
  shipped_at         TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  shipping_address   JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id        ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status          ON shipments(status);

-- Shipment Events table
CREATE TABLE IF NOT EXISTS shipment_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_events_event_time  ON shipment_events(event_time DESC);
