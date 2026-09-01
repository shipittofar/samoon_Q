/**
 * Platform Permissions — P9.4 Phase G
 *
 * A permission model for the Platform Administration Center, deliberately
 * SEPARATE from the tenant-scoped RBAC system (`useRbacStore`, `P7Permission`,
 * `usePermissions()` in src/hooks/index.ts) — that system answers "what can
 * this user do inside ONE tenant's console" and stays completely untouched.
 * This module answers a different question: "what can this user do in the
 * Platform Administration Center itself" (across every tenant, and over
 * platform-only resources like billing, infrastructure, and developer
 * tools that have no tenant at all). Two questions, two systems, by design —
 * conflating them would have been the actual duplication to avoid.
 *
 * Every Platform Configuration module (P9.0–P9.3) keeps using its existing
 * `permissions: { view, edit }` keys checked against tenant `P7Permission`s
 * (unchanged, no rewrite). New Platform Administration modules (P9.4)
 * additionally declare a `platformPermission` requirement, checked against
 * the model below.
 */

export type PlatformRole =
  | 'platform_owner'
  | 'platform_super_admin'
  | 'platform_admin'
  | 'platform_support'
  | 'platform_operations'
  | 'platform_finance'
  | 'platform_security'
  | 'platform_developer'
  | 'platform_auditor'
  | 'platform_read_only'

export const PLATFORM_ROLES: readonly PlatformRole[] = [
  'platform_owner',
  'platform_super_admin',
  'platform_admin',
  'platform_support',
  'platform_operations',
  'platform_finance',
  'platform_security',
  'platform_developer',
  'platform_auditor',
  'platform_read_only',
]

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  platform_owner: 'Owner',
  platform_super_admin: 'Super Admin',
  platform_admin: 'Admin',
  platform_support: 'Support',
  platform_operations: 'Operations',
  platform_finance: 'Finance',
  platform_security: 'Security',
  platform_developer: 'Developer',
  platform_auditor: 'Auditor',
  platform_read_only: 'Read Only',
}

/**
 * Dotted `<resource>.<action>` string, e.g. `'platform.billing.manage'`.
 * Deliberately a plain string (not a closed union) — same design choice
 * P7Permission made — so a future module can introduce a new permission
 * key without a framework-level type change.
 */
export type PlatformPermission = string

const ALL = '*'

/**
 * `'*'` means every `<resource>.*` permission is granted. Roles are additive
 * (no deny list) — the platform model is intentionally simpler than the
 * tenant RBAC model (no per-user overrides, no per-branch scoping) because
 * platform staff counts are small and roles map cleanly to job functions.
 */
export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  platform_owner: [ALL],
  platform_super_admin: [ALL],
  platform_admin: [
    'platform.dashboard.view',
    'platform.users.view', 'platform.users.manage',
    'platform.businesses.view', 'platform.businesses.manage',
    'platform.subscriptions.view', 'platform.subscriptions.manage',
    'platform.configuration.view', 'platform.configuration.manage',
    'platform.localization.view', 'platform.localization.manage',
    'platform.security.view',
    'platform.monitoring.view',
    'platform.infrastructure.view',
    'platform.automation.view', 'platform.automation.manage',
    'platform.developer.view',
    'platform.support.view', 'platform.support.manage',
    'platform.system.view', 'platform.system.manage',
  ],
  platform_support: [
    'platform.dashboard.view',
    'platform.users.view',
    'platform.businesses.view',
    'platform.subscriptions.view',
    'platform.support.view', 'platform.support.manage',
    'platform.system.view',
  ],
  platform_operations: [
    'platform.dashboard.view',
    'platform.businesses.view', 'platform.businesses.manage',
    'platform.monitoring.view',
    'platform.infrastructure.view', 'platform.infrastructure.manage',
    'platform.automation.view', 'platform.automation.manage',
    'platform.system.view',
  ],
  platform_finance: [
    'platform.dashboard.view',
    'platform.businesses.view',
    'platform.subscriptions.view', 'platform.subscriptions.manage',
  ],
  platform_security: [
    'platform.dashboard.view',
    'platform.users.view',
    'platform.security.view', 'platform.security.manage',
    'platform.monitoring.view',
    'platform.system.view',
  ],
  platform_developer: [
    'platform.dashboard.view',
    'platform.developer.view', 'platform.developer.manage',
    'platform.infrastructure.view',
    'platform.monitoring.view',
    'platform.configuration.view',
  ],
  platform_auditor: [
    'platform.dashboard.view',
    'platform.users.view',
    'platform.businesses.view',
    'platform.subscriptions.view',
    'platform.security.view',
    'platform.configuration.view',
    'platform.localization.view',
    'platform.system.view',
  ],
  platform_read_only: [
    'platform.dashboard.view',
    'platform.users.view',
    'platform.businesses.view',
    'platform.subscriptions.view',
    'platform.configuration.view',
    'platform.localization.view',
    'platform.security.view',
    'platform.monitoring.view',
    'platform.infrastructure.view',
    'platform.automation.view',
    'platform.developer.view',
    'platform.support.view',
    'platform.system.view',
  ],
}

/** True if `role` grants `permission`, honoring the `'*'` wildcard and resource-level `'<resource>.*'` grants. */
export function hasPlatformPermission(role: PlatformRole | undefined | null, permission: PlatformPermission): boolean {
  if (!role) return false
  const grants = PLATFORM_ROLE_PERMISSIONS[role] ?? []
  if (grants.includes(ALL)) return true
  const resource = permission.split('.')[0]
  if (grants.includes(`${resource}.*`)) return true
  return grants.includes(permission)
}

/** Parse a session/wire value into a PlatformRole. Unknown strings (including tenant roles like `'owner'`) return null — fail closed. */
export function parsePlatformRole(value: unknown): PlatformRole | null {
  if (typeof value !== 'string') return null
  return (PLATFORM_ROLES as readonly string[]).includes(value) ? (value as PlatformRole) : null
}
