'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import { useStaffMember } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { StaffAssignedRolesSection } from '@/components/admin/StaffAssignedRolesSection'
import { StaffPermissionOverridesSection } from '@/components/admin/StaffPermissionOverridesSection'
import { StaffEffectivePermissionsSection } from '@/components/admin/StaffEffectivePermissionsSection'
import { StaffPermissionAuditSection } from '@/components/admin/StaffPermissionAuditSection'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

const STAFF_STATUS_KEY: Record<string, string> = {
  active: 'statusActive',
  suspended: 'statusSuspended',
  removed: 'staffStatusRemoved',
  pending: 'statusPending',
}

export default function StaffDetailPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Staff Detail">
      <PermissionGuard permission="staff.view"fallback={<AccessDenied />}>
        <StaffDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}

function StaffDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: member, isLoading } = useStaffMember(id)

  if (isLoading) return <div className="p-6">{t('loadingEllipsis')}</div>
  if (!member) return <div className="p-6">{t('staffMemberNotFound')}</div>

  const membershipId = member.membershipId ?? member.id

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-[var(--fg-muted)]">{member.email}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            member.status === 'active'
              ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
              : member.status === 'suspended'
                ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : member.status === 'removed'
                  ? 'bg-[var(--danger-subtle)] text-[var(--danger-text)]'
                  : 'bg-[var(--card-hover)] text-[var(--fg-secondary)]'
          }`}
        >
          {t(STAFF_STATUS_KEY[member.status] ?? 'statusInactive')}
        </span>
      </div>

      <StaffAssignedRolesSection member={member} />

      <StaffPermissionOverridesSection
        tenantId={member.tenantId}
        membershipId={membershipId}
        userId={member.userId}
      />

      <StaffEffectivePermissionsSection membershipId={membershipId} userId={member.userId} />

      <StaffPermissionAuditSection tenantId={member.tenantId} membershipId={membershipId} />

      <section>
        <h2 className="text-lg font-semibold mb-2">{t('membershipLabel')}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">{t('tenantLabelShort')}</dt>
          <dd>
            <Link href="/console/settings"className="text-[var(--info-text)] hover:underline">
              {member.tenantId}
            </Link>
          </dd>
          <dt className="text-[var(--fg-muted)]">{t('invitedLabel')}</dt>
          <dd>{new Date(member.invitedAt).toLocaleDateString()}</dd>
          {member.activatedAt && (
            <>
              <dt className="text-[var(--fg-muted)]">{t('activatedLabel')}</dt>
              <dd>{new Date(member.activatedAt).toLocaleDateString()}</dd>
            </>
          )}
          {member.lastSeenAt && (
            <>
              <dt className="text-[var(--fg-muted)]">{t('lastSeenLabel')}</dt>
              <dd>{new Date(member.lastSeenAt).toLocaleDateString()}</dd>
            </>
          )}
        </dl>
      </section>
    </div>
  )
}
