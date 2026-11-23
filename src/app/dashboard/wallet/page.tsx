'use client'

/**
 * Customer wallet: balance per currency and the ledger lines (payments,
 * refunds, top-ups, support adjustments), plus top-ups. Money moves only on
 * the server; after a gateway sends the payer back here (?topup=<id>) the
 * banner polls that top-up until the server has verified it.
 */
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Lock, Plus, Wallet, XCircle } from 'lucide-react'
import { Badge, Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { DirectTransfer, TopUpDialog } from '@/components/wallet/TopUpDialog'
import { formatMoney } from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'
import { walletService, type TopUp, type TopUpStatus } from '@/services/wallet.service'
import { cn } from '@/utils'

type Money = (amount: string | number, code: string) => string

const STATUS_BADGE: Record<TopUpStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  created: 'secondary',
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'secondary',
  expired: 'secondary',
}

/** Toman through the currency formatter; coins as "12.5 USDT". */
function topupAmount(amount: string, currency: string, money: Money) {
  return currency === 'IRT' ? money(amount, 'IRT') : `${amount} ${currency}`
}

const MAX_POLLS = 12

/** Result of a gateway round trip: polls while the server is still verifying. */
function ReturnBanner({ money }: { money: Money }) {
  const t = useTranslations('wallet.topup')
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.get('topup')
  const [polls, setPolls] = useState(0)
  const { data: topup, refetch } = useQuery({
    queryKey: ['wallet', 'topup', id],
    queryFn: () => walletService.topups.get(id as string),
    enabled: Boolean(id),
  })
  const waiting = topup?.status === 'pending' || topup?.status === 'created'

  useEffect(() => {
    if (!topup) return
    if (topup.status === 'paid') {
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'mine'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'lines'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'topups'] })
    }
    if (waiting && topup.provider !== 'direct' && polls < MAX_POLLS) {
      const timer = setTimeout(() => {
        setPolls((n) => n + 1)
        void refetch()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [topup, waiting, polls, refetch, queryClient])

  if (!id || !topup || topup.provider === 'direct') return null
  const paid = topup.status === 'paid'
  return (
    <Card padding="sm" role="status">
      <div className="flex items-start gap-3 text-sm">
        {paid ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--success-text)]" aria-hidden="true" />
        ) : waiting ? (
          <Clock className="h-5 w-5 shrink-0 text-[var(--warning-text)]" aria-hidden="true" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0 text-[var(--danger-text)]" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--fg)]">
            {paid
              ? t('resultPaid', { amount: topupAmount(topup.creditedAmount ?? topup.amount, topup.currency, money) })
              : waiting
                ? t('resultPending')
                : t('resultFailed')}
          </p>
          {topup.receiptRef && <p className="text-xs text-[var(--fg-muted)]">{t('receipt', { ref: topup.receiptRef })}</p>}
          {!paid && !waiting && topup.failureReason && (
            <p className="text-xs text-[var(--fg-muted)]">{topup.failureReason}</p>
          )}
        </div>
        {waiting && polls >= MAX_POLLS ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPolls(0)
              void refetch()
            }}
          >
            {t('check')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => router.replace('/dashboard/wallet')}>
            {t('close')}
          </Button>
        )}
      </div>
    </Card>
  )
}

function RecentTopUps({ money }: { money: Money }) {
  const t = useTranslations('wallet.topup')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)
  const { data } = useQuery({ queryKey: ['wallet', 'topups'], queryFn: () => walletService.topups.list() })
  if (!data || data.results.length === 0) return null
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['wallet', 'topups'] })
  const cancel = (tp: TopUp) => walletService.topups.cancel(tp.id).then(refresh, refresh)

  return (
    <Card padding="md">
      <h2 className="mb-3 text-sm font-semibold text-[var(--fg)]">{t('recent')}</h2>
      <ul className="divide-y divide-[var(--border)]">
        {data.results.map((tp) => {
          const awaitingTransfer = tp.provider === 'direct' && tp.status === 'pending'
          const cancellable = (tp.status === 'pending' || tp.status === 'created') && !tp.receiptRef && !tp.verified
          return (
            <li key={tp.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-[var(--fg)]">{topupAmount(tp.amount, tp.currency, money)}</span>
                <span className="text-[var(--fg-muted)]">
                  {t(`provider.${tp.provider}`)}
                  {tp.asset ? ` · ${tp.asset.replace('_', ' ')}` : ''} · #{tp.orderNumber} ·{' '}
                  {new Date(tp.createdAt).toLocaleString(locale)}
                </span>
                <span className="ms-auto flex items-center gap-2">
                  <Badge variant={STATUS_BADGE[tp.status]}>
                    {awaitingTransfer && tp.receiptRef ? t('reviewing') : t(`status.${tp.status}`)}
                  </Badge>
                  {awaitingTransfer && (
                    <button
                      type="button"
                      className="text-xs text-[var(--accent-text)] underline"
                      onClick={() => setOpen((o) => (o === tp.id ? null : tp.id))}
                      aria-expanded={open === tp.id}
                    >
                      {open === tp.id ? t('close') : t('directAddress')}
                    </button>
                  )}
                  {cancellable && (
                    <button type="button" className="text-xs text-[var(--fg-muted)] underline" onClick={() => cancel(tp)}>
                      {t('cancel')}
                    </button>
                  )}
                </span>
              </div>
              {tp.status === 'paid' && tp.creditedAmount && tp.creditedAmount !== tp.amount && (
                <p className="text-xs text-[var(--fg-muted)]">
                  {t('credited', { amount: topupAmount(tp.creditedAmount, tp.currency, money) })}
                </p>
              )}
              {tp.status === 'failed' && tp.failureReason && (
                <p className="text-xs text-[var(--fg-muted)]">{tp.failureReason}</p>
              )}
              {open === tp.id && (
                <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
                  <DirectTransfer topup={tp} onChange={refresh} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export default function WalletPage() {
  const t = useTranslations('wallet')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const queryClient = useQueryClient()
  const [currency, setCurrency] = useState('')
  const [page, setPage] = useState(1)
  const [topupOpen, setTopupOpen] = useState(false)

  const { data: accounts, isLoading } = useQuery({ queryKey: ['wallet', 'mine'], queryFn: () => walletService.mine() })
  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['wallet', 'lines', currency, page],
    queryFn: () => walletService.lines({ currency: currency || undefined, page, pageSize: 20 }),
  })
  const money: Money = (amount, code) => formatMoney(amount, code, locale, table)
  const totalPages = lines ? Math.max(1, Math.ceil(lines.count / lines.pageSize)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setTopupOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('topup.add')}
        </Button>
      </div>

      <Suspense fallback={null}>
        <ReturnBanner money={money} />
      </Suspense>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : !accounts || accounts.length === 0 ? (
        <Card padding="md">
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            <span>{t('noWallet')}</span>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <button
              key={a.currency}
              type="button"
              onClick={() => {
                setCurrency((c) => (c === a.currency ? '' : a.currency))
                setPage(1)
              }}
              aria-pressed={currency === a.currency}
              className={cn(
                'rounded-2xl border p-4 text-start transition-colors',
                currency === a.currency
                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent-border)]/50',
              )}
            >
              <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
                <span>
                  {t('balance')} · {a.currency}
                </span>
                {a.frozen && (
                  <Badge variant="warning" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" /> {t('frozen')}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--fg)]">{money(a.balance, a.currency)}</p>
            </button>
          ))}
        </div>
      )}

      <RecentTopUps money={money} />

      <Card padding="md">
        <h2 className="mb-3 text-sm font-semibold text-[var(--fg)]">{t('history')}</h2>
        {linesLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !lines || lines.results.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lines.results.map((line) => {
              const incoming = parseFloat(line.amount) > 0
              return (
                <li key={line.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      incoming ? 'bg-[var(--success-subtle)] text-[var(--success-text)]' : 'bg-[var(--card-hover)] text-[var(--fg-muted)]',
                    )}
                    aria-hidden="true"
                  >
                    {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--fg)]">{t(`kind.${line.kind}`)}</p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">
                      {line.orderId && line.orderNumber ? (
                        <Link href={`/order/${line.orderId}/track`} className="hover:underline">
                          {t('order', { number: line.orderNumber })}
                        </Link>
                      ) : (
                        line.description
                      )}
                      {' · '}
                      {new Date(line.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className={cn('text-sm font-semibold', incoming ? 'text-[var(--success-text)]' : 'text-[var(--fg)]')}>
                      {incoming ? '+' : '−'}
                      {money(Math.abs(parseFloat(line.amount)), line.currency)}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">{money(line.balanceAfter, line.currency)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex justify-center gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 disabled:opacity-40">
              ‹
            </button>
            <span className="text-[var(--fg-muted)]">
              {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 disabled:opacity-40">
              ›
            </button>
          </div>
        )}
      </Card>

      <TopUpDialog
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['wallet', 'topups'] })}
      />
    </div>
  )
}
