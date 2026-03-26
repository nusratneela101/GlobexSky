/**
 * Globex Sky — PushSubscription schema (Supabase)
 *
 * This file documents the push_subscriptions table schema used in Supabase.
 * The actual table is managed through Supabase migrations; this module
 * provides field documentation and a validation helper.
 *
 * Table: push_subscriptions
 * ─────────────────────────────────────────────────────────────────────────────
 * id           uuid          PRIMARY KEY DEFAULT gen_random_uuid()
 * user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
 * endpoint     text          NOT NULL UNIQUE
 * subscription jsonb         NOT NULL   -- Full PushSubscription object (keys, auth)
 * active       boolean       NOT NULL DEFAULT true
 * device_info  text          NULLABLE   -- User-agent or device label
 * created_at   timestamptz   NOT NULL DEFAULT now()
 * updated_at   timestamptz   NOT NULL DEFAULT now()
 *
 * Table: push_notification_preferences
 * ─────────────────────────────────────────────────────────────────────────────
 * id           uuid          PRIMARY KEY DEFAULT gen_random_uuid()
 * user_id      uuid          NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
 * categories   jsonb         NOT NULL DEFAULT '{"orders":true,"messages":true,"shipping":true,"prices":false,"promotions":false}'
 * quiet_hours  jsonb         NOT NULL DEFAULT '{"enabled":false,"start":"22:00","end":"08:00"}'
 * created_at   timestamptz   NOT NULL DEFAULT now()
 * updated_at   timestamptz   NOT NULL DEFAULT now()
 *
 * Table: push_notification_history
 * ─────────────────────────────────────────────────────────────────────────────
 * id           uuid          PRIMARY KEY DEFAULT gen_random_uuid()
 * user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
 * title        text          NOT NULL
 * body         text
 * url          text
 * category     text
 * read         boolean       NOT NULL DEFAULT false
 * sent_at      timestamptz   NOT NULL DEFAULT now()
 * created_at   timestamptz   NOT NULL DEFAULT now()
 */

/**
 * Default notification preferences.
 */
export const DEFAULT_CATEGORIES = {
  orders: true,
  messages: true,
  shipping: true,
  prices: false,
  promotions: false,
};

export const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: '22:00',
  end: '08:00',
};

/**
 * Validate a Web Push subscription object.
 * @param {object} sub - The subscription object from the browser.
 * @returns {boolean}
 */
export function isValidSubscription(sub) {
  return (
    sub &&
    typeof sub === 'object' &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.length > 0 &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

/**
 * Validate notification preference categories.
 * @param {object} categories
 * @returns {object} sanitised categories
 */
export function sanitiseCategories(categories) {
  const allowed = Object.keys(DEFAULT_CATEGORIES);
  const result = { ...DEFAULT_CATEGORIES };
  for (const key of allowed) {
    if (categories && typeof categories[key] === 'boolean') {
      result[key] = categories[key];
    }
  }
  return result;
}

/**
 * Validate quiet hours config.
 * @param {object} qh
 * @returns {object} sanitised quiet hours
 */
export function sanitiseQuietHours(qh) {
  const result = { ...DEFAULT_QUIET_HOURS };
  if (!qh) return result;
  if (typeof qh.enabled === 'boolean') result.enabled = qh.enabled;
  if (typeof qh.start === 'string' && /^\d{2}:\d{2}$/.test(qh.start)) result.start = qh.start;
  if (typeof qh.end   === 'string' && /^\d{2}:\d{2}$/.test(qh.end))   result.end   = qh.end;
  return result;
}
