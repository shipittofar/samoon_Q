/**
 * Authentication Module — P9.0 / Phase C+G
 * Replaces hardcoded OTP length / login-attempt / lockout constants that
 * previously lived inline in auth.service.ts.
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
  version: '1.0.0',
  icon: 'ShieldCheck',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'authentication.otp',
      title: 'OTP',
      fields: [
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
      ],
    },
  ],
}

platformConfigurationRegistry.register(AUTHENTICATION_MODULE)
