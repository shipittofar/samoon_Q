'use client'

/**
 * Test gateway page (only reachable when the server has
 * WALLET_TEST_GATEWAY=1). It plays the bank: "pay" or "cancel" sends the
 * browser to the server callback with a token the server signed, exactly as
 * a real gateway would return the payer.
 */
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FlaskConical } from 'lucide-react'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'

function TestGateway() {
  const t = useTranslations('wallet.topup')
  const params = useSearchParams()
  const callback = params.get('callback') ?? ''
  const go = (outcome: 'ok' | 'cancel') => {
    const token = params.get(outcome) ?? ''
    let url: URL
    try {
      url = new URL(callback)
    } catch {
      return
    }
    // Only our own top-up callback: this page must not become an open redirect.
    if (!/^https?:$/.test(url.protocol) || !/^\/api\/wallet\/topups\/[0-9a-f-]{36}\/callback\/$/.test(url.pathname)) return
    url.searchParams.set('outcome', outcome)
    url.searchParams.set('token', token)
    window.location.assign(url.toString())
  }
  return (
    <Card padding="md" className="mx-auto max-w-md space-y-4 text-center">
      <FlaskConical className="mx-auto h-8 w-8 text-[var(--warning-text)]" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold text-[var(--fg)]">{t('testTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('testHint')}</p>
      </div>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => go('cancel')}>
          {t('testCancel')}
        </Button>
        <Button size="sm" onClick={() => go('ok')}>
          {t('testOk')}
        </Button>
      </div>
    </Card>
  )
}

export default function TopUpTestPage() {
  return (
    <Suspense fallback={null}>
      <TestGateway />
    </Suspense>
  )
}
