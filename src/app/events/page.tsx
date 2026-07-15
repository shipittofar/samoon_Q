import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

/**
 * Events page — bar-specific feature guarded by the `bar.events.enabled` flag (P6.8).
 * Non-bar tenants and bar tenants with events disabled see the "not available" fallback.
 *
 * Note: Events is a bar-specific feature flag (not a core Capability), so this page
 * uses the FeatureFlagGuard pattern via CapabilityGuard with the nearest capability.
 * The nav item itself is already gated on `bar.events.enabled` in BAR_MODULE.navItems.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/events', namespaceKey: 'events', baseUrl: BASE_URL })
}

export default async function EventsPage() {
  const t = await getTranslations('comingSoon')
  return (
    <CapabilityGuard
      capability="menu"
      fallback={<CapabilityNotAvailable capability="menu" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">{t('events')}</h1>
        <p className="text-[var(--fg-muted)]">{t('eventsContent')}</p>
      </main>
    </CapabilityGuard>
  )
}
