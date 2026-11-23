'use client'

/**
 * Platform superuser: currencies and exchange rates (GET/PATCH /currencies/).
 * Rates are "toman per one unit"; a currency needs one before it can be
 * enabled. Every rate change is logged with an optional reason.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '@/services/axios.instance'
import { ENDPOINTS } from '@/services/endpoints'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge, Card } from '@/components/ui'
import { ErrorBox, PageHeader, formatDate } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import { useCurrencyStore } from '@/stores/currency'
import type { CurrencyInfo } from '@/lib/currency'

interface AdminCurrency extends CurrencyInfo {
  sortOrder: number
  rateUpdatedAt: string | null
}

interface RateChange {
  code: string
  previousRate: string | null
  newRate: string | null
  reason: string
  changedBy: string
  changedAt: string
}

type Draft = { rate: string; roundingStep: string; decimals: string; enabled: boolean; reason: string }

const toDraft = (c: AdminCurrency): Draft => ({
  rate: c.rate == null ? '' : String(c.rate),
  roundingStep: c.roundingStep == null ? '' : String(c.roundingStep),
  decimals: String(c.decimals),
  enabled: c.enabled,
  reason: '',
})

function CurrencyRow({ currency, onSaved }: { currency: AdminCurrency; onSaved: () => void }) {
  const t = useTranslations('currencyDisplay.admin')
  const locale = useLocale()
  const [draft, setDraft] = useState<Draft>(() => toDraft(currency))
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(toDraft(currency)), [currency])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        roundingStep: draft.roundingStep,
        decimals: Number(draft.decimals),
      }
      if (!currency.isBase) {
        body.rate = draft.rate === '' ? null : draft.rate
        body.enabled = draft.enabled
        if (draft.reason.trim()) body.reason = draft.reason.trim()
      }
      await api.patch(ENDPOINTS.CURRENCIES.DETAIL(currency.code), body)
      toast.success(t('saved'))
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="font-mono font-semibold text-[var(--fg)]">{currency.code}</span>
        <span className="text-sm text-[var(--fg-muted)]">{currency.name}</span>
        {currency.symbol && <span className="text-sm text-[var(--fg-muted)]">· {currency.symbol}</span>}
        {currency.isBase && <Badge variant="info">{t('base')}</Badge>}
        {!currency.isBase && !currency.rate && <Badge variant="warning">{t('noRate')}</Badge>}
        {currency.rateUpdatedAt && (
          <span className="text-xs text-[var(--fg-muted)] ms-auto">
            {t('lastUpdated', { date: formatDate(currency.rateUpdatedAt, locale) })}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Input
          label={t('rate')}
          type="number"
          min={0}
          step="any"
          dir="ltr"
          value={currency.isBase ? '1' : draft.rate}
          disabled={currency.isBase}
          onChange={(e) => set('rate', e.target.value)}
        />
        <Input
          label={t('rounding')}
          type="number"
          min={0}
          step="any"
          dir="ltr"
          value={draft.roundingStep}
          onChange={(e) => set('roundingStep', e.target.value)}
        />
        <Input
          label={t('decimals')}
          type="number"
          min={0}
          max={4}
          dir="ltr"
          value={draft.decimals}
          onChange={(e) => set('decimals', e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--fg)] sm:pt-7">
          <input
            type="checkbox"
            checked={currency.isBase || draft.enabled}
            disabled={currency.isBase}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          {t('enabled')}
        </label>
      </div>
      {!currency.isBase && (
        <div className="mt-3">
          <Input label={t('reason')} value={draft.reason} maxLength={300} onChange={(e) => set('reason', e.target.value)} />
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={saving} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </Card>
  )
}

export default function PlatformCurrenciesPage() {
  const t = useTranslations('currencyDisplay.admin')
  const locale = useLocale()
  const [rows, setRows] = useState<AdminCurrency[] | null>(null)
  const [history, setHistory] = useState<RateChange[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [list, hist] = await Promise.all([
        api.get<{ base: string; currencies: AdminCurrency[] }>(ENDPOINTS.CURRENCIES.LIST, { params: { all: 1 } }),
        api.get<{ results: RateChange[] }>(ENDPOINTS.CURRENCIES.HISTORY),
      ])
      setRows(list.data.currencies)
      setHistory(hist.data.results)
      // The site's currency list follows what was just saved.
      useCurrencyStore.getState().setTable(list.data.base, list.data.currencies.filter((c) => c.enabled || c.isBase))
    } catch (err) {
      setError(apiErrorMessage(err, 'Error'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    try {
      await api.post(ENDPOINTS.CURRENCIES.LIST, { code: newCode.trim(), name: newName.trim() || newCode.trim() })
      setNewCode('')
      setNewName('')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {error && <ErrorBox message={error} onRetry={load} />}
      {rows?.map((c) => <CurrencyRow key={c.code} currency={c} onSaved={load} />)}

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-2">
          <Input label={t('code')} value={newCode} maxLength={5} dir="ltr" onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
          <Input label={t('name')} value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={add} disabled={newCode.trim().length < 3}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('add')}
          </Button>
        </div>
      </Card>

      <Card padding="sm">
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-2">{t('history')}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">{t('noHistory')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 text-[var(--fg-muted)]">
                <span className="font-mono text-[var(--fg)]">{h.code}</span>
                <span dir="ltr">
                  {h.previousRate ?? '—'} → {h.newRate ?? '—'}
                </span>
                {h.reason && <span>“{h.reason}”</span>}
                <span>{h.changedBy}</span>
                <span>{formatDate(h.changedAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
