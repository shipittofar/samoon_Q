/**
 * P8.9.1 — Post-login redirect destinations.
 *
 * Pure utility — no React, no hooks. Kept separate so redirect logic
 * can be unit-tested without mounting the login page.
 */

/**
 * Maps demo phone (E.164) → email, so the mock OTP flow can resolve
 * the correct user from MOCK_CREDENTIALS after OTP verification.
 */
export const DEMO_PHONE_TO_EMAIL: Record<string, string> = {
  '+14155550101': 'demo@savor.com',
  '+14155550102': 'staff@savor.com',
  '+14155550103': 'cashier@savor.com',
  '+14155550104': 'kitchen@savor.com',
  '+14155550105': 'marketing@savor.com',
  '+14155550106': 'support@savor.com',
  '+14155550107': 'admin@savor.com',
  '+14155550108': 'owner@savor.com',
  '+14155550109': 'platform@savor.com',
  '+14155550110': 'multirole@savor.com',
}

/** Maps demo account email → the frontend route the user should land on after login. */
export const DEMO_EMAIL_REDIRECTS: Record<string, string> = {
  'demo@savor.com':      '/dashboard',
  'staff@savor.com':     '/console/orders',
  'cashier@savor.com':   '/console/orders',
  'kitchen@savor.com':   '/console/kitchen',
  'marketing@savor.com': '/console/analytics',
  'support@savor.com':   '/console/customers',
  'admin@savor.com':     '/console',
  'owner@savor.com':     '/console',
  'platform@savor.com':  '/console/tenants',
  'multirole@savor.com': '/console/orders',
}

/**
 * Returns the post-login destination for a demo account email.
 * Falls back to /console for any unmapped email.
 */
export function getDemoRedirect(email: string): string {
  return DEMO_EMAIL_REDIRECTS[email] ?? '/console'
}

/**
 * Returns the post-login destination for a real (non-demo) user based on their role.
 * Customer → /dashboard; staff/console → /admin.
 */
export function getPostLoginRedirect(role: string): string {
  return role === 'customer' ? '/dashboard' : '/console'
}
