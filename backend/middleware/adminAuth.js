/**
 * Admin Auth Middleware
 * Combines authenticate + requireAdmin into a single reusable middleware array.
 */

import { authenticate } from './auth.js';
import { requireAdmin } from './roleCheck.js';

/** Use as: router.use(...adminAuth) or route.get('/path', ...adminAuth, ctrl) */
export const adminAuth = [authenticate, requireAdmin];
export default adminAuth;
