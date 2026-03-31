import { ROLES } from '../config/constants.js';

/**
 * Factory: require one of the provided roles.
 * Must be used after authenticate middleware.
 * @param {...string} roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.profile?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }
    next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN, 'super_admin');
export const requireSuperAdmin = requireRole('super_admin');
export const requireSupplier = requireRole(ROLES.SUPPLIER, ROLES.ADMIN);
export const requireCarrier = requireRole(ROLES.CARRIER, ROLES.ADMIN);
export const requireBuyer = requireRole(ROLES.BUYER, ROLES.ADMIN);
export const requireInspector = requireRole(ROLES.INSPECTOR, ROLES.ADMIN);
