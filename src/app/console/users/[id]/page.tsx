'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

/**
 * Legacy /console/users/[id] — redirects to per-user RBAC management.
 */
function UserDetailRedirect() {
  const t = useTranslations('console')
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  useEffect(() => {
    router.replace(`/console/permissions/${userId}`)
  }, [router, userId])

  return (
    <main className="p-6 space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">{t('loadingEllipsis')}</p>
      <Link href="/console/users"className="text-[var(--info-text)] hover:underline text-sm">
        {t('backToUsers')}
      </Link>
    </main>
  )
}

export default function UserDetailRedirectPage() {
  return (
    <PermissionGuard permission="staff.view"fallback={<AccessDenied />}>
      <UserDetailRedirect />
    </PermissionGuard>
  )
}
