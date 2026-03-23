-- Social Authentication columns for the profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Unique constraints (allow NULL for users who haven't linked that provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_facebook_id ON profiles(facebook_id) WHERE facebook_id IS NOT NULL;
