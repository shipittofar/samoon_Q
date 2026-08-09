'use client'

import { useTranslations } from 'next-intl'
import type { RbacAssignment } from '@/types/rbac-api'

const STATUS_STYLES: Record<RbacAssignment['status'], string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  revoked: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  future: 'bg-blue-100 text-blue-800 border-blue-200',
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export interface AssignmentCardProps {
  assignment: RbacAssignment
  onEdit?: () => void
  onRevoke?: () => void
  revoking?: boolean
}

export function AssignmentCard({ assignment, onEdit, onRevoke, revoking }: AssignmentCardProps) {
  const t = useTranslations('console')

  const statusKey =
    assignment.status === 'active'
      ? 'assignmentStatusActive'
      : assignment.status === 'revoked'
        ? 'assignmentStatusRevoked'
        : assignment.status === 'expired'
          ? 'assignmentStatusExpired'
          : 'assignmentStatusFuture'

  return (
    <article className="rounded-lg border border-gray-200 p-4 space-y-3 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{assignment.role}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[assignment.status]}`}
            >
              {t(statusKey)}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {assignment.mode}
            </span>
            {assignment.allLocations && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {t('tenantWideBadge')}
              </span>
            )}
            {!assignment.allLocations && assignment.locations.length > 1 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {t('multiLocationBadge')}
              </span>
            )}
          </div>
        </div>
        {(onEdit || onRevoke) && assignment.status !== 'revoked' && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs text-blue-600 hover:underline"
              >
                {t('editLabel')}
              </button>
            )}
            {onRevoke && (
              <button
                type="button"
                onClick={onRevoke}
                disabled={revoking}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {revoking ? t('revokingEllipsis') : t('revokeAssignmentLabel')}
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{t('locationAssignmentLabel')}</p>
        {assignment.allLocations ? (
          <span className="text-xs text-gray-700">{t('allLocationsTenantWideLabel')}</span>
        ) : assignment.locations.length === 0 ? (
          <span className="text-xs text-gray-400">{t('noLocationsAssigned')}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {assignment.locations.map((loc) => (
              <span
                key={loc.id}
                className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
              >
                {loc.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-gray-500">{t('validFromLabel')}</dt>
        <dd>{formatWhen(assignment.validFrom)}</dd>
        <dt className="text-gray-500">{t('validUntilLabel')}</dt>
        <dd>{formatWhen(assignment.validUntil)}</dd>
        <dt className="text-gray-500">{t('grantedByLabel')}</dt>
        <dd>{assignment.grantedBy || '—'}</dd>
        <dt className="text-gray-500">{t('grantedAtLabel')}</dt>
        <dd>{formatWhen(assignment.grantedAt)}</dd>
        {assignment.revokedBy && (
          <>
            <dt className="text-gray-500">{t('revokedByLabel')}</dt>
            <dd>{assignment.revokedBy}</dd>
            <dt className="text-gray-500">{t('revokedAtLabel')}</dt>
            <dd>{formatWhen(assignment.revokedAt)}</dd>
          </>
        )}
      </dl>
    </article>
  )
}
