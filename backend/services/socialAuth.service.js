import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import supabase from '../config/supabase.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return the decoded payload.
 * @param {string} idToken
 * @returns {Promise<{sub:string, email:string, name:string, picture:string}>}
 */
export async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Invalid Google ID token.');
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

/**
 * Verify a Facebook access token via the Graph API and return the user profile.
 * @param {string} accessToken
 * @returns {Promise<{id:string, email:string, name:string, picture:string}>}
 */
export async function verifyFacebookToken(accessToken) {
  const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;

  // First, inspect the token to ensure it is valid and belongs to our app
  const debugRes = await axios.get('https://graph.facebook.com/debug_token', {
    params: { input_token: accessToken, access_token: appToken },
  });

  const debugData = debugRes.data?.data;
  if (!debugData?.is_valid) throw new Error('Invalid Facebook access token.');
  if (String(debugData.app_id) !== String(process.env.FACEBOOK_APP_ID)) {
    throw new Error('Facebook token does not belong to this application.');
  }

  // Fetch user profile
  const profileRes = await axios.get('https://graph.facebook.com/me', {
    params: {
      access_token: accessToken,
      fields: 'id,name,email,picture.type(large)',
    },
  });

  const profile = profileRes.data;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture?.data?.url,
  };
}

/**
 * Find an existing user by social provider ID or email, or create a new one.
 * @param {{ id:string, email:string, name:string, picture:string }} profile
 * @param {'google'|'facebook'} provider
 * @returns {Promise<{ user: object, session: object }>}
 */
export async function findOrCreateUser(profile, provider) {
  const providerIdField = provider === 'google' ? 'google_id' : 'facebook_id';
  const providerId = profile.sub ?? profile.id;

  // 1. Look up by provider ID in the profiles table
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq(providerIdField, providerId)
    .maybeSingle();

  if (existingProfile) {
    // Sign in as this user using the admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(existingProfile.user_id);
    if (userError || !userData?.user) throw new Error('User lookup failed.');

    return _buildResponse(userData.user);
  }

  // 2. Look up by email using the admin API
  if (profile.email) {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const matchedUser = listData?.users?.find(u => u.email === profile.email);

    if (matchedUser) {
      // Link this social account to the existing user (preserve original auth_provider)
      await supabase.from('profiles').update({
        [providerIdField]: providerId,
        avatar_url: profile.picture || null,
      }).eq('user_id', matchedUser.id);

      return _buildResponse(matchedUser);
    }
  }

  // 3. Create a new user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: profile.email,
    email_confirm: true,
    user_metadata: {
      full_name: profile.name,
      avatar_url: profile.picture,
      [providerIdField]: providerId,
      auth_provider: provider,
    },
  });
  if (createError) throw new Error('Failed to create user: ' + createError.message);

  // Create profile record
  await supabase.from('profiles').insert({
    user_id: newUser.user.id,
    full_name: profile.name,
    [providerIdField]: providerId,
    auth_provider: provider,
    avatar_url: profile.picture || null,
    role: 'buyer',
  });

  return _buildResponse(newUser.user);
}

/**
 * Link a social account to an existing user.
 * @param {string} userId
 * @param {{ id:string, sub:string, email:string, name:string, picture:string }} profile
 * @param {'google'|'facebook'} provider
 */
export async function linkAccount(userId, profile, provider) {
  const providerIdField = provider === 'google' ? 'google_id' : 'facebook_id';
  const providerId = profile.sub ?? profile.id;

  // Ensure no other account already uses this social ID
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq(providerIdField, providerId)
    .maybeSingle();

  if (existing && existing.user_id !== userId) {
    throw new Error(`This ${provider} account is already linked to another user.`);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ [providerIdField]: providerId })
    .eq('user_id', userId);

  if (error) throw new Error('Failed to link account: ' + error.message);
}

/**
 * Unlink a social account from a user.
 * @param {string} userId
 * @param {'google'|'facebook'} provider
 */
export async function unlinkAccount(userId, provider) {
  const providerIdField = provider === 'google' ? 'google_id' : 'facebook_id';

  const { error } = await supabase
    .from('profiles')
    .update({ [providerIdField]: null })
    .eq('user_id', userId);

  if (error) throw new Error('Failed to unlink account: ' + error.message);
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Build a session response for a given Supabase user using admin token generation.
 * @param {object} user - Supabase auth user object
 * @returns {{ user: object, token: string, refresh_token: string }}
 */
async function _buildResponse(user) {
  // Generate a short-lived link and extract the token
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: { redirectTo: process.env.FRONTEND_URL },
  });

  if (linkError) throw new Error('Could not generate auth token: ' + linkError.message);

  // Verify the OTP token from the link to get a real session
  const url = new URL(linkData.properties.action_link);
  const tokenHash = url.searchParams.get('token_hash');

  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (sessionError || !sessionData?.session) {
    throw new Error('Could not establish session: ' + (sessionError?.message ?? 'no session returned'));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return {
    token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    user: { ...user, profile },
  };
}
