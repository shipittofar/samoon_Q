'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, X, Check, Archive, Trash2, ExternalLink, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import {
  useNotificationSummary,
  useUnreadNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
} from '@/hooks'
import { useLocalizedNumber } from '@/i18n/hooks'
import type { RichNotification, NotificationPriority } from '@/types/notification'

const PRIORITY_ICON: Record<NotificationPriority, React.ReactNode> = {
  low: <Info className="w-3.5 h-3.5 text-muted-foreground" />,
  normal: <Info className="w-3.5 h-3.5 text-blue-500" />,
  high: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  urgent: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
}

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  low: 'bg-muted-foreground',
  normal: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
}

function timeAgo(iso: string, formatRelativeTime: ReturnType<typeof useLocalizedNumber>['formatRelativeTime']): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return formatRelativeTime(0, 'second')
  if (mins < 60) return formatRelativeTime(-mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return formatRelativeTime(-hours, 'hour')
  return formatRelativeTime(-Math.floor(hours / 24), 'day')
}

interface NotifItemProps {
  notification: RichNotification
  onRead: (id: string) => void
  onArchive: (id: string) => void
  onClose: () => void
}

function NotifItem({ notification, onRead, onArchive, onClose }: NotifItemProps) {
  const t = useTranslations('notifications')
  const { formatRelativeTime } = useLocalizedNumber()
  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0',
        notification.status === 'unread' && 'bg-blue-50/30 dark:bg-blue-950/20',
      )}
    >
      <div className="mt-1 flex-shrink-0">
        {PRIORITY_ICON[notification.priority]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm truncate', notification.status === 'unread' && 'font-medium')}>
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {timeAgo(notification.created_at, formatRelativeTime)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        {notification.deepLink && (
          <Link
            href={notification.deepLink.href}
            onClick={onClose}
            className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
          >
            {t('view')} <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {notification.status === 'unread' && (
          <button
            onClick={() => onRead(notification.id)}
            title={t('markRead')}
            className="p-1 rounded hover:bg-muted"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onArchive(notification.id)}
          title={t('archive')}
          className="p-1 rounded hover:bg-muted"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

interface NotificationBellProps {
  tenantId?: string
  branchId?: string
  className?: string
}

export function NotificationBell({ tenantId, branchId, className }: NotificationBellProps) {
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: summary } = useNotificationSummary(tenantId, branchId)
  const { data: unreadPage } = useUnreadNotifications({ tenantId, branchId, pageSize: 8 })
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const archive = useArchiveNotification()

  const unreadCount = summary?.unreadCount ?? 0
  const urgentCount = summary?.urgentCount ?? 0
  const notifications = unreadPage?.results ?? []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? t('bellWithUnreadAria', { count: unreadCount }) : t('title')}
        className={cn(
          'relative p-2 rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-muted',
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 flex items-center justify-center text-[10px] font-bold text-white rounded-full min-w-[16px] h-4 px-0.5',
              urgentCount > 0 ? 'bg-red-500' : 'bg-blue-500',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="font-semibold text-sm">{t('title')}</span>
                {unreadCount > 0 && (
                  <Badge variant="info" className="text-xs">
                    {t('unreadCount', { count: unreadCount })}
                  </Badge>
                )}
                {urgentCount > 0 && (
                  <Badge variant="danger" className="text-xs">
                    {t('urgentCount', { count: urgentCount })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAll.mutate({ tenantId, branchId })}
                    className="text-xs h-7"
                  >
                    {t('markAllRead')}
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">{t('noUnreadNotifications')}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotifItem
                    key={n.id}
                    notification={n}
                    onRead={(id) => markRead.mutate(id)}
                    onArchive={(id) => archive.mutate(id)}
                    onClose={() => setOpen(false)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5">
              <Link
                href="/console/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
              >
                {t('viewAllNotifications')} <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
