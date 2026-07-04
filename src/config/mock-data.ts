/**
 * Platform Configuration Mock Data — P9.0 / Phase G
 *
 * Realistic tenant/branch/user override examples demonstrating the full
 * Platform → Tenant → Branch → User inheritance chain, plus a seed audit
 * trail. This is demo data only — ConfigurationService's live override
 * store starts empty; a settings UI (P9.1+) would call
 * configurationService.updateField() to write real overrides, or a bootstrap
 * step could apply MOCK_CONFIG_OVERRIDES for demo/staging environments.
 */
import { configurationService } from './service'
import type { ConfigResolutionScope, ConfigValueLayer } from './types'

export const MOCK_TENANT_ID = 'tenant-savor-01'
export const MOCK_BRANCH_ID = 'branch-savor-downtown'
export const MOCK_USER_ID = 'pu-001'

/** Example override layers keyed by field id — feeds ConfigurationService in demo/storybook contexts. */
export const MOCK_CONFIG_OVERRIDES: Record<string, ConfigValueLayer> = {
  'themes.primary_color': { tenant: '#0ea5e9' },
  'themes.accent_hover_color': { tenant: '#0284c7' },
  'themes.logo_url': { tenant: 'https://cdn.savor.app/tenants/savor-01/logo.png' },
  'typography.body_font': { tenant: 'Poppins' },
  'languages.default': { tenant: 'en' },
  'countries.default_code': { tenant: 'US' },
  'subscriptions.default_plan_id': { platform: 'growth' },
  'notifications.push_enabled': { branch: false },
  'notifications.default_channels': { tenant: ['push', 'email', 'sms'] },
  'website_builder.custom_domain_enabled': { tenant: true },
  'rbac.default_invite_role': { tenant: 'manager' },
  'api.public_api_enabled': { tenant: true },
  'payments.default_currency': { tenant: 'USD' },
}

export const MOCK_CONFIG_SCOPE: ConfigResolutionScope = {
  tenantId: MOCK_TENANT_ID,
  branchId: MOCK_BRANCH_ID,
  userId: MOCK_USER_ID,
}

/** Seed audit entries illustrating Rule 6 (who/when/old/new/reason) for demo UI. */
export const MOCK_CONFIG_AUDIT_SEED = [
  {
    fieldId: 'themes.primary_color',
    scope: { tenantId: MOCK_TENANT_ID },
    level: 'tenant' as const,
    actorId: 'staff-001',
    actorName: 'Alice Chen',
    reason: 'Rebrand to match new signage',
    previousValue: '#f97316',
    newValue: '#0ea5e9',
  },
  {
    fieldId: 'subscriptions.trial_days',
    scope: {},
    level: 'platform' as const,
    actorId: 'platform-admin-001',
    actorName: 'Savor Platform Team',
    reason: 'Extend trial for Q3 growth promotion',
    previousValue: 14,
    newValue: 21,
  },
]

// ── Authentication Control Center demo state (P9.1.3 / Phase N) ─────────────
//
// Unlike MOCK_CONFIG_OVERRIDES/MOCK_CONFIG_AUDIT_SEED above (static example
// data, never applied automatically), this actually calls
// configurationService.updateField() so the Authentication Console page has
// real "Modified" fields and real audit history to show on first load — the
// phase brief's "this page should feel alive."
//
// Deliberately NOT called from src/config/index.ts's module-registration
// import chain: that file is imported by both the browser app AND the test
// suite (many tests assert default field values, e.g.
// src/test/p9-1-2-runtime-integration.test.ts's rate-limit assertions), so
// auto-seeding on every import would make test defaults nondeterministic.
// Instead, ConfigurationModulePage calls this once, client-side only, from
// a useEffect gated on NEXT_PUBLIC_USE_MOCK — the same pattern already used
// for the login page's demo account grid.
let authenticationMockSeeded = false

export function seedAuthenticationMockOverrides(): void {
  if (authenticationMockSeeded) return
  authenticationMockSeeded = true

  const actor = { id: 'platform-admin-001', name: 'Savor Platform Team' }

  configurationService.updateField({
    fieldId: 'authentication.otp.resend_cooldown_seconds',
    value: 45,
    level: 'platform',
    scope: {},
    actor,
    reason: 'Faster resend for markets with reliable SMS delivery',
  })

  configurationService.updateField({
    fieldId: 'authentication.max_login_attempts',
    value: 7,
    level: 'platform',
    scope: {},
    actor,
    reason: 'Reduce support tickets from customers mistyping their password',
  })

  configurationService.updateField({
    fieldId: 'authentication.guest_checkout_enabled',
    value: false,
    level: 'platform',
    scope: {},
    actor,
    reason: 'Temporarily disabled while investigating a fraud pattern',
  })
}

/** Test-only escape hatch — mirrors the *ForTests() convention elsewhere in src/config. */
export function __resetAuthenticationMockSeedForTests(): void {
  authenticationMockSeeded = false
}
