/**
 * Seed 001: Users
 * Creates sample admin, buyer, supplier, and carrier user profiles.
 *
 * Note: Supabase auth.users must be created via Supabase Auth (dashboard or signUp API).
 *       This seed inserts profile rows using known UUIDs — replace with real auth user IDs
 *       before running against a live project.
 */

export async function run(supabase) {
  const profiles = [
    {
      user_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Admin User',
      role: 'admin',
      verification_status: 'verified',
      company_name: 'GlobexSky HQ',
      phone: '+8801700000001',
      language: 'en',
      currency: 'USD',
      timezone: 'UTC',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Alice Buyer',
      role: 'buyer',
      verification_status: 'verified',
      phone: '+8801700000002',
      language: 'en',
      currency: 'USD',
      timezone: 'Asia/Dhaka',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000003',
      full_name: 'Bob Supplier',
      role: 'supplier',
      verification_status: 'verified',
      company_name: 'Bob Trade Co.',
      phone: '+8801700000003',
      language: 'en',
      currency: 'USD',
      timezone: 'Asia/Shanghai',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000004',
      full_name: 'Carol Carrier',
      role: 'carrier',
      verification_status: 'verified',
      phone: '+8801700000004',
      language: 'en',
      currency: 'USD',
      timezone: 'UTC',
    },
  ];

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profiles, { onConflict: 'user_id' });

  if (profileError) throw new Error(`profiles seed failed: ${profileError.message}`);

  // Sample supplier profile — explicit id so other seed files can reference it
  const { error: supplierError } = await supabase
    .from('supplier_profiles')
    .upsert([
      {
        id: '00000000-0000-0000-0000-000000000101',
        user_id: '00000000-0000-0000-0000-000000000003',
        company_name: 'Bob Trade Co.',
        business_type: 'manufacturer',
        country: 'CN',
        verified: true,
        rating: 4.7,
        response_rate: 95.0,
        on_time_delivery: 97.0,
        membership_tier: 'pro',
        commission_rate: 4.5,
      },
    ], { onConflict: 'user_id' });

  if (supplierError) throw new Error(`supplier_profiles seed failed: ${supplierError.message}`);

  // Sample carrier profile
  const { error: carrierError } = await supabase
    .from('carrier_profiles')
    .upsert([
      {
        user_id: '00000000-0000-0000-0000-000000000004',
        passport_verified: true,
        facial_verified: true,
        total_trips: 12,
        total_earnings: 1500.00,
        success_rate: 100.0,
        rating: 4.9,
      },
    ], { onConflict: 'user_id' });

  if (carrierError) throw new Error(`carrier_profiles seed failed: ${carrierError.message}`);

  console.log('  ✔ Seeded: profiles, supplier_profiles, carrier_profiles');
}
