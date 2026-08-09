'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, ChevronRight } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { StaffAssignedRolesSection } from '@/components/admin/StaffAssignedRolesSection'
import { StaffPermissionOverridesSection } from '@/components/admin/StaffPermissionOverridesSection'
import { StaffEffectivePermissionsSection } from '@/components/admin/StaffEffectivePermissionsSection'
import { useStaffPage, useConsoleTenantId } from '@/hooks'

export default function UserPermissionsPage() {
  const t = useTranslations('console')
  const params = useParams()
  const userId = params.userId as string
  const tenantId = useConsoleTenantId() ?? ''

  const { data: staffPage, isLoading: staffLoading } = useStaffPage(tenantId, { page_size: 100 })
  const member = staffPage?.results.find((m) => m.userId === userId)

  const membershipId = member?.membershipId ?? member?.id ?? ''

  if (staffLoading) {
    return <main className="p-6">{t('loadingEllipsis')}</main>
  }

  if (!member) {
    return (
      <main className="p-6">
        <Link
          href="/console/permissions"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToPermissionsLabel')}
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <User className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">{t('userNotFoundNoPeriod')}</p>
        </div>
      </main>
    )
  }

  return (
    <ErrorBoundary feature="User Permissions">
      <PermissionGuard permission="staff.view" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6 max-w-3xl">
          <Link
            href="/console/permissions"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t('backToPermissionsLabel')}
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {member.firstName} {member.lastName}
            </h1>
            <p className="text-sm text-gray-500">{member.email}</p>
            <Link
              href={`/console/staff/${member.id}`}
              className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
            >
              {t('viewStaffProfileLabel')}
            </Link>
          </div>

          <StaffAssignedRolesSection member={member} />

          <StaffPermissionOverridesSection
            tenantId={tenantId}
            membershipId={membershipId}
            userId={member.userId}
          />

          <StaffEffectivePermissionsSection membershipId={membershipId} userId={member.userId} />
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
