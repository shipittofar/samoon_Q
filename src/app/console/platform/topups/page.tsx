'use client'

/**
 * Platform superuser: wallet top-ups. "Needs review" lists direct crypto
 * transfers whose payer submitted a transaction hash, and gateway payments
 * that were verified but could not be credited. Approve only after checking
 * the transaction on-chain; a rejected one is never credited.
 */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Search, Settings } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader, selectClass } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import { walletService, type AdminTopUp, type Paged, type TopUpStatus } from '@/services/wallet.service'
import { formatMoney } from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'

const BADGE: Record<TopUpStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  created: 'secondary',
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'secondary',
  expired: 'secondary',
}

function Review({ topup, onDone }: { topup: AdminTopUp; onDone: () => void }) {
  const t = useTranslations('wallet.topupAdmin')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const run = async (kind: 'approve' | 'reject') => {
    setBusy(kind)
    try {
      if (kind === 'approve') await walletService.admin.approveTopUp(topup.id, { amount: amount || undefined, note })
      else await walletService.admin.rejectTopUp(topup.id, reason)
      toast.success(t('saved'))
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Input label={t('approveAmount')} type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label={t('note')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" loading={busy === 'approve'} onClick={() => run('approve')}>
          {t('approve')}
        </Button>
      </div>
      <div className="space-y-2">
        <Input label={t('rejectReason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="secondary" loading={busy === 'reject'} disabled={!reason.trim()} onClick={() => run('reject')}>
          {t('reject')}
        </Button>
      </div>
    </div>
  )
}

export default function PlatformTopUpsPage() {
  const t = useTranslations('wallet.topupAdmin')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const [status, setStatus] = useState('review')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminTopUp> | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await walletService.admin.topups({ status: status || undefined, search: search || undefined, page }))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }, [status, search, page])
  useEffect(() => {
    void load()
    // search runs on submit, not on each key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  const amount = (v: string, code: string) => (code === 'IRT' ? formatMoney(v, code, locale, table) : `${v} ${code}`)
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1
  const reviewable = (tp: AdminTopUp) =>
    tp.status !== 'paid' && ((tp.provider === 'direct' && Boolean(tp.receiptRef)) || tp.verified)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Link href="/console/platform/topups/settings">
            <Button size="sm" variant="secondary">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t('settingsLink')}
            </Button>
          </Link>
        }
      />
      <Card padding="sm">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            void load()
          }}
        >
          <select
            className={selectClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            aria-label={t('filterAll')}
          >
            <option value="review">{t('filterReview')}</option>
            <option value="">{t('filterAll')}</option>
            {(['pending', 'paid', 'failed', 'cancelled', 'expired'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <div className="min-w-0 flex-1">
            <Input value={search} placeholder={t('search')} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" size="sm" aria-label={t('search')}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </Card>

      <Card padding="sm">
        {!data ? (
          <div className="h-24 animate-pulse rounded-xl bg-[var(--card-hover)]" />
        ) : data.results.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--fg-muted)]">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.results.map((tp) => (
              <li key={tp.id} className="py-3">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-2 text-start text-sm"
                  onClick={() => setOpen((o) => (o === tp.id ? null : tp.id))}
                  aria-expanded={open === tp.id}
                >
                  <span className="font-semibold text-[var(--fg)]">{amount(tp.amount, tp.currency)}</span>
                  <span className="text-[var(--fg-muted)]">
                    {t(`provider.${tp.provider}`)}
                    {tp.asset ? ` · ${tp.asset.replace('_', ' ')}` : ''} · #{tp.orderNumber}
                  </span>
                  <span className="text-[var(--fg-muted)]">{tp.user.name || tp.user.phone || tp.user.email}</span>
                  <span className="ms-auto flex items-center gap-2">
                    {tp.verified && tp.status !== 'paid' && <Badge variant="danger">{t('verifiedNotCredited')}</Badge>}
                    <Badge variant={BADGE[tp.status]}>
                      {tp.provider === 'direct' && tp.status === 'pending' && tp.receiptRef
                        ? t('filterReview')
                        : t(`status.${tp.status}`)}
                    </Badge>
                    <span className="text-xs text-[var(--fg-muted)]">{new Date(tp.createdAt).toLocaleString(locale)}</span>
                  </span>
                </button>
                {open === tp.id && (
                  <div className="mt-2 space-y-2 text-xs text-[var(--fg-muted)]">
                    <p dir="ltr" className="break-all">
                      {tp.user.phone} {tp.user.email} · ref {tp.gatewayRef || '—'}
                      {tp.receiptRef ? ` · ${t('txHash')} ${tp.receiptRef}` : ''}
                      {tp.cardPan ? ` · ${tp.cardPan}` : ''}
                    </p>
                    {tp.instructions && (
                      <p dir="ltr" className="break-all">
                        {tp.instructions.network}: {tp.instructions.address}
                        {tp.instructions.memo ? ` · memo/tag ${tp.instructions.memo}` : ''}
                      </p>
                    )}
                    {tp.creditedAmount && <p>= {amount(tp.creditedAmount, tp.currency)}</p>}
                    {tp.failureReason && <p className="text-[var(--danger-text)]">{tp.failureReason}</p>}
                    <ul className="max-h-40 overflow-auto rounded-lg bg-[var(--card-hover)] p-2 font-mono" dir="ltr">
                      {tp.log.map((entry, i) => (
                        <li key={i}>
                          {entry.at.slice(0, 19)} {entry.event}
                        </li>
                      ))}
                    </ul>
                    {reviewable(tp) && (
                      <Review
                        topup={tp}
                        onDone={() => {
                          setOpen(null)
                          void load()
                        }}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="mt-3 flex justify-center gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 disabled:opacity-40">
              ‹
            </button>
            <span className="text-[var(--fg-muted)]">
              {page} / {pages}
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 disabled:opacity-40">
              ›
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
