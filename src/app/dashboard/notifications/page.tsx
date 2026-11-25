'use client'

/**
 * The signed-in user's own notifications (customers have no access to the
 * console's notification center). New ones appear live; opening one marks it
 * read and goes to what it is about.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Archive, Bell, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import {
  useArchiveNotification,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks'
import { useOpenNotification } from '@/hooks/open-notification'
import { useLocalizedNumber } from '@/i18n/hooks'
import { cn } from '@/utils'

type Tab = 'all' | 'unread' | 'read' | 'archived'
const TABS: Tab[] = ['all', 'unread', 'read', 'archived']

const ICON_BUTTON =
  'flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]'

export default function DashboardNotificationsPage() {
  const t = useTranslations('notifications')
  const tc = useTranslations('console')
  const { formatRelativeTime } = useLocalizedNumber()
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, refetch } = useNotifications({
    ...(tab === 'all' ? {} : { status: tab }),
    page,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  })
  const open = useOpenNotification()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const archive = useArchiveNotification()
  const remove = useDeleteNotification()

  const ago = (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (minutes < 60) return formatRelativeTime(-Math.max(0, minutes), 'minute')
    if (minutes < 1440) return formatRelativeTime(-Math.floor(minutes / 60), 'hour')
    return formatRelativeTime(-Math.floor(minutes / 1440), 'day')
  }

  const rows = data?.results ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('title')}</h1>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button size="sm" variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate({})}>
            {t('markAllRead')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key)
              setPage(1)
            }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm',
              tab === key
                ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--fg)]'
                : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
            )}
          >
            {key === 'all' ? t('categories.all') : t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-[var(--fg-muted)]">{tc('failedToLoadNotifications')}</p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              {tc('retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-[var(--fg-muted)]">
            <Bell className="h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="text-sm">{tab === 'unread' ? t('allCaughtUp') : t('noNotifications')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((n) => (
              <li key={n.id} className={cn('flex items-start gap-1 pe-2', n.status === 'unread' && 'bg-[var(--accent-subtle)]/40')}>
                <button
                  type="button"
                  onClick={() => void open(n)}
                  className="min-w-0 flex-1 p-4 text-start hover:bg-[var(--card-hover)]"
                >
                  <span className="flex items-center gap-2">
                    {n.status === 'unread' && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label={t('tabs.unread')} role="img" />
                    )}
                    <span className={cn('text-sm text-[var(--fg)]', n.status === 'unread' ? 'font-semibold' : 'font-medium')}>
                      {n.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-[var(--fg-muted)]">{n.message}</span>
                  <span className="mt-1 block text-xs text-[var(--fg-muted)]">{ago(n.created_at)}</span>
                </button>
                <div className="flex shrink-0 pt-2">
                  {n.status === 'unread' && (
                    <button type="button" className={ICON_BUTTON} aria-label={t('markRead')} title={t('markRead')} onClick={() => markRead.mutate(n.id)}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {n.status !== 'archived' && (
                    <button type="button" className={ICON_BUTTON} aria-label={t('archive')} title={t('archive')} onClick={() => archive.mutate(n.id)}>
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" className={ICON_BUTTON} aria-label={t('delete')} title={t('delete')} onClick={() => remove.mutate(n.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--border)] p-3 text-sm text-[var(--fg-muted)]">
            <button type="button" className={cn(ICON_BUTTON, 'disabled:opacity-40')} disabled={page <= 1} aria-label={t('previous')} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            {t('pageOfTotal', { page, total: totalPages })}
            <button type="button" className={cn(ICON_BUTTON, 'disabled:opacity-40')} disabled={page >= totalPages} aria-label={t('next')} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
