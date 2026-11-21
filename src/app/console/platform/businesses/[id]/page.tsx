'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ExternalLink, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui'
import {
  BusinessTypeLabel,
  ErrorBox,
  PageHeader,
  StatusBadge,
  formatDate,
  openBusinessInConsole,
} from '@/components/superadmin/shared'
import { superadminService, type PlatformTenantDetail } from '@/services/superadmin.service'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--fg-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--fg)] break-words">{children}</dd>
    </div>
  )
}

export default function PlatformBusinessDetailPage() {
  const t = useTranslations('superadmin')
  const locale = useLocale()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PlatformTenantDetail | null>(null)
  const [error, setError] = useState<'not_found' | 'other' | null>(null)
  const [opening, setOpening] = useState(false)

  const load = useCallback(() => {
    setError(null)
    superadminService
      .getTenant(id)
      .then(setData)
      .catch((err: { response?: { status?: number } }) =>
        setError(err?.response?.status === 404 ? 'not_found' : 'other'),
      )
  }, [id])
  useEffect(load, [load])

  const open = async () => {
    setOpening(true)
    try {
      await openBusinessInConsole(id)
    } catch {
      setOpening(false)
      setError('other')
    }
  }

  const back = (
    <Link
      href="/console/platform/businesses"
      className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] mb-3"
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      {t('nav.businesses')}
    </Link>
  )

  if (error === 'not_found') {
    return (
      <div>
        {back}
        <ErrorBox message={t('detail.notFound')} />
      </div>
    )
  }
  if (!data) {
    return (
      <div>
        {back}
        {error ? <ErrorBox message={t('common.error')} onRetry={load} /> : (
          <p className="text-sm text-[var(--fg-muted)]">{t('common.loading')}</p>
        )}
      </div>
    )
  }

  const counts: [string, string | number][] = [
    [t('detail.branches'), data.counts.branches],
    [t('detail.categories'), data.counts.categories],
    [t('detail.menuItems'), data.counts.menu_items],
    [t('detail.staff'), data.counts.staff],
    [t('detail.orders'), data.counts.orders],
    [t('detail.ordersLast30'), data.counts.orders_last_30_days],
    [t('detail.revenueLast30'), Number(data.counts.revenue_last_30_days).toLocaleString(locale)],
    [t('detail.reservations'), data.counts.reservations],
  ]

  return (
    <div>
      {back}
      <PageHeader
        title={data.name}
        subtitle={data.description || undefined}
        actions={
          <Button loading={opening} onClick={open} rightIcon={<ExternalLink className="h-4 w-4" />}>
            {opening ? t('detail.opening') : t('businesses.open')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <StatusBadge status={data.status} />
        {data.business_types.map((bt) => (
          <Badge key={bt} variant="outline">
            <BusinessTypeLabel value={bt} />
          </Badge>
        ))}
        {data.registration_request && <Badge variant="info">{t('detail.fromRequest')}</Badge>}
        <span className="text-xs text-[var(--fg-muted)]">
          {t('detail.createdAt')}: {formatDate(data.created_at, locale)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {counts.map(([label, value]) => (
          <Card key={label} padding="sm">
            <p className="text-xs text-[var(--fg-muted)]">{label}</p>
            <p className="text-xl font-semibold tabular-nums text-[var(--fg)]">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card padding="sm" className="lg:col-span-1">
          <h2 className="text-sm font-semibold mb-3">{t('detail.owner')}</h2>
          <dl className="space-y-3">
            <Field label={t('businesses.owner')}>{data.owner.full_name || '—'}</Field>
            <Field label={t('detail.phone')}>
              <span dir="ltr">{data.owner.phone_number || '—'}</span>
            </Field>
            <Field label={t('detail.email')}>
              <span dir="ltr">{data.owner.email || '—'}</span>
            </Field>
            <Field label={t('businesses.status')}>
              <StatusBadge status={data.owner.status} />
            </Field>
            {data.owner.plan && <Field label={t('detail.plan')}>{data.owner.plan}</Field>}
            <Field label={t('detail.ownerSince')}>{formatDate(data.owner.since, locale)}</Field>
            {data.owner.other_tenants.length > 0 && (
              <Field label={t('detail.otherBusinesses')}>
                <ul className="space-y-1">
                  {data.owner.other_tenants.map((o) => (
                    <li key={o.id}>
                      <Link href={`/console/platform/businesses/${o.id}`} className="text-[var(--accent-text)] hover:underline">
                        {o.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
          </dl>

          <h2 className="text-sm font-semibold mt-6 mb-3">{t('detail.settings')}</h2>
          <dl className="space-y-3">
            <Field label={t('detail.tax')}>{data.tax_percentage}%</Field>
            <Field label={t('detail.serviceCharge')}>{data.service_charge_percentage}%</Field>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[var(--fg-muted)]">JSON</summary>
            <pre dir="ltr" className="mt-2 max-h-72 overflow-auto rounded-lg bg-[var(--card-hover)] p-2 text-[11px] leading-snug">
              {JSON.stringify(data.settings, null, 2)}
            </pre>
          </details>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold">{t('detail.branches')}</h2>
          {data.branches.length === 0 && <p className="text-sm text-[var(--fg-muted)]">{t('detail.noBranches')}</p>}
          {data.branches.map((b) => {
            const flags: [string, boolean][] = [
              [t('detail.ordering'), b.ordering_enabled],
              [t('detail.delivery'), b.delivery_enabled],
              [t('detail.pickup'), b.pickup_enabled],
              [t('detail.tableOrdering'), b.table_ordering_enabled],
              [t('detail.reservationsEnabled'), b.reservations_enabled],
              [t('detail.marketplace'), b.marketplace_visible],
            ]
            return (
              <Card key={b.id} padding="sm">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-medium text-[var(--fg)]">{b.name || data.name}</span>
                  {b.is_default && <Badge variant="info">{t('detail.defaultBranch')}</Badge>}
                  <StatusBadge status={b.status} />
                  <span className="text-xs text-[var(--fg-muted)]">{t('detail.items', { count: b.item_count })}</span>
                </div>
                <div className="space-y-1 text-sm text-[var(--fg-muted)]">
                  {(b.city || b.address) && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{[b.city, b.address].filter(Boolean).join(locale === 'en' ? ', ' : '، ')}</span>
                    </p>
                  )}
                  {b.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span dir="ltr">{b.phone}</span>
                    </p>
                  )}
                  {b.delivery_radius_km ? <p>{t('detail.radius', { km: b.delivery_radius_km })}</p> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {flags.map(([label, on]) => (
                    <Badge key={label} variant={on ? 'success' : 'secondary'}>
                      {label}: {on ? t('common.yes') : t('common.no')}
                    </Badge>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
