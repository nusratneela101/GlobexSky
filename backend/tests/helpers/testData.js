/**
 * Sample test fixtures: users, products, orders, reviews.
 */

export const testUsers = {
  buyer: {
    id: 'buyer-uuid-001',
    email: 'buyer@test.com',
    name: 'Test Buyer',
    role: 'buyer',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  supplier: {
    id: 'supplier-uuid-001',
    email: 'supplier@test.com',
    name: 'Test Supplier',
    role: 'supplier',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  admin: {
    id: 'admin-uuid-001',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin',
    created_at: '2024-01-01T00:00:00.000Z',
  },
};

export const testProducts = [
  {
    id: 'product-uuid-001',
    title: 'Test Product A',
    price: 99.99,
    category_id: 'category-uuid-001',
    supplier_id: 'supplier-uuid-001',
    stock: 100,
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'product-uuid-002',
    title: 'Test Product B',
    price: 49.50,
    category_id: 'category-uuid-002',
    supplier_id: 'supplier-uuid-001',
    stock: 50,
    status: 'active',
    created_at: '2024-01-02T00:00:00.000Z',
  },
];

export const testOrders = [
  {
    id: 'order-uuid-001',
    buyer_id: 'buyer-uuid-001',
    status: 'pending',
    total: 199.98,
    items: [
      { product_id: 'product-uuid-001', quantity: 2, unit_price: 99.99 },
    ],
    shipping_address_id: 'address-uuid-001',
    created_at: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'order-uuid-002',
    buyer_id: 'buyer-uuid-001',
    status: 'delivered',
    total: 49.50,
    items: [
      { product_id: 'product-uuid-002', quantity: 1, unit_price: 49.50 },
    ],
    shipping_address_id: 'address-uuid-001',
    created_at: '2024-01-15T00:00:00.000Z',
  },
];

export const testReviews = [
  {
    id: 'review-uuid-001',
    product_id: 'product-uuid-001',
    user_id: 'buyer-uuid-001',
    rating: 5,
    comment: 'Excellent product! Highly recommended.',
    helpful_count: 3,
    created_at: '2024-01-20T00:00:00.000Z',
  },
  {
    id: 'review-uuid-002',
    product_id: 'product-uuid-001',
    user_id: 'buyer-uuid-001',
    rating: 3,
    comment: 'Decent quality, average delivery time.',
    helpful_count: 1,
    created_at: '2024-01-22T00:00:00.000Z',
  },
];

export const testCategories = [
  { id: 'category-uuid-001', name: 'Electronics', slug: 'electronics' },
  { id: 'category-uuid-002', name: 'Apparel', slug: 'apparel' },
];

export const testAddress = {
  id: 'address-uuid-001',
  user_id: 'buyer-uuid-001',
  name: 'Home',
  line1: '123 Test Street',
  city: 'Test City',
  country: 'US',
  postal_code: '10001',
};

export const testCart = {
  id: 'cart-uuid-001',
  user_id: 'buyer-uuid-001',
  items: [
    { id: 'cart-item-001', product_id: 'product-uuid-001', quantity: 2, unit_price: 99.99 },
  ],
};
