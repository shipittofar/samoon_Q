'use client'

/**
 * Platform Admin hooks — P9.4 Phase G
 */
import { usePlatformAdminStore } from './store'
import { hasPlatformPermission, type PlatformPermission, type PlatformRole } from './permissions'

export function usePlatformRole(): PlatformRole | null {
  return usePlatformAdminStore((s) => s.platformRole)
}

/** True if the current platform role grants `permission` — see `hasPlatformPermission` for wildcard rules. */
export function usePlatformPermission(permission: PlatformPermission): boolean {
  const role = usePlatformRole()
  return hasPlatformPermission(role, permission)
}
