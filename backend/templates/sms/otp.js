/**
 * OTP / verification code SMS template.
 * @param {Object} vars
 * @param {string} vars.otp - One-time password code
 * @param {string} vars.expiresIn - Expiry time (e.g. '10 minutes')
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function otpTemplate({ otp, expiresIn = '10 minutes', platformName = 'GlobexSky' }) {
  return `[${platformName}] Your verification code is: ${otp}. Valid for ${expiresIn}. Do not share this code with anyone.`;
}
