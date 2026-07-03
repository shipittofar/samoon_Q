'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Bell, Search, Filter, Check, Archive, Trash2, ExternalLink,
  AlertTriangle, Info, AlertCircle, RefreshCw, Loader2, BarChart2,
  Settings, Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import {
  useNotifications,
  useNotificationStatistics,
  useNotificationPreferences,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
  useDeleteNotification,
  useUpdateNotificationPreference,
  useResetNotificationPreferences,
} from '@/hooks'
import { NOTIFICATION_CATEGORIES_WITH_LABELS } from '@/services/notification-preferences.service'
import type {
  NotificationFilter,
  NotificationStatus,
  NotificationPriority,
  NotificationCategory,
  NotificationPreference,
} from '@/types/notification'
import { useAuthStore, useTenantStore } from '@/stores'
import { cn } from '@/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const PRIORITY_ICON: Record<NotificationPriority, React.ReactNode> = {
  low: <Info className="w-4 h-4 text-muted-foreground" />,
  normal: <Info className="w-4 h-4 text-blue-500" />,
  high: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  urgent: <AlertCircle className="w-4 h-4 text-red-500" />,
}

const PRIORITY_BADGE: Record<NotificationPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

const CATEGORIES: Array<{ value: NotificationCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Categories' },
  ...Object.entries(NOTIFICATION_CATEGORIES_WITH_LABELS).map(([value, label]) => ({
    value: value as NotificationCategory,
    label,
  })),
]

type Tab = 'inbox' | 'archived' | 'statistics' | 'preferences'

// ── Inbox Tab ────────────────────────────────────────────────────────────────

interface InboxProps {
  tenantId?: string
}

function InboxTab({ tenantId }: InboxProps) {
  const [status, setStatus] = useState<NotificationStatus | 'all'>('unread')
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')
  const [priority, setPriority] = useState<NotificationPriority | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filter: NotificationFilter = useMemo(() => ({
    tenantId,
    ...(status !== 'all' ? { status } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(priority !== 'all' ? { priority } : {}),
    ...(search ? { search } : {}),
    page,
    pageSize: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }), [tenantId, status, category, priority, search, page])

  const { data: notifPage, isLoading, isError, refetch } = useNotifications(filter)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const archive = useArchiveNotification()
  const del = useDeleteNotification()

  const notifications = notifPage?.results ?? []
  const totalPages = notifPage?.totalPages ?? 1
  const unreadCount = notifPage?.unreadCount ?? 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)]" />
          <input
            type="text"
            placeholder="Search notifications…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as NotificationStatus | 'all'); setPage(1) }}
          className="px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value as NotificationCategory | 'all'); setPage(1) }}
          className="px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none"
        >
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value as NotificationPriority | 'all'); setPage(1) }}
          className="px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate({ tenantId })}>
            Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-muted)]" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-[var(--fg-muted)]">Failed to load notifications.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--fg-muted)]">
            <Bell className="w-10 h-10 opacity-30" />
            <p className="font-medium">No notifications found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                    {['Priority', 'Title', 'Category', 'Actor', 'Time', 'Actions'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {notifications.map((n) => (
                    <tr
                      key={n.id}
                      className={cn(
                        'hover:bg-[var(--card-hover)] transition-colors',
                        n.status === 'unread' && 'bg-blue-50/20 dark:bg-blue-950/10',
                      )}
                    >
                      <td className="px-4 py-3">{PRIORITY_ICON[n.priority]}</td>
                      <td className="px-4 py-3">
                        <p className={cn('font-medium text-[var(--fg)]', n.status === 'unread' && 'font-semibold')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5 max-w-xs truncate">{n.message}</p>
                        {n.deepLink && (
                          <Link href={n.deepLink.href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" className="capitalize text-xs">{n.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">
                        {n.actor?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--fg-muted)] whitespace-nowrap">
                        {timeAgo(n.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {n.status === 'unread' && (
                            <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)} title="Mark read">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => archive.mutate(n.id)} title="Archive">
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => del.mutate(n.id)} title="Delete" className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[var(--fg-muted)]">
                  Page {page} of {totalPages} ({notifPage?.count ?? 0} total)
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</Button>
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Statistics Tab ────────────────────────────────────────────────────────────

interface StatisticsTabProps {
  tenantId?: string
}

function StatisticsTab({ tenantId }: StatisticsTabProps) {
  const filter: NotificationFilter = { tenantId, pageSize: 1000 }
  const { data: stats, isLoading } = useNotificationStatistics(filter)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-muted)]" />
      </div>
    )
  }
  if (!stats) return null

  const readRate = stats.totalNotifications > 0
    ? Math.round((stats.readCount / stats.totalNotifications) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.totalNotifications },
          { label: 'Unread', value: stats.unreadCount },
          { label: 'Read', value: stats.readCount },
          { label: 'Read Rate', value: `${readRate}%` },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
            <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-[var(--fg)] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* By category */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-semibold mb-4">By Category</h3>
        <div className="space-y-3">
          {Object.entries(stats.notificationsByCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => {
              const pct = stats.totalNotifications > 0 ? (count / stats.totalNotifications) * 100 : 0
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--fg-muted)] w-28 capitalize">{cat}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{count}</span>
                </div>
              )
            })}
        </div>
      </div>

      {/* By priority */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-semibold mb-4">By Priority</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats.notificationsByPriority).map(([priority, count]) => (
            <div key={priority} className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--fg-muted)] capitalize">{priority}</p>
              <p className="text-xl font-bold text-[var(--fg)] mt-1">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top types */}
      {stats.topTypes.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Top Notification Types</h3>
          <div className="space-y-2">
            {stats.topTypes.slice(0, 5).map((t) => (
              <div key={t.type} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--fg)] font-mono">{t.type}</span>
                <Badge variant="default">{t.count}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Preferences Tab ───────────────────────────────────────────────────────────

interface PreferencesTabProps {
  userId: string
  tenantId: string
}

function PreferencesTab({ userId, tenantId }: PreferencesTabProps) {
  const { data: prefs, isLoading } = useNotificationPreferences(userId, tenantId)
  const updatePref = useUpdateNotificationPreference()
  const resetPrefs = useResetNotificationPreferences()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--fg-muted)]">
          Configure which notifications you receive and how.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resetPrefs.mutate({ userId, tenantId })}
          disabled={resetPrefs.isPending}
        >
          {resetPrefs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset to defaults'}
        </Button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
              {['Category', 'Enabled', 'In-App', 'Push', 'Email', 'Min Priority'].map((h) => (
                <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {(prefs ?? []).map((pref) => (
              <tr key={pref.id} className="hover:bg-[var(--card-hover)] transition-colors">
                <td className="px-4 py-3 font-medium capitalize">
                  {NOTIFICATION_CATEGORIES_WITH_LABELS[pref.category] ?? pref.category}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.enabled}
                    onChange={(e) =>
                      updatePref.mutate({ userId, tenantId, category: pref.category, update: { enabled: e.target.checked } })
                    }
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.channels.in_app}
                    onChange={(e) =>
                      updatePref.mutate({
                        userId, tenantId, category: pref.category,
                        update: { channels: { ...pref.channels, in_app: e.target.checked } },
                      })
                    }
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.channels.push}
                    onChange={(e) =>
                      updatePref.mutate({
                        userId, tenantId, category: pref.category,
                        update: { channels: { ...pref.channels, push: e.target.checked } },
                      })
                    }
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.channels.email}
                    onChange={(e) =>
                      updatePref.mutate({
                        userId, tenantId, category: pref.category,
                        update: { channels: { ...pref.channels, email: e.target.checked } },
                      })
                    }
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={pref.minPriority}
                    onChange={(e) =>
                      updatePref.mutate({
                        userId, tenantId, category: pref.category,
                        update: { minPriority: e.target.value as NotificationPriority },
                      })
                    }
                    className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" /> },
  { id: 'archived', label: 'Archived', icon: <Archive className="w-4 h-4" /> },
  { id: 'statistics', label: 'Statistics', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
]

function NotificationsContent() {
  const [tab, setTab] = useState<Tab>('inbox')
  const { user } = useAuthStore()
  const { tenant } = useTenantStore()
  const tenantId = tenant?.id
  const userId = user?.id ?? ''

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--fg)] flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notification Center
          </h1>
          <p className="text-[var(--fg-muted)] text-sm mt-1">
            Manage your notifications, preferences, and delivery settings.
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'inbox' && <InboxTab tenantId={tenantId} />}
        {tab === 'archived' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">Archived notifications are kept for 30 days.</p>
            <InboxTab tenantId={tenantId} />
          </div>
        )}
        {tab === 'statistics' && <StatisticsTab tenantId={tenantId} />}
        {tab === 'preferences' && userId && tenantId && (
          <PreferencesTab userId={userId} tenantId={tenantId} />
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <ErrorBoundary feature="NotificationCenter">
      <PermissionGuard
        permission="notifications.view"
        fallback={<AccessDenied />}
      >
        <NotificationsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
