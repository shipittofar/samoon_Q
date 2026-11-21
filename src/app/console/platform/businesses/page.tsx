'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, PaginationControls } from '@/components/ui'
import {
  BusinessTypeLabel,
  ErrorBox,
  PageHeader,
  StatusBadge,
  formatDate,
  openBusinessInConsole,
  selectClass,
} from '@/components/superadmin/shared'
import {
  BUSINESS_TYPE_VALUES,
  superadminService,
  type Paginated,
  type PlatformTenantRow,
} from '@/services/superadmin.service'

const PAGE_SIZE = 20

function BusinessesList() {
  const t = useTranslations('superadmin')
  const locale = useLocale()
  const params = useSearchParams()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [ownerStatus, setOwnerStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paginated<PlatformTenantRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    superadminService
      .listTenants({ search: query, business_type: businessType, status, owner_status: ownerStatus, page })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [query, businessType, status, ownerStatus, page])

  useEffect(load, [load])

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1)
      setQuery(search.trim())
    }, 350)
    return () => clearTimeout(id)
  }, [search])

  const open = async (id: string) => {
    setOpening(id)
    try {
      await openBusinessInConsole(id)
    } catch {
      setOpening(null)
      setError(true)
    }
  }

  return (
    <div>
      <PageHeader title={t('businesses.title')} subtitle={t('businesses.subtitle')} />

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[220px]">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('businesses.searchPlaceholder')}
            aria-label={t('common.search')}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          aria-label={t('businesses.type')}
          className={selectClass}
          value={businessType}
          onChange={(e) => {
            setPage(1)
            setBusinessType(e.target.value)
          }}
        >
          <option value="">
            {t('businesses.type')}: {t('common.all')}
          </option>
          {BUSINESS_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`businessTypes.${v}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('businesses.status')}
          className={selectClass}
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          <option value="">
            {t('businesses.status')}: {t('common.all')}
          </option>
          {['active', 'inactive', 'closed'].map((v) => (
            <option key={v} value={v}>
              {t(`tenantStatus.${v}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('businesses.ownerStatus')}
          className={selectClass}
          value={ownerStatus}
          onChange={(e) => {
            setPage(1)
            setOwnerStatus(e.target.value)
          }}
        >
          <option value="">
            {t('businesses.ownerStatus')}: {t('common.all')}
          </option>
          {['active', 'pending_verification', 'suspended'].map((v) => (
            <option key={v} value={v}>
              {t(`ownerStatus.${v}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBox message={t('common.error')} onRetry={load} />
        </div>
      )}

      {data && <p className="mb-2 text-xs text-[var(--fg-muted)]">{t('businesses.count', { count: data.count })}</p>}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--card-hover)] text-[var(--fg-muted)] text-xs">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.name')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.owner')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.city')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.branches')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.status')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('businesses.created')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {data && data.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                    {t('common.noResults')}
                  </td>
                </tr>
              )}
              {data?.results.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/console/platform/businesses/${row.id}`}
                      className="font-medium text-[var(--fg)] hover:text-[var(--accent-text)]"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-[var(--fg-muted)] flex flex-wrap gap-x-2">
                      {row.business_types.length
                        ? row.business_types.map((bt) => <BusinessTypeLabel key={bt} value={bt} />)
                        : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--fg)]">{row.owner?.full_name || '—'}</div>
                    <div className="text-xs text-[var(--fg-muted)]" dir="ltr">
                      {row.owner?.phone_number || row.owner?.email || ''}
                    </div>
                    {row.owner_status !== 'active' && (
                      <div className="mt-1">
                        <StatusBadge status={row.owner_status} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-muted)]">{row.city || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{row.branch_count}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-muted)] whitespace-nowrap">
                    {formatDate(row.created_at, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/console/platform/businesses/${row.id}`}>
                        <Button variant="secondary" size="sm">
                          {t('businesses.details')}
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        loading={opening === row.id}
                        onClick={() => open(row.id)}
                        rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
                      >
                        {t('businesses.open')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data && data.count > PAGE_SIZE && (
        <div className="mt-4">
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            count={data.count}
            next={data.next}
            previous={data.previous}
            onPageChange={setPage}
            previousLabel={t('common.previous')}
            nextLabel={t('common.next')}
            pageOfLabel={t('common.pageOf', { page, total: Math.ceil(data.count / PAGE_SIZE) })}
          />
        </div>
      )}
    </div>
  )
}

export default function PlatformBusinessesPage() {
  return (
    <Suspense fallback={null}>
      <BusinessesList />
    </Suspense>
  )
}
