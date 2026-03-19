/**
 * Welcome SMS template.
 * @param {Object} vars
 * @param {string} vars.userName - User's name
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function welcomeTemplate({ userName, platformName = 'GlobexSky' }) {
  return `[${platformName}] Welcome, ${userName}! Your account is ready. Start exploring global suppliers at globexsky.com. Happy trading!`;
}
