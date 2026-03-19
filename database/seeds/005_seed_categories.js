/**
 * Seed 005: Categories
 * Inserts product categories with parent-child hierarchy.
 */

export async function run(supabase) {
  const categories = [
    // Top-level categories
    { id: '11111111-1111-1111-1111-111111111101', name: 'Electronics',    slug: 'electronics',    sort_order: 1 },
    { id: '11111111-1111-1111-1111-111111111102', name: 'Fashion',        slug: 'fashion',        sort_order: 2 },
    { id: '11111111-1111-1111-1111-111111111103', name: 'Home & Garden',  slug: 'home-garden',    sort_order: 3 },
    { id: '11111111-1111-1111-1111-111111111104', name: 'Sports',         slug: 'sports',         sort_order: 4 },
    { id: '11111111-1111-1111-1111-111111111105', name: 'Beauty',         slug: 'beauty',         sort_order: 5 },
    { id: '11111111-1111-1111-1111-111111111106', name: 'Industrial',     slug: 'industrial',     sort_order: 6 },
    { id: '11111111-1111-1111-1111-111111111107', name: 'Food & Grocery', slug: 'food-grocery',   sort_order: 7 },
    { id: '11111111-1111-1111-1111-111111111108', name: 'Automotive',     slug: 'automotive',     sort_order: 8 },
    { id: '11111111-1111-1111-1111-111111111109', name: 'Toys & Kids',    slug: 'toys-kids',      sort_order: 9 },
    { id: '11111111-1111-1111-1111-111111111110', name: 'Office & School', slug: 'office-school', sort_order: 10 },

    // Electronics sub-categories
    { id: '22222222-2222-2222-2222-222222222201', name: 'Smartphones',       slug: 'smartphones',        parent_id: '11111111-1111-1111-1111-111111111101', sort_order: 1 },
    { id: '22222222-2222-2222-2222-222222222202', name: 'Audio',             slug: 'audio',              parent_id: '11111111-1111-1111-1111-111111111101', sort_order: 2 },
    { id: '22222222-2222-2222-2222-222222222203', name: 'Wearables',         slug: 'wearables',          parent_id: '11111111-1111-1111-1111-111111111101', sort_order: 3 },
    { id: '22222222-2222-2222-2222-222222222204', name: 'Laptops & PCs',     slug: 'laptops-pcs',        parent_id: '11111111-1111-1111-1111-111111111101', sort_order: 4 },
    { id: '22222222-2222-2222-2222-222222222205', name: 'Accessories',       slug: 'electronics-accessories', parent_id: '11111111-1111-1111-1111-111111111101', sort_order: 5 },

    // Fashion sub-categories
    { id: '22222222-2222-2222-2222-222222222206', name: "Men's Clothing",    slug: 'mens-clothing',      parent_id: '11111111-1111-1111-1111-111111111102', sort_order: 1 },
    { id: '22222222-2222-2222-2222-222222222207', name: "Women's Clothing",  slug: 'womens-clothing',    parent_id: '11111111-1111-1111-1111-111111111102', sort_order: 2 },
    { id: '22222222-2222-2222-2222-222222222208', name: 'Shoes',             slug: 'shoes',              parent_id: '11111111-1111-1111-1111-111111111102', sort_order: 3 },
    { id: '22222222-2222-2222-2222-222222222209', name: 'Bags & Accessories',slug: 'bags-accessories',   parent_id: '11111111-1111-1111-1111-111111111102', sort_order: 4 },

    // Home & Garden sub-categories
    { id: '22222222-2222-2222-2222-222222222210', name: 'Kitchen & Dining',  slug: 'kitchen-dining',     parent_id: '11111111-1111-1111-1111-111111111103', sort_order: 1 },
    { id: '22222222-2222-2222-2222-222222222211', name: 'Lighting',          slug: 'lighting',           parent_id: '11111111-1111-1111-1111-111111111103', sort_order: 2 },
    { id: '22222222-2222-2222-2222-222222222212', name: 'Furniture',         slug: 'furniture',          parent_id: '11111111-1111-1111-1111-111111111103', sort_order: 3 },

    // Sports sub-categories
    { id: '22222222-2222-2222-2222-222222222213', name: 'Fitness Equipment', slug: 'fitness-equipment',  parent_id: '11111111-1111-1111-1111-111111111104', sort_order: 1 },
    { id: '22222222-2222-2222-2222-222222222214', name: 'Outdoor Sports',    slug: 'outdoor-sports',     parent_id: '11111111-1111-1111-1111-111111111104', sort_order: 2 },
  ];

  const { error } = await supabase
    .from('categories')
    .upsert(categories, { onConflict: 'id' });

  if (error) throw new Error(`categories seed failed: ${error.message}`);

  console.log(`  ✔ Seeded: ${categories.length} categories`);
}
