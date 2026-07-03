'use client'

import { useState, useCallback } from 'react'
import { X, Bell, Search, Filter, Check, Archive, Trash2, ExternalLink, AlertTriangle, Info, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
  useDeleteNotification,
} from '@/hooks'
import type { RichNotification, NotificationFilter, NotificationStatus, NotificationPriority, NotificationCategory } from '@/types/notification'

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const CATEGORIES: Array<{ value: NotificationCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'reservation', label: 'Reservations' },
  { value: 'staff', label: 'Staff' },
  { value: 'branch', label: 'Branches' },
  { value: 'promotion', label: 'Promotions' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'audit', label: 'Audit' },
  { value: 'system', label: 'System' },
]

const TABS: Array<{ value: NotificationStatus | 'all'; label: string }> = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
]

interface DrawerNotifItemProps {
  notification: RichNotification
  onRead: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function DrawerNotifItem({ notification, onRead, onArchive, onDelete, onClose }: DrawerNotifItemProps) {
  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-4 hover:bg-muted/40 transition-colors border-b border-border last:border-0',
        notification.status === 'unread' && 'bg-blue-50/30 dark:bg-blue-950/20',
      )}
    >
      <div className="mt-0.5 flex-shrink-0">{PRIORITY_ICON[notification.priority]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', notification.status === 'unread' && 'font-semibold')}>
            {notification.title}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={PRIORITY_BADGE[notification.priority]} className="text-xs capitalize">
              {notification.priority}
            </Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
        {notification.actor && (
          <p className="text-xs text-muted-foreground mt-0.5">
            by {notification.actor.name}
          </p>
        )}
        {notification.deepLink && (
          <Link
            href={notification.deepLink.href}
            onClick={onClose}
            className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
          >
            View details <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {notification.status === 'unread' && (
          <button onClick={() => onRead(notification.id)} title="Mark read" className="p-1.5 rounded hover:bg-muted">
            <Check className="w-4 h-4" />
          </button>
        )}
        {notification.status !== 'archived' && (
          <button onClick={() => onArchive(notification.id)} title="Archive" className="p-1.5 rounded hover:bg-muted">
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onDelete(notification.id)} title="Delete" className="p-1.5 rounded hover:bg-muted text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
  tenantId?: string
  branchId?: string
}

export function NotificationDrawer({ open, onClose, tenantId, branchId }: NotificationDrawerProps) {
  const [tab, setTab] = useState<NotificationStatus | 'all'>('unread')
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<NotificationPriority | 'all'>('all')
  const [page, setPage] = useState(1)

  const filter: NotificationFilter = {
    tenantId,
    branchId,
    ...(tab !== 'all' ? { status: tab } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(priority !== 'all' ? { priority } : {}),
    ...(search ? { search } : {}),
    page,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  const { data: notifPage, isLoading, refetch } = useNotifications(filter)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const archive = useArchiveNotification()
  const del = useDeleteNotification()

  const notifications = notifPage?.results ?? []
  const totalPages = notifPage?.totalPages ?? 1
  const unreadCount = notifPage?.unreadCount ?? 0

  const handleTabChange = useCallback((t: NotificationStatus | 'all') => {
    setTab(t)
    setPage(1)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <h2 className="font-semibold">Notifications</h2>
                {unreadCount > 0 && <Badge variant="info">{unreadCount} unread</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => refetch()} title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                {tab === 'unread' && unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAll.mutate({ tenantId, branchId })}
                  >
                    Mark all read
                  </Button>
                )}
                <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-2 border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTabChange(t.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    tab === t.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search notifications…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { setCategory(c.value); setPage(1) }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors',
                      category === c.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="w-10 h-10 mb-3 opacity-30" />
                  <p className="font-medium">No notifications</p>
                  <p className="text-sm mt-1">
                    {tab === 'unread' ? "You're all caught up!" : 'Nothing here yet.'}
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <DrawerNotifItem
                    key={n.id}
                    notification={n}
                    onRead={(id) => markRead.mutate(id)}
                    onArchive={(id) => archive.mutate(id)}
                    onDelete={(id) => del.mutate(id)}
                    onClose={onClose}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-border px-6 py-3 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>
            )}

            {/* Footer link */}
            <div className="border-t border-border px-6 py-3">
              <Link
                href="/console/notifications"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
              >
                Open Notification Center <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
