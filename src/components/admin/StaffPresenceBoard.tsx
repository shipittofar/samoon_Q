'use client'

import { useTranslations } from 'next-intl'
import type { StaffPresence, StaffPresenceStatus, OperationsScope } from '@/types/realtime-operations'
import { useStaffPresence } from '@/hooks'

const STATUS_KEY: Record<StaffPresenceStatus, string> = {
  online: 'statusOnline',
  busy: 'statusBusy',
  break: 'statusBreak',
  offline: 'statusOffline',
}

const STATUS_DOT: Record<StaffPresenceStatus, string> = {
  online: 'bg-[var(--success)]',
  busy: 'bg-[var(--accent)]',
  break: 'bg-[var(--warning)]',
  offline: 'bg-[var(--fg-subtle)]',
}

const STATUS_SECTIONS: StaffPresenceStatus[] = ['online', 'busy', 'break', 'offline']

interface StaffCardProps {
  member: StaffPresence
}

function StaffCard({ member }: StaffCardProps) {
  const t = useTranslations('console')
  const lastActivity = new Date(member.lastActivity)
  const minutesAgo = Math.round((Date.now() - lastActivity.getTime()) / 60_000)
  const activityStr = minutesAgo < 1
    ? t('justNow')
    : minutesAgo < 60
      ? t('minutesAgoShort', { minutes: minutesAgo })
      : t('hoursAgoShort', { hours: Math.floor(minutesAgo / 60) })

  return (
    <div className="flex items-center gap-3 bg-[var(--card)] rounded border p-3 mb-2">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-[var(--border)] flex items-center justify-center text-sm font-semibold text-[var(--fg-secondary)]">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${STATUS_DOT[member.status]}`}
          title={t(STATUS_KEY[member.status])}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{member.name}</div>
        <div className="flex gap-2 text-xs text-[var(--fg-muted)]">
          <span className="capitalize">{member.role}</span>
          <span>·</span>
          <span className="truncate">{member.branchName}</span>
        </div>
        <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{activityStr}</div>
      </div>
      {member.activeOrderCount > 0 && (
        <div className="flex-shrink-0 text-xs bg-[var(--info-subtle)] text-[var(--info-text)] rounded-full px-2 py-0.5">
          {t('ordersCount', { count: member.activeOrderCount })}
        </div>
      )}
    </div>
  )
}

interface StaffPresenceBoardProps {
  scope: OperationsScope
  filterBranchId?: string
}

export function StaffPresenceBoard({ scope, filterBranchId }: StaffPresenceBoardProps) {
  const t = useTranslations('console')
  const { data: staff = [], isLoading, isError } = useStaffPresence(scope)

  const filtered = filterBranchId ? staff.filter((s) => s.branchId === filterBranchId) : staff

  if (isLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingStaff')}</div>
  if (isError) return <div className="text-sm text-[var(--danger-text)] p-4">{t('failedToLoadStaffPresence')}</div>

  const byStatus = (status: StaffPresenceStatus) => filtered.filter((s) => s.status === status)

  const onlineCount = byStatus('online').length
  const totalCount = filtered.length

  return (
    <div>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="bg-[var(--success-subtle)] text-[var(--success-text)] rounded px-3 py-1">
          {t('onlineCount', { count: onlineCount })}
        </span>
        <span className="bg-[var(--card-hover)] rounded px-3 py-1">
          {t('totalCount', { count: totalCount })}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_SECTIONS.map((status) => {
          const members = byStatus(status)
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  {t(STATUS_KEY[status])}
                </span>
                <span className="text-xs text-[var(--fg-subtle)]">({members.length})</span>
              </div>
              {members.length === 0 ? (
                <div className="text-xs text-[var(--fg-subtle)] italic">{t('none')}</div>
              ) : (
                members.map((m) => <StaffCard key={m.userId} member={m} />)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
