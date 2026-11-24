'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowDownToLine, BookOpen, Landmark, Building2, ClipboardList, Coins, Gauge, ShieldCheck, Wallet } from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore, useRbacStore } from '@/stores'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'
import { superadminService } from '@/services/superadmin.service'

const LINKS = [
  { href: '/console/platform', key: 'overview', icon: Gauge, exact: true },
  { href: '/console/platform/businesses', key: 'businesses', icon: Building2 },
  { href: '/console/platform/requests', key: 'requests', icon: ClipboardList },
  { href: '/console/platform/menu-templates', key: 'menuTemplates', icon: BookOpen },
  { href: '/console/platform/currencies', key: 'currencies', icon: Coins },
  { href: '/console/platform/wallets', key: 'wallets', icon: Wallet },
  { href: '/console/platform/topups', key: 'topups', icon: ArrowDownToLine },
  { href: '/console/platform/settlement', key: 'settlement', icon: Landmark },
] as const

/** Sidebar section shown to platform superusers only. */
export function SuperuserNavSection({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('superadmin')
  const pathname = usePathname()
  const isSuperuser = isPlatformSuperuser(useAuthStore((s) => s.user))
  const [pending, setPending] = useState<number | null>(null)

  useEffect(() => {
    if (!isSuperuser) return
    superadminService
      .overview()
      .then((o) => setPending(o.pending_business_requests))
      .catch(() => setPending(null))
  }, [isSuperuser, pathname])

  if (!isSuperuser) return null

  return (
    <div className="px-2 mb-3">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] opacity-60 select-none">
        {t('nav.group')}
      </p>
      <div className="space-y-0.5">
        {LINKS.map(({ href, key, icon: Icon, ...rest }) => {
          const exact = 'exact' in rest && rest.exact
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px]',
                active
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate flex-1">{t(`nav.${key}`)}</span>
              {key === 'requests' && pending ? (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--warning)] text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                  {pending}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/**
 * "Superuser mode" badge for the console context bar: shown while a
 * superuser works in a business they neither own nor work in.
 */
export function SuperuserModeBadge() {
  const t = useTranslations('superadmin')
  const activeTenantId = useRbacStore((s) => s.activeMembership?.tenantId)
  const memberships = useRbacStore((s) => s.sessionMemberships)
  const record = activeTenantId ? (memberships ?? []).find((m) => m.tenantId === activeTenantId) : undefined
  if (!record?.platformAccess) return null
  return (
    <Link
      href="/console/platform/businesses"
      title={t('mode.hint')}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--warning-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--warning-text)] hover:opacity-90"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t('mode.badge')}</span>
      <span className="hidden sm:inline opacity-80">· {t('mode.switch')}</span>
    </Link>
  )
}
