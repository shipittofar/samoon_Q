'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, ClipboardList, BookOpen, Users, UserCheck, Store, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui'
import { PageHeader, ErrorBox } from '@/components/superadmin/shared'
import { superadminService, type PlatformOverview } from '@/services/superadmin.service'

interface OverviewCard {
  key: 'tenants' | 'activeTenants' | 'pendingRequests' | 'menuTemplates' | 'owners' | 'users'
  icon: LucideIcon
  href?: string
}

const CARDS: OverviewCard[] = [
  { key: 'tenants', icon: Building2, href: '/console/platform/businesses' },
  { key: 'activeTenants', icon: Store, href: '/console/platform/businesses?status=active' },
  { key: 'pendingRequests', icon: ClipboardList, href: '/console/platform/requests' },
  { key: 'menuTemplates', icon: BookOpen, href: '/console/platform/menu-templates' },
  { key: 'owners', icon: UserCheck },
  { key: 'users', icon: Users },
]

export default function PlatformOverviewPage() {
  const t = useTranslations('superadmin')
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState(false)

  const load = () => {
    setError(false)
    superadminService.overview().then(setData).catch(() => setError(true))
  }
  useEffect(load, [])

  const values: Partial<Record<OverviewCard['key'], number>> = data
    ? {
        tenants: data.tenants,
        activeTenants: data.active_tenants,
        pendingRequests: data.pending_business_requests,
        menuTemplates: data.menu_templates,
        owners: data.owners,
        users: data.users,
      }
    : {}

  return (
    <div>
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />
      {error && (
        <div className="mb-4">
          <ErrorBox message={t('common.error')} onRetry={load} />
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ key, icon: Icon, href }) => {
          const body = (
            <Card padding="sm" hover={Boolean(href)} className="h-full">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--fg-muted)] truncate">{t(`overview.${key}`)}</p>
                  <p className="text-2xl font-semibold text-[var(--fg)] tabular-nums">
                    {values[key] ?? (error ? '—' : '…')}
                  </p>
                </div>
              </div>
            </Card>
          )
          return href ? (
            <Link key={key} href={href} className="block rounded-2xl">
              {body}
            </Link>
          ) : (
            <div key={key}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}
