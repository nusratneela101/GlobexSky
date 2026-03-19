/**
 * Seed 003: Orders
 * Inserts 10 sample orders in various statuses.
 * Depends on: 001_seed_users.js, 002_seed_products.js
 */

const BUYER_ID    = '00000000-0000-0000-0000-000000000002';
const SUPPLIER_ID = '00000000-0000-0000-0000-000000000101'; // supplier_profiles.id

const PRODUCT_IDS = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000012',
  'aaaaaaaa-0000-0000-0000-000000000015',
];

export async function run(supabase) {
  const now = new Date();

  const orders = [
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000001',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'delivered',
      subtotal: 299.90,
      shipping_fee: 15.00,
      commission: 15.00,
      total: 329.90,
      payment_method: 'card',
      payment_status: 'paid',
      tracking_number: 'GS-TRK-0001',
      created_at: new Date(now - 30 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000002',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'shipped',
      subtotal: 45.00,
      shipping_fee: 8.00,
      commission: 2.25,
      total: 55.25,
      payment_method: 'bkash',
      payment_status: 'paid',
      tracking_number: 'GS-TRK-0002',
      created_at: new Date(now - 10 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000003',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'processing',
      subtotal: 120.00,
      shipping_fee: 12.00,
      commission: 6.00,
      total: 138.00,
      payment_method: 'nagad',
      payment_status: 'paid',
      created_at: new Date(now - 5 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000004',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'confirmed',
      subtotal: 55.00,
      shipping_fee: 10.00,
      commission: 2.75,
      total: 67.75,
      payment_method: 'sslcommerz',
      payment_status: 'paid',
      created_at: new Date(now - 3 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000005',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'pending',
      subtotal: 99.99,
      shipping_fee: 8.00,
      commission: 5.00,
      total: 112.99,
      payment_method: 'cod',
      payment_status: 'pending',
      created_at: new Date(now - 1 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000006',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'cancelled',
      subtotal: 75.00,
      shipping_fee: 0,
      commission: 0,
      total: 75.00,
      payment_method: 'card',
      payment_status: 'refunded',
      created_at: new Date(now - 20 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000007',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'refunded',
      subtotal: 30.00,
      shipping_fee: 5.00,
      commission: 1.50,
      total: 36.50,
      payment_method: 'bkash',
      payment_status: 'refunded',
      created_at: new Date(now - 15 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000008',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'delivered',
      subtotal: 200.00,
      shipping_fee: 20.00,
      commission: 10.00,
      total: 230.00,
      payment_method: 'card',
      payment_status: 'paid',
      tracking_number: 'GS-TRK-0008',
      created_at: new Date(now - 45 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000009',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'processing',
      subtotal: 48.00,
      shipping_fee: 8.00,
      commission: 2.40,
      total: 58.40,
      payment_method: 'sslcommerz',
      payment_status: 'paid',
      created_at: new Date(now - 4 * 86400000).toISOString(),
    },
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000010',
      buyer_id: BUYER_ID,
      supplier_id: SUPPLIER_ID,
      status: 'pending',
      subtotal: 180.00,
      shipping_fee: 18.00,
      commission: 9.00,
      total: 207.00,
      payment_method: 'card',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    },
  ];

  const { error: orderError } = await supabase
    .from('orders')
    .upsert(orders, { onConflict: 'id' });

  if (orderError) throw new Error(`orders seed failed: ${orderError.message}`);

  // Order items for a representative set of orders
  const orderItems = [
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000001', product_id: PRODUCT_IDS[0], quantity: 10, unit_price: 29.99, total: 299.90 },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000002', product_id: PRODUCT_IDS[1], quantity: 1,  unit_price: 45.00, total: 45.00  },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000003', product_id: PRODUCT_IDS[2], quantity: 10, unit_price: 12.00, total: 120.00 },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000004', product_id: PRODUCT_IDS[1], quantity: 1,  unit_price: 45.00, total: 45.00  },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000004', product_id: PRODUCT_IDS[4], quantity: 1,  unit_price: 11.00, total: 11.00  },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000005', product_id: PRODUCT_IDS[3], quantity: 10, unit_price: 9.99,  total: 99.90  },
    { order_id: 'bbbbbbbb-0000-0000-0000-000000000010', product_id: PRODUCT_IDS[0], quantity: 6,  unit_price: 29.99, total: 179.94 },
  ];

  const { error: itemError } = await supabase
    .from('order_items')
    .upsert(orderItems, { onConflict: 'id' });

  if (itemError) throw new Error(`order_items seed failed: ${itemError.message}`);

  console.log(`  ✔ Seeded: ${orders.length} orders, ${orderItems.length} order items`);
}
