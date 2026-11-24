'use client'

/**
 * Platform superuser: settlement with businesses. Totals per currency, the
 * payout queue (mark paid with the bank reference / tx hash, or reject),
 * payout accounts to approve, platform defaults (commission, hold period,
 * minimum payout, weekly automatic requests: off by default) and
 * per-business terms.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader, selectClass } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import {
  settlementService,
  type Payout,
  type PayoutAccount,
  type PayoutStatus,
  type PlatformSettlementOverview,
  type SettlementSettings,
  type TenantSettlementRow,
} from '@/services/settlement.service'
import type { Paged } from '@/services/wallet.service'
import { formatMoney } from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'

type Money = (v: string | number, code: string) => string

const PAYOUT_BADGE: Record<PayoutStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  requested: 'warning',
  paid: 'success',
  rejected: 'danger',
  cancelled: 'secondary',
}

function Totals({ data, money }: { data: PlatformSettlementOverview; money: Money }) {
  const t = useTranslations('settlement')
  if (data.currencies.length === 0) return null
  const cols: { key: keyof PlatformSettlementOverview['currencies'][number]; label: string }[] = [
    { key: 'revenue', label: t('admin.revenue') },
    { key: 'available', label: t('available') },
    { key: 'pending', label: t('pending') },
    { key: 'reserved', label: t('reserved') },
    { key: 'owed', label: t('owed') },
    { key: 'paidOut', label: t('admin.paidOut') },
  ]
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('admin.totals')}</h2>
      <div className="space-y-3">
        {data.currencies.map((row) => (
          <dl key={row.currency} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {cols.map((c) => (
              <div key={c.key}>
                <dt className="text-xs text-[var(--fg-muted)]">
                  {c.label} · {row.currency}
                </dt>
                <dd className="font-semibold text-[var(--fg)]">{money(row[c.key], row.currency)}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </Card>
  )
}

function PayoutRow({ payout, money, onDone }: { payout: Payout; money: Money; onDone: () => void }) {
  const t = useTranslations('settlement')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'paid' | 'reject' | null>(null)
  const a = payout.account
  const run = async (kind: 'paid' | 'reject') => {
    setBusy(kind)
    try {
      if (kind === 'paid') await settlementService.admin.markPaid(payout.id, { reference, note })
      else await settlementService.admin.rejectPayout(payout.id, reason)
      toast.success(t('admin.saved'))
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(null)
    }
  }
  return (
    <li className="py-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-start text-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-semibold text-[var(--fg)]">{money(payout.amount, payout.currency)}</span>
        <span className="text-[var(--fg)]">{payout.tenant?.name}</span>
        {payout.automatic && <Badge variant="secondary">{t('automatic')}</Badge>}
        <span className="ms-auto flex items-center gap-2">
          <Badge variant={PAYOUT_BADGE[payout.status]}>{t(`payoutStatus.${payout.status}`)}</Badge>
          <span className="text-xs text-[var(--fg-muted)]">{new Date(payout.createdAt).toLocaleString(locale)}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-3 text-sm">
          <div className="rounded-xl bg-[var(--card-hover)] p-3 text-xs" dir="ltr">
            {a.kind === 'iban' ? (
              <>
                <p className="font-mono text-sm text-[var(--fg)]">{a.iban}</p>
                <p className="text-[var(--fg-muted)]">
                  {a.holderName}
                  {a.bankName ? ` · ${a.bankName}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-[var(--fg-muted)]">{a.asset.replace('_', ' ')}</p>
                <p className="break-all font-mono text-sm text-[var(--fg)]">{a.address}</p>
                {a.memo && <p className="text-[var(--fg-muted)]">memo/tag: {a.memo}</p>}
              </>
            )}
          </div>
          {payout.reference && <p className="text-xs text-[var(--fg-muted)]">{t('reference', { ref: payout.reference })}</p>}
          {payout.note && <p className="text-xs text-[var(--fg-muted)]">{payout.note}</p>}
          {payout.status === 'requested' && (
            <div className="grid gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Input label={t('admin.referenceLabel')} dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
                <Input label={t('admin.note')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" loading={busy === 'paid'} disabled={!reference.trim()} onClick={() => run('paid')}>
                  {t('admin.markPaid')}
                </Button>
              </div>
              <div className="space-y-2">
                <Input label={t('admin.rejectReason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                <Button size="sm" variant="secondary" loading={busy === 'reject'} disabled={!reason.trim()} onClick={() => run('reject')}>
                  {t('admin.reject')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function PayoutQueue({ money, version, reload }: { money: Money; version: number; reload: () => void }) {
  const t = useTranslations('settlement')
  const [status, setStatus] = useState('requested')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<Payout> | null>(null)
  const load = useCallback(() => {
    settlementService.admin
      .payouts({ status: status || undefined, search: search || undefined, page })
      .then(setData)
      .catch((err) => toast.error(apiErrorMessage(err, 'Error')))
    // search runs on submit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])
  useEffect(load, [load, version])
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('admin.queue')}</h2>
      <form
        className="mb-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          load()
        }}
      >
        <select
          className={selectClass}
          value={status}
          aria-label={t('admin.queue')}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          {(['requested', 'paid', 'rejected', 'cancelled'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`payoutStatus.${s}`)}
            </option>
          ))}
          <option value="">{t('admin.filterAll')}</option>
        </select>
        <div className="min-w-0 flex-1">
          <Input value={search} placeholder={t('admin.search')} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" size="sm" variant="secondary" aria-label={t('admin.search')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      {!data || data.results.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--fg-muted)]">{t('admin.noPayouts')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.results.map((p) => (
            <PayoutRow key={p.id} payout={p} money={money} onDone={reload} />
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
  )
}

function AccountQueue({ version, reload }: { version: number; reload: () => void }) {
  const t = useTranslations('settlement')
  const [rows, setRows] = useState<PayoutAccount[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  useEffect(() => {
    settlementService.admin
      .accounts('pending')
      .then((d) => setRows(d.results))
      .catch(() => setRows([]))
  }, [version])
  const review = async (id: string, approve: boolean) => {
    try {
      await settlementService.admin.reviewAccount(id, approve, notes[id] ?? '')
      toast.success(t('admin.saved'))
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('admin.accountsQueue')}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('admin.noAccounts')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((a) => (
            <li key={a.id} className="space-y-2 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--fg)]">{a.tenantName}</span>
                <Badge variant="secondary">{a.currency}</Badge>
              </div>
              <p className="break-all font-mono text-xs text-[var(--fg)]" dir="ltr">
                {a.kind === 'iban' ? `${a.iban} · ${a.holderName}${a.bankName ? ` · ${a.bankName}` : ''}` : `${a.asset} ${a.address}${a.memo ? ` · ${a.memo}` : ''}`}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    label={t('admin.rejectReason')}
                    value={notes[a.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  />
                </div>
                <Button size="sm" onClick={() => review(a.id, true)}>
                  {t('admin.approve')}
                </Button>
                <Button size="sm" variant="secondary" disabled={!notes[a.id]?.trim()} onClick={() => review(a.id, false)}>
                  {t('admin.reject')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

function Defaults({ currencies }: { currencies: string[] }) {
  const t = useTranslations('settlement')
  const [s, setS] = useState<SettlementSettings | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    settlementService.admin.settings().then(setS).catch((err) => toast.error(apiErrorMessage(err, 'Error')))
  }, [])
  if (!s) return null
  const codes = Array.from(new Set([...Object.keys(s.min_payout), ...currencies]))
  const save = async () => {
    setSaving(true)
    try {
      setS(await settlementService.admin.saveSettings(s))
      toast.success(t('admin.saved'))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card padding="md" className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--fg)]">{t('admin.defaults')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label={t('admin.commission')}
          type="number"
          min={0}
          max={50}
          step="0.01"
          dir="ltr"
          value={s.commission_percent}
          onChange={(e) => setS({ ...s, commission_percent: e.target.value })}
        />
        <Input
          label={t('admin.holdDays')}
          type="number"
          min={0}
          max={60}
          dir="ltr"
          value={String(s.hold_days)}
          onChange={(e) => setS({ ...s, hold_days: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--fg)]">{t('admin.minPayout')}</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {codes.map((code) => (
            <Input
              key={code}
              label={code}
              type="number"
              min={0}
              dir="ltr"
              value={s.min_payout[code] ?? ''}
              onChange={(e) => setS({ ...s, min_payout: { ...s.min_payout, [code]: e.target.value } })}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
          <input
            type="checkbox"
            checked={s.auto_payout.enabled}
            onChange={(e) => setS({ ...s, auto_payout: { ...s.auto_payout, enabled: e.target.checked } })}
          />
          {t('admin.autoPayout')}
        </label>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('admin.autoHint')}</p>
        <label className="mt-2 flex max-w-xs flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--fg)]">{t('admin.weekday')}</span>
          <select
            className={selectClass}
            disabled={!s.auto_payout.enabled}
            value={s.auto_payout.weekday}
            onChange={(e) => setS({ ...s, auto_payout: { ...s.auto_payout, weekday: Number(e.target.value) } })}
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {t(`admin.weekdays.${d}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <Button size="sm" loading={saving} onClick={save}>
          {t('admin.save')}
        </Button>
      </div>
    </Card>
  )
}

function TermsRow({ row, money }: { row: TenantSettlementRow; money: Money }) {
  const t = useTranslations('settlement')
  const [rate, setRate] = useState(row.terms.commissionIsCustom ? row.terms.commissionPercent : '')
  const [hold, setHold] = useState(row.terms.holdIsCustom ? String(row.terms.holdDays) : '')
  const [note, setNote] = useState(row.terms.note)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await settlementService.admin.saveTerms(row.id, { commissionPercent: rate, holdDays: hold, note })
      toast.success(t('admin.saved'))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-[var(--fg)]">{row.name}</span>
        <span className="ms-auto text-xs text-[var(--fg-muted)]">
          {row.balances.map((b) => `${t('available')} ${money(b.available, b.currency)}`).join(' · ')}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <Input label={t('admin.commission')} type="number" min={0} max={50} step="0.01" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('admin.useDefault', { value: `${row.terms.platformCommissionPercent}%` })}</p>
        </div>
        <div>
          <Input label={t('admin.holdDays')} type="number" min={0} max={60} dir="ltr" value={hold} onChange={(e) => setHold(e.target.value)} />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('admin.useDefault', { value: row.terms.platformHoldDays })}</p>
        </div>
        <Input label={t('admin.note')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <div className="flex items-end">
          <Button size="sm" variant="secondary" loading={saving} onClick={save}>
            {t('admin.saveTerms')}
          </Button>
        </div>
      </div>
    </li>
  )
}

function BusinessTerms({ money }: { money: Money }) {
  const t = useTranslations('settlement')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<TenantSettlementRow[]>([])
  const find = useCallback(async (q: string) => {
    try {
      setRows((await settlementService.admin.tenants(q)).results)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }, [])
  useEffect(() => {
    void find('')
  }, [find])
  return (
    <Card padding="md">
      <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('admin.businesses')}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void find(search)
        }}
      >
        <div className="min-w-0 flex-1">
          <Input value={search} placeholder={t('admin.search')} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" size="sm" variant="secondary" aria-label={t('admin.search')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <TermsRow key={row.id} row={row} money={money} />
        ))}
      </ul>
    </Card>
  )
}

export default function PlatformSettlementPage() {
  const t = useTranslations('settlement')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const money: Money = useCallback((v, code) => formatMoney(v, code, locale, table), [locale, table])
  const [overview, setOverview] = useState<PlatformSettlementOverview | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    settlementService.admin.overview().then(setOverview).catch((err) => toast.error(apiErrorMessage(err, 'Error')))
  }, [version])
  const currencies = Object.values(table)
    .filter((c) => c.enabled)
    .map((c) => c.code)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {overview && <Totals data={overview} money={money} />}
      <PayoutQueue money={money} version={version} reload={reload} />
      <AccountQueue version={version} reload={reload} />
      <Defaults currencies={currencies} />
      <BusinessTerms money={money} />
    </div>
  )
}
