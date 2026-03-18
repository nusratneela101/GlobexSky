import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants.js';

/**
 * Return Supabase range values (from, to) for pagination.
 * @param {number|string} page  - 1-based page number
 * @param {number|string} limit - items per page
 */
export function buildPagination(page = 1, limit = DEFAULT_PAGE_SIZE) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  const from = (p - 1) * l;
  const to = from + l - 1;
  return { from, to, page: p, limit: l };
}

/**
 * Build a pagination meta object for API responses.
 */
export function buildMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return { total, page, limit, total_pages: totalPages, has_next: page < totalPages, has_prev: page > 1 };
}
