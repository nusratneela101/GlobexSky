/**
 * Seed 006: Shipping Rates
 * Inserts shipping rate tiers by destination country and weight range.
 */

export async function run(supabase) {
  const shippingRates = [
    // UAE
    { destination_country: 'AE', min_weight: 0,   max_weight: 5,   price_per_kg: 4.50, base_fee: 8,  express_fee: 15, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5,  estimated_days_max: 10 },
    { destination_country: 'AE', min_weight: 5,   max_weight: 20,  price_per_kg: 4.00, base_fee: 8,  express_fee: 15, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 5,  estimated_days_max: 10 },
    { destination_country: 'AE', min_weight: 20,  max_weight: 999, price_per_kg: 3.50, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 5,  estimated_days_max: 10 },

    // United States
    { destination_country: 'US', min_weight: 0,   max_weight: 5,   price_per_kg: 7.00, base_fee: 12, express_fee: 25, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },
    { destination_country: 'US', min_weight: 5,   max_weight: 20,  price_per_kg: 6.50, base_fee: 12, express_fee: 25, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },
    { destination_country: 'US', min_weight: 20,  max_weight: 999, price_per_kg: 5.50, base_fee: 15, express_fee: 30, fragile_fee: 6, insurance_percentage: 2, estimated_days_min: 12, estimated_days_max: 22 },

    // United Kingdom
    { destination_country: 'GB', min_weight: 0,   max_weight: 5,   price_per_kg: 6.00, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8,  estimated_days_max: 15 },
    { destination_country: 'GB', min_weight: 5,   max_weight: 20,  price_per_kg: 5.50, base_fee: 10, express_fee: 20, fragile_fee: 4, insurance_percentage: 1, estimated_days_min: 8,  estimated_days_max: 15 },
    { destination_country: 'GB', min_weight: 20,  max_weight: 999, price_per_kg: 5.00, base_fee: 12, express_fee: 25, fragile_fee: 5, insurance_percentage: 1, estimated_days_min: 10, estimated_days_max: 18 },

    // China (return shipping)
    { destination_country: 'CN', min_weight: 0,   max_weight: 5,   price_per_kg: 3.00, base_fee: 5,  express_fee: 10, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3,  estimated_days_max: 7  },
    { destination_country: 'CN', min_weight: 5,   max_weight: 999, price_per_kg: 2.50, base_fee: 5,  express_fee: 10, fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3,  estimated_days_max: 7  },

    // Canada
    { destination_country: 'CA', min_weight: 0,   max_weight: 5,   price_per_kg: 7.50, base_fee: 12, express_fee: 25, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },
    { destination_country: 'CA', min_weight: 5,   max_weight: 999, price_per_kg: 7.00, base_fee: 12, express_fee: 25, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 20 },

    // Australia
    { destination_country: 'AU', min_weight: 0,   max_weight: 5,   price_per_kg: 8.00, base_fee: 14, express_fee: 28, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },
    { destination_country: 'AU', min_weight: 5,   max_weight: 999, price_per_kg: 7.50, base_fee: 14, express_fee: 28, fragile_fee: 5, insurance_percentage: 2, estimated_days_min: 10, estimated_days_max: 18 },

    // Bangladesh
    { destination_country: 'BD', min_weight: 0,   max_weight: 5,   price_per_kg: 2.50, base_fee: 4,  express_fee: 8,  fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3,  estimated_days_max: 7  },
    { destination_country: 'BD', min_weight: 5,   max_weight: 999, price_per_kg: 2.00, base_fee: 4,  express_fee: 8,  fragile_fee: 2, insurance_percentage: 1, estimated_days_min: 3,  estimated_days_max: 7  },

    // India
    { destination_country: 'IN', min_weight: 0,   max_weight: 5,   price_per_kg: 3.50, base_fee: 6,  express_fee: 12, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 4,  estimated_days_max: 10 },
    { destination_country: 'IN', min_weight: 5,   max_weight: 999, price_per_kg: 3.00, base_fee: 6,  express_fee: 12, fragile_fee: 3, insurance_percentage: 1, estimated_days_min: 4,  estimated_days_max: 10 },

    // Rest of World (catch-all)
    { destination_country: '*', min_weight: 0, max_weight: 999, price_per_kg: 8.00, base_fee: 15, express_fee: 30, fragile_fee: 6, insurance_percentage: 2, estimated_days_min: 14, estimated_days_max: 30 },
  ];

  const { error } = await supabase
    .from('shipping_rates')
    .upsert(shippingRates, { onConflict: 'id' });

  if (error) throw new Error(`shipping_rates seed failed: ${error.message}`);

  // Also seed carry rates
  const carryRates = [
    { product_category: 'electronics',    name: 'Electronics',        payment_per_kg: 12, fragile_surcharge: 3, is_active: true },
    { product_category: 'fashion',        name: 'Clothing & Fashion', payment_per_kg: 8,  fragile_surcharge: 1, is_active: true },
    { product_category: 'documents',      name: 'Documents',          payment_per_kg: 5,  fragile_surcharge: 0, is_active: true },
    { product_category: 'general',        name: 'General Goods',      payment_per_kg: 7,  fragile_surcharge: 2, is_active: true },
    { product_category: 'cosmetics',      name: 'Cosmetics & Beauty', payment_per_kg: 10, fragile_surcharge: 2, is_active: true },
    { product_category: 'food',           name: 'Food & Snacks',      payment_per_kg: 6,  fragile_surcharge: 1, is_active: true },
    { product_category: 'jewelry',        name: 'Jewelry & Watches',  payment_per_kg: 20, fragile_surcharge: 5, is_active: true },
    { product_category: 'pharmaceuticals',name: 'Pharmaceuticals',    payment_per_kg: 15, fragile_surcharge: 3, is_active: true },
  ];

  const { error: carryError } = await supabase
    .from('carry_rates')
    .upsert(carryRates, { onConflict: 'id' });

  if (carryError) throw new Error(`carry_rates seed failed: ${carryError.message}`);

  console.log(`  ✔ Seeded: ${shippingRates.length} shipping rates, ${carryRates.length} carry rates`);
}
