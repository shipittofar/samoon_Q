'use client'

/**
 * Wallet top-up: bank gateway (Toman) or crypto (USDT TRC20/BEP20, TON,
 * XRP). Gateways send the payer away and back to /dashboard/wallet?topup=…;
 * a direct transfer shows our registered address (and memo / tag) and takes
 * the transaction hash. Nothing here credits the wallet: the server does,
 * after the gateway or a superuser confirms the payment.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Copy, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { selectClass } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import { formatMoney } from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'
import {
  goToGateway,
  walletService,
  type TopUp,
  type TopUpMethod,
  type TopUpOptions,
} from '@/services/wallet.service'
import { cn } from '@/utils'

export function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations('wallet.topup')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the value is still selectable */
    }
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-[var(--fg-muted)]">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-hover)] px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-sm text-[var(--fg)]" dir="ltr">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          aria-label={copied ? t('copied') : t('copy')}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

/** Address, memo / tag and the hash form for a direct crypto transfer. */
export function DirectTransfer({ topup, onChange }: { topup: TopUp; onChange: (t: TopUp) => void }) {
  const t = useTranslations('wallet.topup')
  const [hash, setHash] = useState('')
  const [busy, setBusy] = useState(false)
  const ins = topup.instructions
  if (!ins) return null
  const memoLabel = topup.asset === 'XRP' ? t('memoXRP') : t('memoTON')
  const submit = async () => {
    setBusy(true)
    try {
      onChange(await walletService.topups.submitTx(topup.id, hash))
      toast.success(t('submitted'))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--fg)]">
        {t('directTitle', { amount: ins.amount, coin: ins.coin, network: ins.network })}
      </p>
      <CopyField label={t('directAddress')} value={ins.address} />
      {ins.memo && <CopyField label={memoLabel} value={ins.memo} />}
      <p className="rounded-xl bg-[var(--warning-subtle)] px-3 py-2 text-xs text-[var(--warning-text)]">
        {ins.memo
          ? t('directWarning', { coin: ins.coin, network: ins.network, label: memoLabel })
          : t('directWarningNoMemo', { coin: ins.coin, network: ins.network })}
      </p>
      {topup.receiptRef ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('submitted')}</p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input label={t('txHash')} dir="ltr" value={hash} onChange={(e) => setHash(e.target.value.trim())} />
          </div>
          <Button size="sm" loading={busy} disabled={hash.length < 16} onClick={submit}>
            {t('submitTx')}
          </Button>
        </div>
      )}
    </div>
  )
}

export function TopUpDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: TopUp) => void }) {
  const t = useTranslations('wallet.topup')
  const locale = useLocale()
  const table = useCurrencyStore((s) => s.table)
  const [options, setOptions] = useState<TopUpOptions | null>(null)
  const [method, setMethod] = useState<TopUpMethod>('bank')
  const [provider, setProvider] = useState('')
  const [asset, setAsset] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [direct, setDirect] = useState<TopUp | null>(null)

  useEffect(() => {
    if (!open) return
    setDirect(null)
    walletService.topups
      .options()
      .then((o) => {
        setOptions(o)
        const hasBank = o.bank.providers.length > 0
        setMethod(hasBank ? 'bank' : 'crypto')
        setProvider(hasBank ? o.bank.providers[0] : o.crypto[0]?.providers[0] ?? '')
        setAsset(o.crypto[0]?.key ?? '')
      })
      .catch((err) => toast.error(apiErrorMessage(err, 'Error')))
  }, [open])

  const coin = options?.crypto.find((c) => c.key === asset)
  const providers = useMemo(
    () => (method === 'bank' ? options?.bank.providers ?? [] : coin?.providers ?? []),
    [method, options, coin],
  )
  const range = method === 'bank' ? options?.bank : coin
  const currency = method === 'bank' ? 'IRT' : coin?.currency ?? ''
  const nothing = options && options.bank.providers.length === 0 && options.crypto.length === 0

  useEffect(() => {
    if (providers.length && !providers.includes(provider)) setProvider(providers[0])
  }, [providers, provider])

  const value = parseFloat(amount)
  const inRange = useMemo(() => {
    if (!range || !Number.isFinite(value) || value <= 0) return false
    const min = parseFloat(range.min) || 0
    const max = parseFloat(range.max) || 0
    return value >= min && (!max || value <= max)
  }, [range, value])

  const pay = async () => {
    setBusy(true)
    try {
      const res = await walletService.topups.start({ method, provider, amount, asset: method === 'crypto' ? asset : undefined })
      onCreated(res.topup)
      if (res.redirect) {
        goToGateway(res.redirect)
        return // leaving the page
      }
      setDirect(res.topup)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setBusy(false)
    }
  }

  const money = (v: string, code: string) => (code === 'IRT' ? formatMoney(v, code, locale, table) : `${v} ${code}`)

  return (
    <Modal open={open} onClose={onClose} title={t('title')} size="md">
      {!options ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--card-hover)]" />
      ) : direct ? (
        <div className="space-y-4">
          <DirectTransfer topup={direct} onChange={(next) => (setDirect(next), onCreated(next))} />
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      ) : nothing ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('noOptions')}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['bank', 'crypto'] as const).map((m) => {
              const disabled = m === 'bank' ? options.bank.providers.length === 0 : options.crypto.length === 0
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={disabled}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40',
                    method === m
                      ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)]',
                  )}
                >
                  {m === 'bank' ? t('methodBank') : t('methodCrypto')}
                </button>
              )
            })}
          </div>

          {method === 'crypto' && (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-[var(--fg)]">{t('coin')}</span>
                <select className={selectClass} value={asset} onChange={(e) => setAsset(e.target.value)}>
                  {options.crypto.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.currency} — {c.network}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-[var(--fg-muted)]">{t('cryptoNote')}</p>
            </>
          )}

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-[var(--fg)]">{t('gateway')}</legend>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={provider === p}
                  onClick={() => setProvider(p)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-sm transition-colors',
                    provider === p
                      ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)]',
                  )}
                >
                  {t(`provider.${p}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <Input
              label={`${t('amount')} (${currency})`}
              type="number"
              min={0}
              step={method === 'bank' ? 1000 : 'any'}
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {range && (
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {t('range', { min: money(range.min, currency), max: money(range.max, currency) })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button size="sm" loading={busy} disabled={!provider || !inRange} onClick={pay}>
              {t('pay')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
