'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbSegment {
  label: string
  href: string
}

const SEGMENT_LABELS: Record<string, string> = {
  admin:        'Admin',
  orders:       'Orders',
  reservations: 'Reservations',
  customers:    'Customers',
  vendors:      'Vendors',
  promotions:   'Promotions',
  branches:     'Branches',
  tenants:      'Tenants',
  staff:        'Staff',
  analytics:    'Analytics',
  notifications:'Notifications',
  'audit-logs': 'Audit Logs',
  operations:   'Operations',
  settings:     'Settings',
  kitchen:      'Kitchen Display',
  reviews:      'Reviews',
  menu:         'Menu',
}

function isId(segment: string): boolean {
  // UUID or short alphanumeric ID (not a known route name)
  return /^[0-9a-f-]{8,}$/i.test(segment) || (segment.length > 4 && !SEGMENT_LABELS[segment])
}

function labelForSegment(segment: string, prevSegment?: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  if (isId(segment)) {
    const parent = prevSegment ? (SEGMENT_LABELS[prevSegment] ?? prevSegment) : 'Item'
    return `${parent.replace(/s$/, '')} ${segment.slice(0, 8)}…`
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: BreadcrumbSegment[] = [{ label: 'Home', href: '/' }]
  let path = ''
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    path += `/${seg}`
    crumbs.push({
      label: labelForSegment(seg, segments[i - 1]),
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
  const crumbs = buildBreadcrumbs(pathname)

  if (crumbs.length <= 2) return null

  const visible = overrides
    ? crumbs.map((c, i) => overrides[i] ? { ...c, label: overrides[i] } : c)
    : crumbs

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm text-[var(--fg-muted)] ${className ?? ''}`}>
      {visible.map((crumb, i) => {
        const isLast = i === visible.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i === 0 ? (
              <Link href={crumb.href} className="hover:text-[var(--fg)] transition-colors" aria-label="Home">
                <Home className="h-3.5 w-3.5" />
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
