'use client'

import { useTranslations } from 'next-intl'
import type { RbacAssignment } from '@/types/rbac-api'

const STATUS_STYLES: Record<RbacAssignment['status'], string> = {
  active: 'bg-[var(--success-subtle)] text-[var(--success-text)] border-[var(--success-border)]',
  revoked: 'bg-[var(--danger-subtle)] text-[var(--danger-text)] border-[var(--danger-border)]',
  expired: 'bg-[var(--card-hover)] text-[var(--fg-muted)] border-[var(--border)]',
  future: 'bg-[var(--info-subtle)] text-[var(--info-text)] border-[var(--info-border)]',
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
    <article className="rounded-lg border border-[var(--border)] p-4 space-y-3 bg-[var(--card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--fg)]">{assignment.role}</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[assignment.status]}`}
            >
              {t(statusKey)}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--fg-muted)]">
              {assignment.mode}
            </span>
            {assignment.allLocations && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--chart-5)]/15 text-[var(--chart-5)]">
                {t('tenantWideBadge')}
              </span>
            )}
            {!assignment.allLocations && assignment.locations.length > 1 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--info-subtle)] text-[var(--info-text)]">
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
                className="text-xs text-[var(--info-text)] hover:underline"
              >
                {t('editLabel')}
              </button>
            )}
            {onRevoke && (
              <button
                type="button"
                onClick={onRevoke}
                disabled={revoking}
                className="text-xs text-[var(--danger-text)] hover:underline disabled:opacity-50"
              >
                {revoking ? t('revokingEllipsis') : t('revokeAssignmentLabel')}
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--fg-muted)] mb-1">{t('locationAssignmentLabel')}</p>
        {assignment.allLocations ? (
          <span className="text-xs text-[var(--fg-secondary)]">{t('allLocationsTenantWideLabel')}</span>
        ) : assignment.locations.length === 0 ? (
          <span className="text-xs text-[var(--fg-subtle)]">{t('noLocationsAssigned')}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {assignment.locations.map((loc) => (
              <span
                key={loc.id}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--info-subtle)] text-[var(--info-text)] border border-[var(--info-border)]"
              >
                {loc.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-[var(--fg-muted)]">{t('validFromLabel')}</dt>
        <dd>{formatWhen(assignment.validFrom)}</dd>
        <dt className="text-[var(--fg-muted)]">{t('validUntilLabel')}</dt>
        <dd>{formatWhen(assignment.validUntil)}</dd>
        <dt className="text-[var(--fg-muted)]">{t('grantedByLabel')}</dt>
        <dd>{assignment.grantedBy || '—'}</dd>
        <dt className="text-[var(--fg-muted)]">{t('grantedAtLabel')}</dt>
        <dd>{formatWhen(assignment.grantedAt)}</dd>
        {assignment.revokedBy && (
          <>
            <dt className="text-[var(--fg-muted)]">{t('revokedByLabel')}</dt>
            <dd>{assignment.revokedBy}</dd>
            <dt className="text-[var(--fg-muted)]">{t('revokedAtLabel')}</dt>
            <dd>{formatWhen(assignment.revokedAt)}</dd>
          </>
        )}
      </dl>
    </article>
  )
}
