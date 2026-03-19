/**
 * Shipment update SMS template.
 * @param {Object} vars
 * @param {string} vars.trackingNumber - Shipment tracking number
 * @param {string} vars.status - Current shipment status
 * @param {string} [vars.location] - Current location of shipment
 * @param {string} [vars.platformName] - Platform name
 * @returns {string}
 */
export default function shipmentUpdateTemplate({ trackingNumber, status, location, platformName = 'GlobexSky' }) {
  const locationPart = location ? ` Location: ${location}.` : '';
  return `[${platformName}] Shipment ${trackingNumber}: ${status}.${locationPart} Track at globexsky.com/track`;
}
