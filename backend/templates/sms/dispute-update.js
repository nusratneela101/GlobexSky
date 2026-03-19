/**
 * Dispute update SMS template.
 * @param {Object} vars
 * @param {string} vars.disputeId - Dispute ID
 * @param {string} vars.status - New dispute status (e.g. 'opened', 'under review', 'resolved')
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function disputeUpdateTemplate({ disputeId, status, platformName = 'Globex Sky' }) {
  return `[${platformName}] Dispute #${disputeId} update: Status changed to "${status}". Log in to your account for details.`;
}
