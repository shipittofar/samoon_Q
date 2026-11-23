'use client'

/**
 * Platform superuser: user wallets. Search users, see balances and ledger
 * lines, adjust a balance with a required reason (one idempotency key per
 * submission so a double click cannot post twice), freeze a wallet, check
 * ledger health and set limits.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { CheckCircle2, AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui'
import { PageHeader, selectClass } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import {
  walletService,
  type WalletHealth,
  type WalletLimits,
  type WalletLinesPage,
  type WalletUserRow,
} from '@/services/wallet.service'
import { formatMoney } from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

function HealthCard() {
  const t = useTranslations('wallet.admin')
  const [health, setHealth] = useState<WalletHealth | null>(null)
  useEffect(() => {
    walletService.admin.health().then(setHealth).catch(() => setHealth(null))
  }, [])
  if (!health) return null
  return (
    <Card padding="sm">
      <div className="flex items-start gap-2 text-sm">
        {health.ok ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-[var(--danger-text)]" aria-hidden="true" />
        )}
        <div>
          <p className="font-medium text-[var(--fg)]">{t('health')}</p>
          <p className="text-[var(--fg-muted)]">
            {health.ok ? t('healthOk', { accounts: health.accounts, transactions: health.transactions }) : t('healthBad')}
          </p>
          {health.problems.map((p) => (
            <p key={p} className="text-xs text-[var(--danger-text)]" dir="ltr">
              {p}
            </p>
          ))}
        </div>
      </div>
    </Card>
  )
}

function LimitsCard({ currencies }: { currencies: string[] }) {
  const t = useTranslations('wallet.admin')
  const [limits, setLimits] = useState<WalletLimits>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    walletService.admin.limits().then(setLimits).catch(() => undefined)
  }, [])
  const rows: { key: keyof WalletLimits; label: string }[] = [
    { key: 'per_transaction', label: t('perTransaction') },
    { key: 'daily_spend', label: t('dailySpend') },
    { key: 'daily_topup', label: t('dailyTopup') },
  ]
  const set = (key: keyof WalletLimits, code: string, value: string) =>
    setLimits((l) => ({ ...l, [key]: { ...(l[key] ?? {}), [code]: value } }))
  const save = async () => {
    setSaving(true)
    try {
      setLimits(await walletService.admin.saveLimits(limits))
      toast.success(t('applied'))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card padding="sm">
      <h2 className="text-sm font-semibold text-[var(--fg)]">{t('limits')}</h2>
      <p className="mb-3 text-xs text-[var(--fg-muted)]">{t('limitsHint')}</p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <p className="mb-1 text-xs font-medium text-[var(--fg)]">{row.label}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {currencies.map((code) => (
                <Input
                  key={code}
                  label={code}
                  type="number"
                  min={0}
                  dir="ltr"
                  value={limits[row.key]?.[code] ?? ''}
                  onChange={(e) => set(row.key, code, e.target.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={saving} onClick={save}>
          {t('saveLimits')}
        </Button>
      </div>
    </Card>
  )
}

function UserPanel({ userId, currencies }: { userId: string; currencies: string[] }) {
  const t = useTranslations('wallet.admin')
  const tw = useTranslations('wallet')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const [data, setData] = useState<(WalletUserRow & { lines: WalletLinesPage }) | null>(null)
  const [currency, setCurrency] = useState(currencies[0] ?? 'IRT')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    walletService.admin.user(userId).then(setData).catch((err) => toast.error(apiErrorMessage(err, 'Error')))
  }, [userId])
  useEffect(load, [load])

  const apply = async () => {
    setBusy(true)
    try {
      await walletService.admin.adjust(userId, { currency, amount, reason, idempotencyKey: key })
      toast.success(t('applied'))
      setAmount('')
      setReason('')
      setKey(newKey()) // next adjustment is a new operation
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(false)
    }
  }

  const toggleFreeze = async (code: string, frozen: boolean) => {
    try {
      await walletService.admin.freeze(userId, code, frozen)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }

  if (!data) return null
  const money = (v: string | number, code: string) => formatMoney(v, code, locale, table)
  return (
    <Card padding="sm" className="space-y-4">
      <div>
        <p className="font-semibold text-[var(--fg)]">{data.name || data.phone || data.email}</p>
        <p className="text-xs text-[var(--fg-muted)]" dir="ltr">
          {data.phone} {data.email}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.accounts.map((a) => (
          <div key={a.currency} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
            <span className="font-semibold text-[var(--fg)]">{money(a.balance, a.currency)}</span>
            <button
              type="button"
              className="ms-3 text-xs text-[var(--fg-muted)] underline"
              onClick={() => toggleFreeze(a.currency, !a.frozen)}
            >
              {a.frozen ? t('unfreeze') : t('freeze')}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] p-3">
        <p className="mb-2 text-sm font-medium text-[var(--fg)]">{t('adjust')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--fg)]">{t('currency')}</span>
            <select className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Input label={t('amount')} type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label={t('reason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={busy} disabled={!amount || !reason.trim()} onClick={apply}>
            {t('apply')}
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)] text-sm">
        {data.lines.results.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-[var(--fg)]">
              {tw(`kind.${line.kind}`)}
              {line.orderNumber ? ` · #${line.orderNumber}` : ''}
              {line.description && !line.orderNumber ? ` · ${line.description}` : ''}
            </span>
            <span className="text-[var(--fg-muted)]">
              <span className={parseFloat(line.amount) > 0 ? 'text-[var(--success-text)]' : ''}>
                {parseFloat(line.amount) > 0 ? '+' : '−'}
                {money(Math.abs(parseFloat(line.amount)), line.currency)}
              </span>
              {' → '}
              {money(line.balanceAfter, line.currency)} · {new Date(line.createdAt).toLocaleString(locale)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function PlatformWalletsPage() {
  const t = useTranslations('wallet.admin')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const currencies = Object.values(table)
    .filter((c) => c.enabled)
    .map((c) => c.code)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<WalletUserRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const find = useCallback(async (q: string) => {
    try {
      setRows(await walletService.admin.users(q))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }, [])
  useEffect(() => {
    void find('')
  }, [find])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <HealthCard />
      <Card padding="sm">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void find(search)
          }}
        >
          <Input value={search} placeholder={t('search')} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="secondary" size="sm" aria-label={t('search')}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {rows.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u.id)}
                className="flex w-full items-center justify-between gap-3 py-2 text-start text-sm hover:bg-[var(--card-hover)]"
              >
                <span className="text-[var(--fg)]">{u.name || u.phone || u.email}</span>
                <span className="text-[var(--fg-muted)]">
                  {u.accounts.map((a) => formatMoney(a.balance, a.currency, locale, table)).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {selected && <UserPanel key={selected} userId={selected} currencies={currencies.length ? currencies : ['IRT']} />}
      <LimitsCard currencies={currencies.length ? currencies : ['IRT']} />
    </div>
  )
}
