'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, MapPin, Phone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card, PaginationControls } from '@/components/ui'
import { cn } from '@/utils'
import {
  BusinessTypeLabel,
  ErrorBox,
  PageHeader,
  StatusBadge,
  formatDate,
} from '@/components/superadmin/shared'
import {
  apiErrorMessage,
  superadminService,
  type Paginated,
  type PlatformBusinessRequest,
} from '@/services/superadmin.service'

const PAGE_SIZE = 20
const TABS = ['pending', 'approved', 'rejected', 'all'] as const
type Tab = (typeof TABS)[number]

export default function PlatformRequestsPage() {
  const t = useTranslations('superadmin')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paginated<PlatformBusinessRequest> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PlatformBusinessRequest | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    superadminService
      .listRequests({ status: tab, page })
      .then(setData)
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false))
  }, [tab, page, t])
  useEffect(load, [load])

  const approve = async (item: PlatformBusinessRequest) => {
    setBusy(item.id)
    setError(null)
    setNotice(null)
    try {
      await superadminService.approveRequest(item.id)
      setNotice(t('requests.approvedMsg', { name: item.name }))
      load()
    } catch (err) {
      setError(apiErrorMessage(err, t('common.error')))
    } finally {
      setBusy(null)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    const item = rejecting
    setBusy(item.id)
    setError(null)
    setNotice(null)
    try {
      await superadminService.rejectRequest(item.id, reason)
      setNotice(t('requests.rejectedMsg', { name: item.name }))
      setRejecting(null)
      setReason('')
      load()
    } catch (err) {
      setError(apiErrorMessage(err, t('common.error')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title={t('requests.title')} subtitle={t('requests.subtitle')} />

      <div role="tablist" className="flex flex-wrap gap-1 mb-4 border-b border-[var(--border)]">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
              setPage(1)
            }}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-[var(--accent)] text-[var(--accent-text)]'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            {t(`requests.${key}`)}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className="mb-4 rounded-xl bg-[var(--success-subtle)] p-3 text-sm text-[var(--success-text)]">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {loading && !data && <p className="text-sm text-[var(--fg-muted)]">{t('common.loading')}</p>}
      {data && data.results.length === 0 && (
        <p className="py-10 text-center text-sm text-[var(--fg-muted)]">{t('requests.empty')}</p>
      )}

      <div className="space-y-3">
        {data?.results.map((item) => (
          <Card key={item.id} padding="sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--fg)]">{item.name}</span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    <BusinessTypeLabel value={item.business_type} />
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                {item.description && <p className="text-sm text-[var(--fg-muted)] whitespace-pre-line">{item.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fg-muted)]">
                  <span>
                    {t('requests.applicant')}: {item.applicant?.full_name || '—'}{' '}
                    <span dir="ltr">{item.applicant?.phone_number || item.applicant?.email || ''}</span>
                  </span>
                  {item.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span dir="ltr">{item.phone}</span>
                    </span>
                  )}
                  {(item.city || item.address) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {[item.city, item.address].filter(Boolean).join(locale === 'en' ? ', ' : '، ')}
                    </span>
                  )}
                  {item.latitude && item.longitude && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=16/${item.latitude}/${item.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent-text)] hover:underline"
                    >
                      {t('requests.location')}
                    </a>
                  )}
                  {item.service_radius_km ? (
                    <span>
                      {t('requests.radius')}: {t('requests.km', { km: item.service_radius_km })}
                    </span>
                  ) : null}
                  <span>{formatDate(item.created_at, locale)}</span>
                </div>
                {item.status === 'rejected' && item.rejection_reason && (
                  <p className="text-xs text-[var(--danger-text)]">
                    {t('requests.reason')}: {item.rejection_reason}
                  </p>
                )}
                {item.status !== 'pending' && item.decided_by && (
                  <p className="text-xs text-[var(--fg-muted)]">
                    {t('requests.decidedBy', {
                      name: item.decided_by.full_name || item.decided_by.phone_number || '—',
                    })}{' '}
                    · {formatDate(item.decided_at, locale)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {item.status === 'pending' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        setRejecting(item)
                        setReason('')
                      }}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      {t('requests.reject')}
                    </Button>
                    <Button
                      size="sm"
                      loading={busy === item.id}
                      disabled={busy !== null && busy !== item.id}
                      onClick={() => approve(item)}
                      leftIcon={<Check className="h-4 w-4" />}
                    >
                      {t('requests.approve')}
                    </Button>
                  </>
                )}
                {item.status === 'approved' && item.tenant_id && (
                  <Link href={`/console/platform/businesses/${item.tenant_id}`}>
                    <Button variant="secondary" size="sm">
                      {t('requests.viewBusiness')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

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

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={t('requests.rejectTitle')}
        description={rejecting?.name}
        size="sm"
      >
        <div className="space-y-4">
          <Textarea
            label={t('requests.reasonLabel')}
            placeholder={t('requests.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" loading={busy === rejecting?.id} onClick={confirmReject}>
              {t('requests.confirmReject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
