export const ROLES = {
  ADMIN: 'admin',
  BUYER: 'buyer',
  SUPPLIER: 'supplier',
  CARRIER: 'carrier',
  INSPECTOR: 'inspector',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const PARCEL_STATUS = {
  CREATED: 'created',
  RECEIVED: 'received',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  CUSTOMS: 'customs',
  DELIVERED: 'delivered',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export const TRANSACTION_TYPES = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  PAYOUT: 'payout',
  COMMISSION: 'commission',
  SUBSCRIPTION: 'subscription',
};

export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  BANNED: 'banned',
};

export const INSPECTION_STATUS = {
  REQUESTED: 'requested',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const RFQ_STATUS = {
  OPEN: 'open',
  QUOTED: 'quoted',
  NEGOTIATING: 'negotiating',
  CLOSED: 'closed',
};

export const CAMPAIGN_TYPES = {
  FLASH_SALE: 'flash_sale',
  SEASONAL: 'seasonal',
  CLEARANCE: 'clearance',
  LIMITED: 'limited',
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_CURRENCY = 'USD';
export const PLATFORM_NAME = 'Globex Sky';
export const PLATFORM_EMAIL = 'info@globexsky.com';
