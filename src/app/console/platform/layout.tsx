'use client'

import type { ReactNode } from 'react'
import { PlatformSuperuserGuard } from '@/components/auth/PlatformSuperuserGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

/** /console/platform/* — the superuser part of the console. */
export default function ConsolePlatformLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformSuperuserGuard loadingFallback={null} fallback={<AccessDenied />}>
      {children}
    </PlatformSuperuserGuard>
  )
}
