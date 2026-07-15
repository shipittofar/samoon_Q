import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

/**
 * Live Location page — Food Truck and Mobile Cafe specific (P6.8).
 * Gated by the `qr_table` capability (all mobile modules require QR ordering).
 * The nav item is gated on `food_truck.live_location.enabled` /
 * `mobile_cafe.live_location.enabled` in the respective module navItems.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/location', namespaceKey: 'location', baseUrl: BASE_URL })
}

export default async function LocationPage() {
  const t = await getTranslations('comingSoon')
  return (
    <CapabilityGuard
      capability="qr_table"
      fallback={<CapabilityNotAvailable capability="qr_table" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">{t('liveLocation')}</h1>
        <p className="text-[var(--fg-muted)]">{t('liveLocationContent')}</p>
      </main>
    </CapabilityGuard>
  )
}
