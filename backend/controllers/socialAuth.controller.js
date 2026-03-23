import {
  verifyGoogleToken,
  verifyFacebookToken,
  findOrCreateUser,
  linkAccount,
  unlinkAccount,
} from '../services/socialAuth.service.js';

/** POST /api/v1/auth/google */
export async function googleLogin(req, res, next) {
  try {
    const { id_token } = req.body;
    if (!id_token) {
      return res.status(400).json({ success: false, error: 'id_token is required.' });
    }

    const profile = await verifyGoogleToken(id_token);
    const sessionData = await findOrCreateUser(profile, 'google');

    res.json({ success: true, data: sessionData });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/facebook */
export async function facebookLogin(req, res, next) {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ success: false, error: 'access_token is required.' });
    }

    const profile = await verifyFacebookToken(access_token);
    const sessionData = await findOrCreateUser(profile, 'facebook');

    res.json({ success: true, data: sessionData });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/social/link */
export async function linkSocialAccount(req, res, next) {
  try {
    const { provider, id_token, access_token } = req.body;
    if (!provider || !['google', 'facebook'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'provider must be "google" or "facebook".' });
    }

    let profile;
    if (provider === 'google') {
      if (!id_token) return res.status(400).json({ success: false, error: 'id_token is required for Google.' });
      profile = await verifyGoogleToken(id_token);
    } else {
      if (!access_token) return res.status(400).json({ success: false, error: 'access_token is required for Facebook.' });
      profile = await verifyFacebookToken(access_token);
    }

    await linkAccount(req.user.id, profile, provider);

    res.json({ success: true, message: `${provider} account linked successfully.` });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/auth/social/unlink/:provider */
export async function unlinkSocialAccount(req, res, next) {
  try {
    const { provider } = req.params;
    if (!['google', 'facebook'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'provider must be "google" or "facebook".' });
    }

    await unlinkAccount(req.user.id, provider);

    res.json({ success: true, message: `${provider} account unlinked successfully.` });
  } catch (err) {
    next(err);
  }
}
