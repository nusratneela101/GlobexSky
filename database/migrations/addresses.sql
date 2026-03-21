-- Address Book Migration
-- Extends the existing addresses table with full_name, phone, address lines,
-- and separate default shipping/billing flags.

-- Add new columns to existing addresses table (idempotent)
ALTER TABLE IF EXISTS addresses
  ADD COLUMN IF NOT EXISTS full_name           VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone               VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address_line1       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_default_billing  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate existing data: copy street -> address_line1 where address_line1 is null
UPDATE addresses SET address_line1 = street WHERE address_line1 IS NULL AND street IS NOT NULL;
UPDATE addresses SET is_default_shipping = is_default, is_default_billing = is_default WHERE is_default = TRUE;

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION update_address_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_address_timestamp();

