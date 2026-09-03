'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PermissionAuditTable } from '@/components/admin/PermissionAuditTable'
import { usePermission, usePermissionAudit } from '@/hooks'

export interface StaffPermissionAuditSectionProps {
  tenantId: string
  membershipId: string
}

export function StaffPermissionAuditSection({
  tenantId,
  membershipId,
}: StaffPermissionAuditSectionProps) {
  const t = useTranslations('console')
  const canViewAudit = usePermission('audit.view')
  const { data, isLoading } = usePermissionAudit(
    tenantId,
    {
      membership_id: membershipId,
      page_size: 10,
      ordering: '-timestamp',
    },
    canViewAudit,
  )

  if (!canViewAudit) return null

  const entries = data?.results ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('permissionAuditTitle')}</h2>
        <Link
          href={`/console/rbac/audit?membership_id=${membershipId}`}
          className="text-xs text-[var(--info-text)] hover:underline"
        >
          {t('viewFullAuditLabel')}
        </Link>
      </div>
      <PermissionAuditTable entries={entries} loading={isLoading} compact />
    </section>
  )
}
