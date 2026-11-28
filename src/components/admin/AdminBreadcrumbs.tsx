'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LayoutDashboard } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BreadcrumbSegment {
  label: string
  href: string
}

type Translate = (key: string, values?: Record<string, string | number>) => string

const SEGMENT_KEYS: Record<string, string> = {
  admin:        'admin',
  orders:       'orders',
  reservations: 'reservations',
  customers:    'customers',
  vendors:      'vendors',
  promotions:   'promotions',
  branches:     'branches',
  tenants:      'tenants',
  staff:        'staff',
  analytics:    'analytics',
  notifications:'notifications',
  'audit-logs': 'auditLogs',
  operations:   'liveOperations',
  settings:     'settings',
  qr:           'qr',
  kitchen:      'kitchenDisplay',
  reviews:      'reviews',
  menu:         'menu',
  loyalty:      'loyalty',
  permissions:  'permissions',
  roles:        'roles',
  users:        'users',
  website:      'websiteBuilder',
  new:          'new',
  simulator:    'simulator',
  'feature-flags': 'featureFlags',
  'happy-hour': 'happyHour',
  'food-court': 'foodCourt',
  'food-truck': 'foodTruck',
  'mobile-cafe':'mobileCafe',
  bar:          'bar',
  cafe:         'cafe',
}

function isId(segment: string): boolean {
  // UUID or short alphanumeric ID (not a known route name)
  return /^[0-9a-f-]{8,}$/i.test(segment) || (segment.length > 4 && !SEGMENT_KEYS[segment])
}

function labelForSegment(t: Translate, segment: string, prevSegment?: string): string {
  const key = SEGMENT_KEYS[segment]
  if (key) return t(`breadcrumbs.${key}`)
  if (isId(segment)) {
    const parentKey = prevSegment ? SEGMENT_KEYS[prevSegment] : undefined
    const parent = parentKey ? t(`breadcrumbs.${parentKey}`) : t('breadcrumbs.item')
    return t('breadcrumbItemLabel', { parent: parent.replace(/s$/, ''), id: segment.slice(0, 8) })
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

function buildBreadcrumbs(t: Translate, pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split('/').filter(Boolean)
  // Home crumb points to /console (not public site root) — C4 fix (P8.9.4)
  const crumbs: BreadcrumbSegment[] = [{ label: t('breadcrumbs.admin'), href: '/console' }]
  let path = ''
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    path += `/${seg}`
    // Skip /console itself since it's already the root crumb
    if (path === '/console') continue
    crumbs.push({
      label: labelForSegment(t, seg, segments[i - 1]),
      href: path,
    })
  }
  return crumbs
}

interface AdminBreadcrumbsProps {
  className?: string
  /** Override specific segments by path position */
  overrides?: Record<number, string>
}

export function AdminBreadcrumbs({ className, overrides }: AdminBreadcrumbsProps) {
  const pathname = usePathname()
  const t = useTranslations('console')
  const crumbs = buildBreadcrumbs(t, pathname)

  // Show breadcrumbs whenever we're deeper than the admin root itself
  if (crumbs.length <= 1) return null

  const visible = overrides
    ? crumbs.map((c, i) => overrides[i] ? { ...c, label: overrides[i] } : c)
    : crumbs

  return (
    <nav aria-label={t('breadcrumbAria')} className={`flex items-center gap-1 text-sm text-[var(--fg-muted)] ${className ?? ''}`}>
      {visible.map((crumb, i) => {
        const isLast = i === visible.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i === 0 ? (
              <Link href={crumb.href} className="inline-flex items-center justify-center h-6 w-6 -m-1 rounded hover:text-[var(--fg)] transition-colors" aria-label={t('adminConsoleAria')}>
                <LayoutDashboard className="h-3.5 w-3.5" />
              </Link>
            ) : isLast ? (
              <span className="text-[var(--fg)] font-medium truncate max-w-[180px]" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-[var(--fg)] transition-colors truncate max-w-[140px]">
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </span>
        )
      })}
    </nav>
  )
}
