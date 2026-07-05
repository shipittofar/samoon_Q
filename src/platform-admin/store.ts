/**
 * Platform Admin Store — P9.4 Phase G
 *
 * Holds the current user's Platform Role. Deliberately a separate,
 * standalone zustand store rather than an addition to `useAuthStore`/
 * `useRbacStore` (src/stores/index.ts) — those model tenant-scoped
 * identity/roles; a platform role has no tenant at all, so bolting it onto
 * either would blur exactly the boundary docs/P9.4_PLATFORM_ADMIN_AUDIT.md
 * calls out as worth keeping separate.
 *
 * Defaults to 'platform_super_admin' — matching the mock-mode-friendly
 * defaults used throughout the app so the Platform Admin Center is fully
 * explorable out of the box; a real backend would derive this from the
 * authenticated platform user record instead of a persisted client default.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlatformRole } from './permissions'

interface PlatformAdminState {
  platformRole: PlatformRole
  setPlatformRole: (role: PlatformRole) => void
}

export const usePlatformAdminStore = create<PlatformAdminState>()(
  persist(
    (set) => ({
      platformRole: 'platform_super_admin',
      setPlatformRole: (role) => set({ platformRole: role }),
    }),
    { name: 'platform-admin-store' },
  ),
)
