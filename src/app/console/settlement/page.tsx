'use client'

/**
 * Business console: settlement with the platform. Balances (available, on
 * hold, requested, owed), the business's commission terms, payout accounts
 * (Sheba or crypto, approved by the platform before use), payout requests and
 * the statement with CSV export. Owner only; the API enforces it too.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { isAxiosError } from 'axios'
import { Download, Landmark, Plus } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { selectClass } from '@/components/superadmin/shared'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import { apiErrorMessage } from '@/services/superadmin.service'
import {
  accountLabel,
  isValidIban,
  settlementService,
  type NewPayoutAccount,
  type OrderSettlementRow,
  type Payout,
  type PayoutAccountStatus,
  type PayoutStatus,
  type SettlementOverview,
  type StatementLine,
} from '@/services/settlement.service'
import { COIN_KEYS, type CoinKey, type Paged } from '@/services/wallet.service'
import { formatMoney } from '@/lib/currency'
import { onLiveChange } from '@/lib/live-updates'
import { useCurrencyStore } from '@/stores/currency'
import { cn } from '@/utils'

type Money = (v: string | number, code: string) => string

const ACCOUNT_BADGE: Record<PayoutAccountStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  disabled: 'secondary',
}
const PAYOUT_BADGE: Record<PayoutStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  requested: 'warning',
  paid: 'success',
  rejected: 'danger',
  cancelled: 'secondary',
}

function useMoney(): Money {
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  return useCallback((v, code) => formatMoney(v, code, locale, table), [locale, table])
}

function Balances({ overview, money }: { overview: SettlementOverview; money: Money }) {
  const t = useTranslations('settlement')
  const locale = useLocale()
  if (overview.balances.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-[var(--fg-muted)]">{t('noBalance')}</p>
      </Card>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {overview.balances.map((b) => {
        const owed = parseFloat(b.owed) > 0
        return (
          <Card key={b.currency} padding="md">
            <p className="text-xs text-[var(--fg-muted)]">
              {t('available')} · {b.currency}
            </p>
            <p className={cn('mt-1 text-2xl font-bold', owed ? 'text-[var(--danger-text)]' : 'text-[var(--fg)]')}>
              {money(b.available, b.currency)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-[var(--fg-muted)]">{t('pending')}</dt>
                <dd className="font-medium text-[var(--fg)]">{money(b.pending, b.currency)}</dd>
              </div>
              <div>
                <dt className="text-[var(--fg-muted)]">{t('reserved')}</dt>
                <dd className="font-medium text-[var(--fg)]">{money(b.reserved, b.currency)}</dd>
              </div>
              {owed && (
                <div className="col-span-2">
                  <dt className="text-[var(--danger-text)]">{t('owed')}</dt>
                  <dd className="font-medium text-[var(--danger-text)]">{money(b.owed, b.currency)}</dd>
                </div>
              )}
            </dl>
            {b.nextRelease && (
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                {t('nextRelease', { date: new Date(b.nextRelease).toLocaleString(locale) })}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function Terms({ overview }: { overview: SettlementOverview }) {
  const t = useTranslations('settlement')
  const { terms } = overview
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('terms')}</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant={terms.commissionIsCustom ? 'info' : 'secondary'}>{t('commission', { percent: terms.commissionPercent })}</Badge>
        <Badge variant={terms.holdIsCustom ? 'info' : 'secondary'}>{t('hold', { days: terms.holdDays })}</Badge>
        {(terms.commissionIsCustom || terms.holdIsCustom) && <Badge variant="success">{t('custom')}</Badge>}
      </div>
      <p className="mt-2 text-xs text-[var(--fg-muted)]">{t('termsHint')}</p>
    </Card>
  )
}

function AddAccount({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const t = useTranslations('settlement')
  const [form, setForm] = useState<NewPayoutAccount>({ kind: 'iban', asset: 'USDT_TRC20' })
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<NewPayoutAccount>) => setForm((f) => ({ ...f, ...patch }))
  const ibanBad = form.kind === 'iban' && Boolean(form.iban) && !isValidIban(form.iban ?? '')
  const ready =
    form.kind === 'iban' ? isValidIban(form.iban ?? '') && Boolean(form.holderName?.trim()) : Boolean(form.address?.trim())
  const save = async () => {
    setBusy(true)
    try {
      await settlementService.addAccount(tenantId, form)
      toast.success(t('accountAdded'))
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--border)] p-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {(['iban', 'crypto'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={form.kind === k}
            onClick={() => set({ kind: k })}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              form.kind === k
                ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--fg)]'
                : 'border-[var(--border)] text-[var(--fg-muted)]',
            )}
          >
            {k === 'iban' ? t('kindIban') : t('kindCrypto')}
          </button>
        ))}
      </div>
      {form.kind === 'iban' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label={t('iban')}
              dir="ltr"
              placeholder="IR000000000000000000000000"
              value={form.iban ?? ''}
              onChange={(e) => set({ iban: e.target.value.toUpperCase() })}
              error={ibanBad ? t('ibanInvalid') : undefined}
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('ibanHint')}</p>
          </div>
          <Input label={t('holderName')} value={form.holderName ?? ''} onChange={(e) => set({ holderName: e.target.value })} />
          <Input label={t('bankName')} value={form.bankName ?? ''} onChange={(e) => set({ bankName: e.target.value })} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--fg)]">{t('coin')}</span>
            <select className={selectClass} value={form.asset} onChange={(e) => set({ asset: e.target.value as CoinKey })}>
              {COIN_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <Input label={t('memo')} dir="ltr" value={form.memo ?? ''} onChange={(e) => set({ memo: e.target.value })} />
          <div className="sm:col-span-2">
            <Input
              label={t('address')}
              dir="ltr"
              spellCheck={false}
              value={form.address ?? ''}
              onChange={(e) => set({ address: e.target.value.trim() })}
            />
          </div>
        </div>
      )}
      <Input label={t('label')} value={form.label ?? ''} maxLength={80} onChange={(e) => set({ label: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button size="sm" loading={busy} disabled={!ready} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </div>
  )
}

function Accounts({ tenantId, overview, reload }: { tenantId: string; overview: SettlementOverview; reload: () => void }) {
  const t = useTranslations('settlement')
  const [adding, setAdding] = useState(false)
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }
  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--fg)]">{t('accounts')}</h2>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('addAccount')}
          </Button>
        )}
      </div>
      {adding && (
        <AddAccount
          tenantId={tenantId}
          onDone={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
      {overview.accounts.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-[var(--fg-muted)]">{t('noAccounts')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {overview.accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 break-all text-[var(--fg)]" dir="ltr">
                {accountLabel(a)}
              </span>
              <Badge variant="secondary">{a.currency}</Badge>
              {a.isDefault && <Badge variant="info">{t('default')}</Badge>}
              <Badge variant={ACCOUNT_BADGE[a.status]}>{t(`accountStatus.${a.status}`)}</Badge>
              {a.status === 'rejected' && a.reviewNote && (
                <span className="w-full text-xs text-[var(--danger-text)]">{a.reviewNote}</span>
              )}
              {a.status === 'approved' && !a.isDefault && (
                <button
                  type="button"
                  className="text-xs text-[var(--accent-text)] underline"
                  onClick={() => act(() => settlementService.defaultAccount(tenantId, a.id))}
                >
                  {t('makeDefault')}
                </button>
              )}
              <button
                type="button"
                className="text-xs text-[var(--fg-muted)] underline"
                onClick={() => act(() => settlementService.disableAccount(tenantId, a.id))}
              >
                {t('disable')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function RequestPayout({
  tenantId,
  overview,
  money,
  reload,
}: {
  tenantId: string
  overview: SettlementOverview
  money: Money
  reload: () => void
}) {
  const t = useTranslations('settlement')
  const approved = overview.accounts.filter((a) => a.status === 'approved')
  const [accountId, setAccountId] = useState(approved.find((a) => a.isDefault)?.id ?? approved[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const account = approved.find((a) => a.id === accountId)
  const balance = overview.balances.find((b) => b.currency === account?.currency)
  const available = Math.max(0, parseFloat(balance?.available ?? '0') || 0)
  const minimum = account ? overview.minPayout[account.currency] : undefined
  const value = parseFloat(amount)
  const ok = Boolean(account) && value > 0 && value <= available && (!minimum || value >= parseFloat(minimum))

  useEffect(() => {
    if (!approved.some((a) => a.id === accountId)) setAccountId(approved.find((a) => a.isDefault)?.id ?? approved[0]?.id ?? '')
  }, [approved, accountId])

  const submit = async () => {
    setBusy(true)
    try {
      await settlementService.requestPayout(tenantId, { accountId, amount })
      toast.success(t('requested'))
      setAmount('')
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('request')}</h2>
      {approved.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('noApproved')}</p>
      ) : (
        <div className="space-y-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--fg)]">{t('account')}</span>
            <select className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {approved.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)} · {a.currency}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label={`${t('amount')}${account ? ` (${account.currency})` : ''}`}
                type="number"
                min={0}
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {account && available > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setAmount(String(available))}>
                {t('all', { amount: money(available, account.currency) })}
              </Button>
            )}
          </div>
          {account && minimum && (
            <p className="text-xs text-[var(--fg-muted)]">{t('minimum', { amount: money(minimum, account.currency) })}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" loading={busy} disabled={!ok} onClick={submit}>
              {t('request')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function Payouts({ tenantId, money, version, reload }: { tenantId: string; money: Money; version: number; reload: () => void }) {
  const t = useTranslations('settlement')
  const locale = useLocale()
  const [data, setData] = useState<Paged<Payout> | null>(null)
  useEffect(() => {
    settlementService.payouts(tenantId).then(setData).catch(() => setData(null))
  }, [tenantId, version])
  const cancel = async (id: string) => {
    try {
      await settlementService.cancelPayout(tenantId, id)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('payouts')}</h2>
      {!data || data.results.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('noPayouts')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.results.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-semibold text-[var(--fg)]">{money(p.amount, p.currency)}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--fg-muted)]" dir="ltr">
                {accountLabel(p.account)}
              </span>
              {p.automatic && <Badge variant="secondary">{t('automatic')}</Badge>}
              <Badge variant={PAYOUT_BADGE[p.status]}>{t(`payoutStatus.${p.status}`)}</Badge>
              <span className="text-xs text-[var(--fg-muted)]">{new Date(p.createdAt).toLocaleDateString(locale)}</span>
              {p.status === 'requested' && (
                <button type="button" className="text-xs text-[var(--fg-muted)] underline" onClick={() => cancel(p.id)}>
                  {t('cancelRequest')}
                </button>
              )}
              {p.reference && (
                <span className="w-full text-xs text-[var(--fg-muted)]" dir="auto">
                  {t('reference', { ref: p.reference })}
                </span>
              )}
              {p.status === 'rejected' && p.note && <span className="w-full text-xs text-[var(--danger-text)]">{p.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Statement({ tenantId, money, currencies, version }: { tenantId: string; money: Money; currencies: string[]; version: number }) {
  const t = useTranslations('settlement')
  const locale = useLocale()
  const [currency, setCurrency] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<StatementLine> | null>(null)
  const [orders, setOrders] = useState<Paged<OrderSettlementRow> | null>(null)
  const [view, setView] = useState<'lines' | 'orders'>('lines')

  useEffect(() => {
    settlementService
      .statement(tenantId, { currency: currency || undefined, from: from || undefined, to: to || undefined, page })
      .then(setData)
      .catch(() => setData(null))
  }, [tenantId, currency, from, to, page, version])
  useEffect(() => {
    if (view === 'orders') settlementService.orders(tenantId).then(setOrders).catch(() => setOrders(null))
  }, [tenantId, view, version])

  const download = async () => {
    try {
      const blob = await settlementService.statementCsv(tenantId, {
        currency: currency || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statement-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1

  return (
    <Card padding="md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['lines', 'orders'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'rounded-lg px-2 py-1 text-sm font-semibold',
              view === v ? 'bg-[var(--accent-subtle)] text-[var(--fg)]' : 'text-[var(--fg-muted)]',
            )}
          >
            {v === 'lines' ? t('statement') : t('orders')}
          </button>
        ))}
        <Button size="sm" variant="ghost" className="ms-auto" onClick={download}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('downloadCsv')}
        </Button>
      </div>

      {view === 'lines' ? (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--fg)]">{t('allCurrencies')}</span>
              <select
                className={selectClass}
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('allCurrencies')}</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Input label={t('from')} type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
            <Input label={t('to')} type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
          </div>
          {!data || data.results.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.results.map((line) => {
                const incoming = parseFloat(line.amount) > 0
                return (
                  <li key={line.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--fg)]">
                        {t(`kind.${line.kind}`)}
                        {line.orderNumber ? ` · #${line.orderNumber}` : ''}
                      </p>
                      <p className="text-xs text-[var(--fg-muted)]">
                        {t(`bucket.${line.bucket}`)} · {new Date(line.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className={cn('font-semibold', incoming ? 'text-[var(--success-text)]' : 'text-[var(--fg)]')}>
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
        </>
      ) : !orders || orders.results.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {orders.results.map((o) => (
            <li key={o.orderId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium text-[var(--fg)]">#{o.orderNumber}</span>
              <Badge variant="secondary">{o.viaWallet ? t('viaWallet') : t('offline')}</Badge>
              <Badge variant={o.status === 'charged' ? 'warning' : o.status === 'held' ? 'info' : 'success'}>
                {t(`orderStatus.${o.status}`)}
              </Badge>
              <span className="ms-auto text-xs text-[var(--fg-muted)]">
                {t('gross')} {money(o.gross, o.currency)} · {t('commission', { percent: o.commissionPercent })}{' '}
                {money(o.commission, o.currency)} · {t('net')} {money(o.net, o.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function SettlementPage() {
  const t = useTranslations('settlement')
  const tenantId = useConsoleTenantId()
  const money = useMoney()
  const [overview, setOverview] = useState<SettlementOverview | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => onLiveChange(['settlement'], reload), [reload])
  useEffect(() => {
    if (!tenantId) return
    settlementService
      .overview(tenantId)
      .then((o) => {
        setOverview(o)
        setForbidden(false)
      })
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 403) setForbidden(true)
        else toast.error(apiErrorMessage(err, 'Error'))
      })
  }, [tenantId, version])

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Landmark className="mt-1 h-6 w-6 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('subtitle')}</p>
        </div>
      </div>
      {!tenantId ? (
        <Card padding="md">
          <p className="text-sm text-[var(--fg-muted)]">{t('noBusiness')}</p>
        </Card>
      ) : forbidden ? (
        <Card padding="md">
          <p className="text-sm text-[var(--fg-muted)]">{t('forbidden')}</p>
        </Card>
      ) : !overview ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--card-hover)]" />
      ) : (
        <>
          <Balances overview={overview} money={money} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RequestPayout key={`req-${version}`} tenantId={tenantId} overview={overview} money={money} reload={reload} />
            <Terms overview={overview} />
          </div>
          <Accounts tenantId={tenantId} overview={overview} reload={reload} />
          <Payouts tenantId={tenantId} money={money} version={version} reload={reload} />
          <Statement
            tenantId={tenantId}
            money={money}
            currencies={overview.balances.map((b) => b.currency)}
            version={version}
          />
        </>
      )}
    </div>
  )
}
