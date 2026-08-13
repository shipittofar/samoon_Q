import type { P7Permission, Role } from '@/types/rbac'

export function isMockAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true'
}

/**
 * Backend GET /auth/me/permissions does not return the frontend-only
 * `dashboard:access` console-entry permission. Synthesize it when the user
 * has tenant roles and/or any API-granted permission so ConsoleWorkspaceGate
 * can open without falling back to ROLE_PERMISSION_MAP.
 *
 * This only adds shell entry — it must never expand a role into feature
 * permissions. Feature auth uses the effective permission set only.
 */
export function withDashboardAccess(
  permissions: readonly string[],
  opts?: { hasTenantRoles?: boolean },
): P7Permission[] {
  const unique = [...new Set(permissions)] as P7Permission[]
  if (unique.includes('dashboard:access')) return unique
  if (opts?.hasTenantRoles || unique.length > 0) {
    return [...unique, 'dashboard:access']
  }
  return unique
}

/** True when the session carries at least one role for the active tenant. */
export function sessionHasRoles(roles: readonly Role[] | undefined | null): boolean {
  return Array.isArray(roles) && roles.length > 0
}
