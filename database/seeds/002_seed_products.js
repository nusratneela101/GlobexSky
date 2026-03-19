/**
 * Seed 002: Products
 * Inserts 20 sample products across multiple categories.
 *
 * Dependency note: This seed requires categories to already exist in the database.
 * If you are running seeds selectively (not via the full runner), execute
 * 005_seed_categories.js first:
 *   node database/seed.js --file 005_seed_categories
 *   node database/seed.js --file 002_seed_products
 * The full runner (node database/seed.js) runs all seeds in numeric order, so
 * categories will not yet exist when this file runs. In that case run categories
 * as a prerequisite before seeding products in a fresh database.
 */

const SUPPLIER_PROFILE_ID = '00000000-0000-0000-0000-000000000101'; // seeded supplier_profiles.id

// Category slugs mapped to IDs (from 005_seed_categories.js)
const CAT = {
  electronics: '11111111-1111-1111-1111-111111111101',
  fashion:     '11111111-1111-1111-1111-111111111102',
  home:        '11111111-1111-1111-1111-111111111103',
  sports:      '11111111-1111-1111-1111-111111111104',
  beauty:      '11111111-1111-1111-1111-111111111105',
  industrial:  '11111111-1111-1111-1111-111111111106',
};

export async function run(supabase) {
  const products = [
    // Electronics
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Wireless Bluetooth Earbuds Pro',
      slug: 'wireless-bluetooth-earbuds-pro',
      description: 'Premium wireless earbuds with active noise cancellation and 30h battery.',
      price: 29.99,
      moq: 10,
      stock: 500,
      category_id: CAT.electronics,
      status: 'active',
      featured: true,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Smart Watch Fitness Tracker',
      slug: 'smart-watch-fitness-tracker',
      description: 'Multi-function smartwatch with heart rate monitor, GPS, and waterproof design.',
      price: 45.00,
      moq: 5,
      stock: 300,
      category_id: CAT.electronics,
      status: 'active',
      featured: true,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000003',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'USB-C Fast Charging Cable 3-Pack',
      slug: 'usb-c-fast-charging-cable-3pack',
      description: '6ft braided nylon USB-C cable supporting 100W fast charging.',
      price: 8.50,
      moq: 50,
      stock: 2000,
      category_id: CAT.electronics,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000004',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Portable Power Bank 20000mAh',
      slug: 'portable-power-bank-20000mah',
      description: 'Slim design power bank with dual USB-A and USB-C output.',
      price: 22.00,
      moq: 20,
      stock: 800,
      category_id: CAT.electronics,
      status: 'active',
      trending: true,
    },
    // Fashion
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000005',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Men\'s Classic Oxford Shirt',
      slug: 'mens-classic-oxford-shirt',
      description: '100% cotton Oxford fabric shirt available in multiple colors.',
      price: 12.00,
      moq: 100,
      stock: 1500,
      category_id: CAT.fashion,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000006',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Women\'s Slim-Fit Jeans',
      slug: 'womens-slim-fit-jeans',
      description: 'Stretch denim jeans with high waist and ankle-length cut.',
      price: 15.50,
      moq: 50,
      stock: 1200,
      category_id: CAT.fashion,
      status: 'active',
      trending: true,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000007',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Unisex Running Sneakers',
      slug: 'unisex-running-sneakers',
      description: 'Lightweight breathable mesh sneakers for running and casual wear.',
      price: 18.00,
      moq: 30,
      stock: 900,
      category_id: CAT.fashion,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000008',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Leather Crossbody Bag',
      slug: 'leather-crossbody-bag',
      description: 'Genuine leather crossbody bag with adjustable strap.',
      price: 25.00,
      moq: 20,
      stock: 400,
      category_id: CAT.fashion,
      status: 'active',
      featured: true,
    },
    // Home & Garden
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000009',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Stainless Steel Cookware Set (5-Piece)',
      slug: 'stainless-steel-cookware-set-5pc',
      description: 'Professional-grade cookware set compatible with all hob types.',
      price: 55.00,
      moq: 10,
      stock: 200,
      category_id: CAT.home,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000010',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Bamboo Cutting Board Set',
      slug: 'bamboo-cutting-board-set',
      description: 'Eco-friendly bamboo cutting boards, set of 3 sizes.',
      price: 14.00,
      moq: 30,
      stock: 600,
      category_id: CAT.home,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000011',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'LED Desk Lamp with USB Port',
      slug: 'led-desk-lamp-usb-port',
      description: 'Adjustable LED desk lamp with built-in USB charging port and eye-care mode.',
      price: 19.00,
      moq: 20,
      stock: 700,
      category_id: CAT.home,
      status: 'active',
      trending: true,
    },
    // Sports
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000012',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Resistance Bands Set (5 Levels)',
      slug: 'resistance-bands-set-5-levels',
      description: 'Latex resistance bands for strength training and physiotherapy.',
      price: 9.99,
      moq: 50,
      stock: 1000,
      category_id: CAT.sports,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000013',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Adjustable Dumbbell 20kg',
      slug: 'adjustable-dumbbell-20kg',
      description: 'Space-saving adjustable dumbbell replaces 15 weight sets.',
      price: 75.00,
      moq: 5,
      stock: 150,
      category_id: CAT.sports,
      status: 'active',
      featured: true,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000014',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Yoga Mat Non-Slip 6mm',
      slug: 'yoga-mat-non-slip-6mm',
      description: 'Eco-friendly TPE yoga mat with alignment lines and carrying strap.',
      price: 16.00,
      moq: 30,
      stock: 800,
      category_id: CAT.sports,
      status: 'active',
    },
    // Beauty
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000015',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Vitamin C Serum 30ml',
      slug: 'vitamin-c-serum-30ml',
      description: '20% Vitamin C serum with hyaluronic acid for brightening and anti-aging.',
      price: 11.00,
      moq: 100,
      stock: 2000,
      category_id: CAT.beauty,
      status: 'active',
      trending: true,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000016',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Electric Facial Cleansing Brush',
      slug: 'electric-facial-cleansing-brush',
      description: 'Sonic vibration facial cleansing brush with 3 speed settings.',
      price: 14.50,
      moq: 50,
      stock: 600,
      category_id: CAT.beauty,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000017',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Matte Lipstick 12-Color Set',
      slug: 'matte-lipstick-12-color-set',
      description: 'Long-lasting matte lipstick collection with moisturizing formula.',
      price: 18.00,
      moq: 30,
      stock: 500,
      category_id: CAT.beauty,
      status: 'active',
    },
    // Industrial
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000018',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Industrial Safety Helmet',
      slug: 'industrial-safety-helmet',
      description: 'CE-certified ABS hard hat with adjustable suspension system.',
      price: 6.00,
      moq: 200,
      stock: 3000,
      category_id: CAT.industrial,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000019',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Heavy-Duty Work Gloves (12-Pair)',
      slug: 'heavy-duty-work-gloves-12pair',
      description: 'Cut-resistant leather palm work gloves for industrial use.',
      price: 15.00,
      moq: 100,
      stock: 2000,
      category_id: CAT.industrial,
      status: 'active',
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000020',
      supplier_id: SUPPLIER_PROFILE_ID,
      title: 'Digital Vernier Caliper 150mm',
      slug: 'digital-vernier-caliper-150mm',
      description: 'Stainless steel digital caliper with 0.01mm accuracy and LCD display.',
      price: 12.00,
      moq: 20,
      stock: 800,
      category_id: CAT.industrial,
      status: 'active',
      featured: true,
    },
  ];

  const { error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'id' });

  if (error) throw new Error(`products seed failed: ${error.message}`);

  console.log(`  ✔ Seeded: ${products.length} products`);
}
