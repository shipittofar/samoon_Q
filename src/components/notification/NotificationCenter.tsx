'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, CheckCheck, Package, Calendar, Tag, Info, Trash2 } from 'lucide-react'
import { useNotificationStore } from '@/stores'
import { notificationService } from '@/services/combined.service'
import { cn, formatRelativeTime } from '@/utils'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import type { Notification, NotificationType } from '@/types'

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; label: string }> = {
  order_update: { icon: Package, color: 'text-blue-500', label: 'Order' },
  reservation_update: { icon: Calendar, color: 'text-purple-500', label: 'Reservation' },
  promotion: { icon: Tag, color: 'text-orange-500', label: 'Promotion' },
  system: { icon: Info, color: 'text-gray-500', label: 'System' },
}

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const { icon: Icon, color } = TYPE_CONFIG[notification.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onClick={() => !notification.is_read && onRead(notification.id)}
      className={cn(
        'flex gap-3 p-4 cursor-pointer hover:bg-[var(--card-hover)] transition-colors border-b border-[var(--border)] last:border-0',
        !notification.is_read && 'bg-orange-50/50 dark:bg-orange-950/10',
      )}
    >
      <div className={cn('h-9 w-9 rounded-full bg-[var(--card-hover)] flex items-center justify-center shrink-0', !notification.is_read && 'bg-orange-100 dark:bg-orange-950/30')}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium text-[var(--fg)] line-clamp-1', !notification.is_read && 'font-semibold')}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mt-0.5">{notification.message}</p>
        <p className="text-xs text-[var(--fg-subtle)] mt-1">{formatRelativeTime(notification.created_at)}</p>
      </div>
    </motion.div>
  )
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkRead = async (id: string) => {
    markRead(id)
    await notificationService.markRead(id).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    markAllRead()
    await notificationService.markAllRead().catch(() => {})
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative"
        aria-label={`Notifications — ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -end-0.5 h-4 min-w-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center px-1"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-full mt-2 w-80 sm:w-96 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--fg)]">
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="default" className="ms-2">{unreadCount}</Badge>
                )}
              </h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead} leftIcon={<CheckCheck className="h-3.5 w-3.5" />}>
                  Mark all read
                </Button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                  <Bell className="h-8 w-8 text-[var(--fg-subtle)]" />
                  <p className="text-sm text-[var(--fg-muted)]">No notifications yet</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} onRead={handleMarkRead} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
