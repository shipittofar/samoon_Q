/**
 * Platform Admin Store — in-center UI metadata only.
 *
 * `platformRole` is NOT an authorization source for `/platform-admin`.
 * Route access is `user.is_superuser === true` from GET /auth/me.
 *
 * Fail closed: `null` by default. Not persisted. Session restore always
 * clears this field so a leftover `platform_super_admin` cannot grant access
 * or override Django superuser.
 */
import { create } from 'zustand'
import { parsePlatformRole, type PlatformRole } from './permissions'

interface PlatformAdminState {
  platformRole: PlatformRole | null
  setPlatformRole: (role: PlatformRole | null) => void
}

export const usePlatformAdminStore = create<PlatformAdminState>()((set) => ({
  platformRole: null,
  setPlatformRole: (role) => set({ platformRole: role }),
}))

/** Clear or set in-center UI role. Unknown wire values become null. Never used for route access. */
export function applyPlatformRoleFromSession(role: unknown): void {
  usePlatformAdminStore.getState().setPlatformRole(parsePlatformRole(role))
}
