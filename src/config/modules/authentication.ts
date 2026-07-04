/**
 * Authentication Module — P9.0 / Phase C+G, extended P9.1.2 (Runtime Integration)
 * Replaces hardcoded OTP length / login-attempt / lockout constants that
 * previously lived inline in auth.service.ts.
 *
 * P9.1.2 adds the toggles and session field actually wired into
 * src/services/auth.service.ts, src/lib/rate-limit.ts, and
 * src/services/axios.instance.ts (docs/P9.1.2_RUNTIME_INTEGRATION.md).
 * Defaults below intentionally match the values that were previously
 * hardcoded in those files, so registering them changes nothing about
 * default runtime behavior — only where the value comes from.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const AUTHENTICATION_MODULE: ConfigModuleDefinition = {
  id: 'authentication',
  name: 'Authentication',
  description: 'Phone/OTP login rules, registration policy, and account lockout thresholds.',
  category: 'security',
  version: '1.1.0',
  icon: 'ShieldCheck',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'authentication.core',
      title: 'Core Toggles',
      fields: [
        defineField({
          id: 'authentication.enabled',
          title: 'Authentication Enabled',
          description: 'Platform-wide kill switch for all login/registration/OTP entry points.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: false },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.phone_login_enabled',
          title: 'Phone Login Enabled',
          description: 'Platform-owned in P9.1.2: auth.service.ts is a plain service module with no tenant-context threading today, so this resolves at platform scope only. Tenant-level override is schema-ready (docs/P9.1.1_AUTH_CONFIGURATION_SCHEMA.md proposed it tenant-owned) but requires threading a tenant scope through auth.service.ts first — tracked as remaining work in docs/P9.1.2_RUNTIME_INTEGRATION.md.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.email_login_enabled',
          title: 'Email Login Enabled',
          description: 'Platform-owned in P9.1.2 for the same reason as phone_login_enabled above — see that field\'s description.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.guest_checkout_enabled',
          title: 'Guest Checkout Enabled',
          description: 'Registered for future checkout-flow integration — no runtime consumer yet (checkout has no auth gate to attach it to today). Platform-owned for the same reason as phone_login_enabled above.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
    {
      id: 'authentication.otp',
      title: 'OTP',
      fields: [
        defineField({
          id: 'authentication.otp.enabled',
          title: 'OTP Login Enabled',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.otp.length',
          title: 'OTP Code Length',
          category: 'security',
          type: 'number',
          default: 6,
          validation: { min: 4, max: 8, required: true },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.otp.ttl_seconds',
          title: 'OTP Expiry (seconds)',
          category: 'security',
          type: 'number',
          default: 300,
          validation: { min: 60, max: 900 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.otp.resend_cooldown_seconds',
          title: 'Resend Cooldown (seconds)',
          category: 'security',
          type: 'number',
          default: 60,
          validation: { min: 15, max: 300 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.otp.max_verify_attempts',
          title: 'Max OTP Verify Attempts',
          description: 'Distinct from authentication.max_login_attempts (password login) — caps guesses against one issued OTP code.',
          category: 'security',
          type: 'number',
          default: 3,
          validation: { min: 1, max: 10 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
    {
      id: 'authentication.lockout',
      title: 'Login Attempts & Lockout',
      fields: [
        defineField({
          id: 'authentication.max_login_attempts',
          title: 'Max Login Attempts',
          category: 'security',
          type: 'number',
          default: 5,
          validation: { min: 3, max: 10, required: true },
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: false },
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.lockout_duration_minutes',
          title: 'Lockout Duration (minutes)',
          category: 'security',
          type: 'number',
          default: 15,
          validation: { min: 1, max: 1440 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.registration_enabled',
          title: 'Self-Service Registration Enabled',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.jwt_access_ttl_minutes',
          title: 'Access Token TTL (minutes)',
          category: 'security',
          type: 'number',
          default: 15,
          validation: { min: 5, max: 120 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.jwt_refresh_ttl_days',
          title: 'Refresh Token Lifetime (days)',
          description: 'Drives the mirrored auth cookie max-age in axios.instance.ts (previously a hardcoded 7-day literal).',
          category: 'security',
          type: 'number',
          default: 7,
          validation: { min: 1, max: 90 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
    {
      id: 'authentication.demo',
      title: 'Demo / Mock',
      fields: [
        defineField({
          id: 'authentication.demo_login_enabled',
          title: 'Demo Login Enabled',
          description: 'Gates whether known demo credentials (MOCK_CREDENTIALS) are honored for login/OTP-verify, distinct from mock_authentication_enabled (the broader mock-service switch).',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: false },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.demo_accounts_visible',
          title: 'Demo Accounts Visible in UI',
          description: 'Governs whether the one-click demo account grid renders on the login page, independent of whether demo login works.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'authentication.mock_authentication_enabled',
          title: 'Mock Authentication Enabled',
          description: 'Auditable master switch for the entire mock auth.service.ts branch, layered on top of (never replacing) the NEXT_PUBLIC_USE_MOCK build flag.',
          category: 'security',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: false },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(AUTHENTICATION_MODULE)
