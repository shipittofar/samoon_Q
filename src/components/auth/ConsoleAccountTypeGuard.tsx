'use client'

/**
 * Account-type authorization for the Console route family.
 *
 * Sits at the outermost edge of `console/layout.tsx`, before `AuthGuard`
 * and the admin shell. Customer accounts are redirected to `/dashboard`
 * immediately; business accounts pass through unchanged.
 *
 * `ConsoleWorkspaceBootstrapper` (global Providers tree) uses the same
 * account-type rule to skip workspace initialization for customers.
 *
 * RBAC (`ConsoleWorkspaceGate`, `PermissionGuard`) remains responsible
 * for membership and permissions — this guard only enforces account type.
 */

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { mayAccessConsoleByAccountType } from '@/lib/console-account-access'

const CUSTOMER_CONSOLE_REDIRECT = '/dashboard'

export function ConsoleAccountTypeGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const router = useRouter()

  const blocked = !isLoading && !!user && !mayAccessConsoleByAccountType(user)

  useEffect(() => {
    if (blocked) {
      router.replace(CUSTOMER_CONSOLE_REDIRECT)
    }
  }, [blocked, router])

  if (isLoading) return null
  if (blocked) return null

  return <>{children}</>
}
