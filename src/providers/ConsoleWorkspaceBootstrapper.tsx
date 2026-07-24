'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuthStore, useRbacStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { clearConsoleWorkspaceQueryCache, invalidateConsoleWorkspaceQueries } from '@/hooks/console-workspace'
import { shouldSkipConsoleRouteWork } from '@/lib/console-account-access'

/**
 * Console Workspace bootstrap — activates tenant context from GET /auth/me
 * memberships on every /console route. Replaces slug/subdomain-based tenant
 * resolution for the admin workspace.
 */
export function ConsoleWorkspaceBootstrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const initializeFromSession = useConsoleWorkspaceStore((s) => s.initializeFromSession)
  const qc = useQueryClient()

  useEffect(() => {
    if (!pathname?.startsWith('/console')) return
    if (shouldSkipConsoleRouteWork(pathname, user)) return
    if (sessionMemberships === null) return
    void initializeFromSession()
  }, [pathname, user, sessionMemberships, initializeFromSession])

  useEffect(() => {
    function onTenantChanged() {
      clearConsoleWorkspaceQueryCache(qc)
    }
    function onBranchChanged() {
      invalidateConsoleWorkspaceQueries(qc, 'branch')
    }
    window.addEventListener('console:tenant-changed', onTenantChanged)
    window.addEventListener('console:branch-changed', onBranchChanged)
    return () => {
      window.removeEventListener('console:tenant-changed', onTenantChanged)
      window.removeEventListener('console:branch-changed', onBranchChanged)
    }
  }, [qc])

  return <>{children}</>
}
