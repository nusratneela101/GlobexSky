/**
 * Convert a string to a URL-friendly slug.
 * @param {string} str
 */
export function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')       // spaces/underscores → hyphens
    .replace(/[^\w-]+/g, '')       // remove non-word chars (except hyphens)
    .replace(/--+/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // strip leading/trailing hyphens
}
