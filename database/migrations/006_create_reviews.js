/**
 * Migration 006: Reviews table
 * Tables: reviews
 */

export async function up(executeSql) {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS reviews (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      order_id      UUID REFERENCES orders(id),
      rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment       TEXT,
      images        TEXT[] DEFAULT '{}',
      helpful_count INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','flagged')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );
  `);

  await executeSql(`CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_reviews_user    ON reviews(user_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_reviews_rating  ON reviews(rating);`);
}

export async function down(executeSql) {
  await executeSql(`DROP TABLE IF EXISTS reviews;`);
}
