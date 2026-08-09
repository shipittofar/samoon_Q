import { useRbacStore, useTenantStore } from '@/stores'
import { usePermissionStore } from '@/stores/permission-store'

/**
 * Dev-only RBAC bootstrap diagnostics — logs permission resolution state
 * when console access checks run. No-op in production.
 */
export function logRbacDiagnostics(resolvedPermissions: readonly string[]): void {
  if (process.env.NODE_ENV !== 'development') return
  if (typeof window === 'undefined') return

  const activeMembership = useRbacStore.getState().activeMembership
  const currentTenantSession = useRbacStore.getState().currentTenantSession
  const resolvedTenantId = useTenantStore.getState().tenant?.id
  const permissionStore = usePermissionStore.getState()

  console.debug('[rbac:diagnostics]', {
    activeMembership,
    currentTenantSession,
    resolvedTenantId,
    permissionStoreTenantId: permissionStore.tenantId,
    resolvedPermissionsLength: resolvedPermissions.length,
    dashboardAccess: resolvedPermissions.includes('dashboard:access'),
  })
}
