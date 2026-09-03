'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

/**
 * Custom role creation is managed by the authorization backend.
 * Role permissions are edited on /console/roles/[id] after a role exists.
 */
function RoleCreateRedirect() {
  const t = useTranslations('console')
  const router = useRouter()

  useEffect(() => {
    router.replace('/console/roles')
  }, [router])

  return (
    <main className="p-6 text-sm text-[var(--fg-muted)]">
      {t('customRoleNotActiveWarning')}
    </main>
  )
}

export default function AdminRolesNewPage() {
  return (
    <PermissionGuard permission="rbac.manage_roles"fallback={<AccessDenied />}>
      <RoleCreateRedirect />
    </PermissionGuard>
  )
}
