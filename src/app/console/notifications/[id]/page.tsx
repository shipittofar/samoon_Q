'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, AlertCircle, Info, AlertTriangle, Zap,
  Clock, ExternalLink, Loader2, Bell,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import {
  useNotification,
  useMarkNotificationRead,
  useArchiveNotification,
} from '@/hooks'
import type { NotificationPriority } from '@/types/notification'

const PRIORITY_ICON: Record<NotificationPriority, React.ElementType> = {
  low:    Info,
  normal: Bell,
  high:   AlertTriangle,
  urgent: AlertCircle,
}

const PRIORITY_BADGE: Record<NotificationPriority, 'secondary' | 'info' | 'warning' | 'danger'> = {
  low:    'secondary',
  normal: 'info',
  high:   'warning',
  urgent: 'danger',
}

const PRIORITY_BG: Record<NotificationPriority, string> = {
  low:    'bg-[var(--card-hover)]',
  normal: 'bg-[var(--info-subtle)]',
  high:   'bg-[var(--warning-subtle)]',
  urgent: 'bg-[var(--danger-subtle)]',
}

const PRIORITY_COLOR: Record<NotificationPriority, string> = {
  low:    'text-[var(--fg-muted)]',
  normal: 'text-[var(--info-text)]',
  high:   'text-[var(--rating)]',
  urgent: 'text-[var(--danger-text)]',
}

function NotificationDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: notification, isLoading, isError } = useNotification(id)
  const markRead = useMarkNotificationRead()
  const archive = useArchiveNotification()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2"/>
        {t('loadingNotificationEllipsis')}
      </div>
    )
  }

  if (isError || !notification) {
    return (
      <div className="flex items-center gap-2 text-[var(--danger-text)] p-4">
        <AlertCircle className="w-5 h-5"/>
        <p>{t('notificationNotFoundOrFailed')}</p>
      </div>
    )
  }

  const PriorityIcon = PRIORITY_ICON[notification.priority]
  const isUnread = notification.status === 'unread'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/console/notifications"className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="w-3.5 h-3.5"/>
        {t('breadcrumbs.notifications')}
      </Link>

      {/* Main card */}
      <div className="bg-[var(--card)] border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${PRIORITY_BG[notification.priority]}`}>
              <PriorityIcon className={`w-5 h-5 ${PRIORITY_COLOR[notification.priority]}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--fg)]">{notification.title}</h1>
              <p className="text-sm text-[var(--fg-muted)] capitalize mt-0.5">
                {notification.category} · {notification.type.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={PRIORITY_BADGE[notification.priority]} className="capitalize">{notification.priority}</Badge>
            {!isUnread && (
              <Badge variant="secondary"className="capitalize">{notification.status}</Badge>
            )}
          </div>
        </div>

        <p className="text-[var(--fg-secondary)] text-sm leading-relaxed border-t pt-4">{notification.message}</p>

        {/* Timestamps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-2 border-t">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('receivedLabel')}</p>
              <p className="font-medium text-[var(--fg)]">{new Date(notification.created_at).toLocaleString()}</p>
            </div>
          </div>
          {notification.readAt && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
              <div>
                <p className="text-[var(--fg-subtle)] text-xs">{t('readOption')}</p>
                <p className="font-medium text-[var(--fg)]">{new Date(notification.readAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          {notification.expiresAt && (
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
              <div>
                <p className="text-[var(--fg-subtle)] text-xs">{t('expiresLabel')}</p>
                <p className="font-medium text-[var(--fg)]">{new Date(notification.expiresAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Deep link */}
        {notification.deepLink && (
          <div className="border-t pt-4">
            <Link
              href={notification.deepLink.href}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--info-text)] hover:text-[var(--info-text)] font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5"/>
              {t('viewRelatedType', { type: notification.deepLink.type.replace(/_/g, ' ') })}
            </Link>
          </div>
        )}

        {/* Actor */}
        {notification.actor && (
          <div className="border-t pt-4 text-sm text-[var(--fg-muted)]">
            {t('triggeredByName', { name: notification.actor.name })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t pt-4">
          {isUnread && (
            <button
              onClick={() => markRead.mutate(id)}
              disabled={markRead.isPending}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--info)] text-[var(--info-fg)] hover:bg-[var(--info-hover)] disabled:opacity-50"
            >
              {t('markAsReadLabel')}
            </button>
          )}
          {notification.status !== 'archived' && (
            <button
              onClick={() => archive.mutate(id)}
              disabled={archive.isPending}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)] disabled:opacity-50"
            >
              {t('archiveTitle')}
            </button>
          )}
          <Link href="/console/notifications"className="ml-auto px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
            {t('backToListArrow')}
          </Link>
        </div>
      </div>

      {/* Raw data */}
      {notification.data && Object.keys(notification.data).length > 0 && (
        <div className="bg-[var(--card)] border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--fg-secondary)] mb-3">{t('eventDataLabel')}</h2>
          <pre className="text-xs bg-[var(--card-hover)] p-3 rounded-lg overflow-x-auto text-[var(--fg-secondary)]">
            {JSON.stringify(notification.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Notification Detail">
      <PermissionGuard permission="notifications.view"fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--card-hover)]">
          <div className="pt-16">
            <NotificationDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
