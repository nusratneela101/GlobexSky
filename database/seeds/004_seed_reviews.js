/**
 * Seed 004: Reviews
 * Inserts 15 sample product reviews.
 * Depends on: 001_seed_users.js, 002_seed_products.js
 */

const BUYER_ID = '00000000-0000-0000-0000-000000000002';

const REVIEWS = [
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000001', rating: 5, comment: 'Excellent sound quality! The noise cancellation is impressive and battery lasts all day.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000002', rating: 4, comment: 'Great smartwatch for the price. GPS is accurate and the fitness tracking is helpful.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000003', rating: 5, comment: 'Charges my laptop super fast. The braided nylon is durable and hasn\'t frayed at all.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000004', rating: 4, comment: 'Slim and lightweight. Charged my phone 4 times from zero. Good value for money.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000005', rating: 5, comment: 'Excellent quality fabric. The fit is perfect and it looks great for both work and casual wear.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000006', rating: 4, comment: 'Comfortable and stylish. The stretch fabric is great for everyday wear.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000007', rating: 5, comment: 'Very comfortable for long runs. The mesh upper keeps feet cool. Highly recommended.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000008', rating: 4, comment: 'Beautiful bag. The leather quality is good and the strap is adjustable. Fits all essentials.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000009', rating: 5, comment: 'Solid construction and heats evenly. Easy to clean. Perfect cookware set for a family.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000010', rating: 4, comment: 'Good quality bamboo. The three sizes are very practical for different cutting tasks.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000011', rating: 5, comment: 'Perfect for studying late at night. The USB charging port is really convenient.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000012', rating: 5, comment: 'Great quality bands. All 5 resistance levels are clearly color-coded and very durable.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000013', rating: 4, comment: 'Solid dumbbell. The weight adjustment is smooth and the grip is comfortable.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000015', rating: 5, comment: 'My skin looks brighter after just 2 weeks! The serum absorbs quickly and doesn\'t feel greasy.' },
  { product_id: 'aaaaaaaa-0000-0000-0000-000000000020', rating: 5, comment: 'Very precise measurements. The digital display is clear and the build quality is excellent.' },
];

export async function run(supabase) {
  const reviews = REVIEWS.map((r, i) => ({
    id: `cccccccc-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
    user_id: BUYER_ID,
    product_id: r.product_id,
    rating: r.rating,
    comment: r.comment,
    helpful_count: Math.floor(Math.random() * 20),
    status: 'published',
  }));

  const { error } = await supabase
    .from('reviews')
    .upsert(reviews, { onConflict: 'id' });

  if (error) throw new Error(`reviews seed failed: ${error.message}`);

  console.log(`  ✔ Seeded: ${reviews.length} reviews`);
}
