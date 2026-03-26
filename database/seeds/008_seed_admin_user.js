/**
 * Seed 008: Default Admin User
 *
 * Creates a default admin account in the `users` table.
 * A bcrypt-hashed password is stored in `password_hash`.
 *
 * Idempotent: INSERT … ON CONFLICT DO NOTHING means re-running
 * this seed is safe and will never overwrite a password that was
 * changed through the application.
 *
 * IMPORTANT: Change the default password immediately after first login.
 */

import bcrypt from 'bcryptjs';

const ADMIN_ID    = '00000000-0000-0000-0000-000000000099';
const ADMIN_EMAIL = 'admin@globexsky.com';
// Default password — must be rotated on first login.
const ADMIN_PASSWORD = 'Admin@GlobexSky#Change!';

export async function run(supabase) {
  // Hash the default password with bcrypt (cost factor 12)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Insert into the `users` table (application-level users, not auth.users)
  const { error: userError } = await supabase
    .from('users')
    .upsert(
      [
        {
          id:               ADMIN_ID,
          email:            ADMIN_EMAIL,
          password_hash:    passwordHash,
          role:             'admin',
          status:           'active',
          email_verified:   true,
        },
      ],
      { onConflict: 'id', ignoreDuplicates: true },
    );

  if (userError) throw new Error(`users seed (admin) failed: ${userError.message}`);

  // Insert matching profile row (some queries join on profiles)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      [
        {
          user_id:             ADMIN_ID,
          full_name:           'GlobexSky Administrator',
          role:                'admin',
          verification_status: 'verified',
          company_name:        'Globex International Trade Co., Ltd.',
          phone:               '+8801700000099',
          language:            'en',
          currency:            'USD',
          timezone:            'UTC',
        },
      ],
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (profileError) throw new Error(`profiles seed (admin) failed: ${profileError.message}`);

  console.log(`  ✔ Seeded: default admin user (${ADMIN_EMAIL})`);
  console.log('  ⚠  Remember to change the default admin password after first login!');
}
