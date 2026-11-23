'use client'

/**
 * Platform superuser: top-up settings. Which bank and crypto gateways
 * customers see, the amount range, which coins are on, and our own
 * receiving address per coin (for direct transfers). Gateway credentials are
 * environment variables on the server and never pass through this page; a
 * gateway without them is shown as "no credentials" and stays hidden from
 * customers even when ticked.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/superadmin/shared'
import { apiErrorMessage } from '@/services/superadmin.service'
import {
  BANK_GATEWAYS,
  COIN_KEYS,
  CRYPTO_GATEWAYS,
  walletService,
  type CoinKey,
  type TopUpCoinSettings,
  type TopUpSettings,
} from '@/services/wallet.service'

const NETWORK: Record<CoinKey, string> = {
  USDT_TRC20: 'USDT · TRC20 (Tron)',
  USDT_BEP20: 'USDT · BEP20 (BNB Chain)',
  TON: 'TON',
  XRP: 'XRP Ledger',
}

function GatewayToggles({
  title,
  keys,
  selected,
  configured,
  onChange,
}: {
  title: string
  keys: readonly string[]
  selected: string[]
  configured: Record<string, boolean>
  onChange: (next: string[]) => void
}) {
  const t = useTranslations('wallet.topupAdmin')
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-[var(--fg)]">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((key) => {
          const ready = key === 'direct' || configured[key]
          return (
            <label key={key} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={(e) => onChange(e.target.checked ? [...selected, key] : selected.filter((k) => k !== key))}
              />
              <span className="flex-1 text-[var(--fg)]">{t(`provider.${key}`)}</span>
              <Badge variant={ready ? 'success' : 'secondary'}>{ready ? t('configured') : t('notConfigured')}</Badge>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function TopUpSettingsPage() {
  const t = useTranslations('wallet.topupAdmin')
  const [settings, setSettings] = useState<TopUpSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    walletService.admin
      .topupSettings()
      .then(setSettings)
      .catch((err) => toast.error(apiErrorMessage(err, 'Error')))
  }, [])

  if (!settings) return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-[var(--card-hover)]" />
  const configured = settings.configured ?? {}

  const setBank = (patch: Partial<TopUpSettings['bank']>) => setSettings((s) => s && { ...s, bank: { ...s.bank, ...patch } })
  const setCrypto = (patch: Partial<TopUpSettings['crypto']>) =>
    setSettings((s) => s && { ...s, crypto: { ...s.crypto, ...patch } })
  const setCoin = (key: CoinKey, patch: Partial<TopUpCoinSettings>) =>
    setSettings(
      (s) => s && { ...s, crypto: { ...s.crypto, coins: { ...s.crypto.coins, [key]: { ...s.crypto.coins[key], ...patch } } } },
    )

  const save = async () => {
    setSaving(true)
    try {
      const { bank, crypto, expire_minutes } = settings
      setSettings(await walletService.admin.saveTopupSettings({ bank, crypto, expire_minutes }))
      toast.success(t('saved'))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={t('settingsTitle')}
        subtitle={t('settingsHint')}
        actions={
          <Link href="/console/platform/topups">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              {t('back')}
            </Button>
          </Link>
        }
      />

      {settings.sandbox && (
        <Card padding="sm">
          <p className="flex items-center gap-2 text-sm text-[var(--warning-text)]">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('sandboxOn')}
          </p>
        </Card>
      )}

      <Card padding="md" className="space-y-4">
        <GatewayToggles
          title={t('bankGateways')}
          keys={BANK_GATEWAYS}
          selected={settings.bank.providers}
          configured={configured}
          onChange={(providers) => setBank({ providers })}
        />
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--fg)]">{t('bankRange')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input label={t('min')} type="number" dir="ltr" value={settings.bank.min} onChange={(e) => setBank({ min: e.target.value })} />
            <Input label={t('max')} type="number" dir="ltr" value={settings.bank.max} onChange={(e) => setBank({ max: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <GatewayToggles
          title={t('cryptoGateways')}
          keys={CRYPTO_GATEWAYS}
          selected={settings.crypto.providers}
          configured={configured}
          onChange={(providers) => setCrypto({ providers })}
        />
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--fg)]">{t('coins')}</p>
          <div className="space-y-3">
            {COIN_KEYS.map((key) => {
              const coin = settings.crypto.coins[key]
              return (
                <div key={key} className="rounded-xl border border-[var(--border)] p-3">
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
                    <input type="checkbox" checked={coin.enabled} onChange={(e) => setCoin(key, { enabled: e.target.checked })} />
                    {NETWORK[key]}
                    <span className="text-xs font-normal text-[var(--fg-muted)]">{t('enabled')}</span>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input label={t('min')} type="number" dir="ltr" value={coin.min} onChange={(e) => setCoin(key, { min: e.target.value })} />
                    <Input label={t('max')} type="number" dir="ltr" value={coin.max} onChange={(e) => setCoin(key, { max: e.target.value })} />
                    <div className="sm:col-span-2">
                      <Input
                        label={t('address')}
                        dir="ltr"
                        value={coin.address}
                        spellCheck={false}
                        onChange={(e) => setCoin(key, { address: e.target.value.trim() })}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">{t('addressHint')}</p>
        </div>
      </Card>

      <Card padding="md">
        <div className="max-w-xs">
          <Input
            label={t('expire')}
            type="number"
            min={5}
            max={1440}
            dir="ltr"
            value={String(settings.expire_minutes)}
            onChange={(e) => setSettings((s) => s && { ...s, expire_minutes: Number(e.target.value) || 0 })}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
