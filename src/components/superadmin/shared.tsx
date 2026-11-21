'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import { authService } from '@/services/auth.service'

export const selectClass =
  'h-10 rounded-xl border border-[var(--border-input)] bg-[var(--card)] px-3 text-sm text-[var(--fg)]'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-[var(--fg)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--fg-muted)] max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('superadmin')
  const variant = status === 'active' || status === 'approved' ? 'success'
    : status === 'pending' || status === 'pending_verification' ? 'warning'
      : status === 'closed' || status === 'rejected' || status === 'suspended' ? 'danger'
        : 'secondary'
  const key = `tenantStatus.${status}`
  const label = t.has(key) ? t(key) : t.has(`ownerStatus.${status}`) ? t(`ownerStatus.${status}`)
    : t.has(`register.status.${status}`) ? t(`register.status.${status}`) : status
  return <Badge variant={variant}>{label}</Badge>
}

export function BusinessTypeLabel({ value }: { value: string }) {
  const t = useTranslations('superadmin')
  return <>{t.has(`businessTypes.${value}`) ? t(`businessTypes.${value}`) : value}</>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations('superadmin')
  return (
    <div role="alert" className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-subtle)] p-4 text-sm text-[var(--danger-text)] flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="underline font-medium">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value.slice(0, 10)
  }
}

/**
 * Open a business in the console as a platform superuser: point the session
 * at it, then reload the console so the workspace boots from /auth/me (which
 * now lists the business with platformAccess).
 */
export async function openBusinessInConsole(tenantId: string): Promise<void> {
  await authService.switchActiveTenant({ tenantId })
  window.location.assign('/console')
}
