/**
 * P8.9.1 — Post-login redirect destinations.
 *
 * Pure utility — no React, no hooks. Kept separate so redirect logic
 * can be unit-tested without mounting the login page.
 */

/** Maps demo account email → the frontend route the user should land on after login. */
export const DEMO_EMAIL_REDIRECTS: Record<string, string> = {
  'demo@savor.com':      '/dashboard',
  'staff@savor.com':     '/admin/orders',
  'cashier@savor.com':   '/admin/orders',
  'kitchen@savor.com':   '/admin/kitchen',
  'marketing@savor.com': '/admin/analytics',
  'support@savor.com':   '/admin/customers',
  'admin@savor.com':     '/admin',
  'owner@savor.com':     '/admin',
  'platform@savor.com':  '/admin/tenants',
  'multirole@savor.com': '/admin/orders',
}

/**
 * Returns the post-login destination for a demo account email.
 * Falls back to /admin for any unmapped email.
 */
export function getDemoRedirect(email: string): string {
  return DEMO_EMAIL_REDIRECTS[email] ?? '/admin'
}

/**
 * Returns the post-login destination for a real (non-demo) user based on their role.
 * Customer → /dashboard; staff/admin → /admin.
 */
export function getPostLoginRedirect(role: string): string {
  return role === 'customer' ? '/dashboard' : '/admin'
}
