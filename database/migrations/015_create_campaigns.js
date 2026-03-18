/**
 * Migration 015: Campaigns tables
 * Tables: campaigns, campaign_products
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name           TEXT NOT NULL,
      type           TEXT NOT NULL CHECK (type IN (
        'flash_sale','seasonal','clearance','limited'
      )),
      discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
      discount_value NUMERIC(10,2) NOT NULL,
      start_date     TIMESTAMPTZ NOT NULL,
      end_date       TIMESTAMPTZ NOT NULL,
      product_ids    UUID[] DEFAULT '{}',
      quantity_limit INTEGER,
      banner_url     TEXT,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active);`);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS campaign_products (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      original_price   NUMERIC(12,2) NOT NULL,
      discounted_price NUMERIC(12,2) NOT NULL,
      UNIQUE(campaign_id, product_id)
    );
  `);

  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign
      ON campaign_products(campaign_id);
  `);
  await executeSql(`
    CREATE INDEX IF NOT EXISTS idx_campaign_products_product
      ON campaign_products(product_id);
  `);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS campaign_products;`);
  await executeSql(`DROP TABLE IF EXISTS campaigns;`);
}
