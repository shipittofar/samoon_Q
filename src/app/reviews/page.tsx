import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

/**
 * Reviews page — guarded by the `reviews` capability (P6.8).
 * Tenants whose active modules do not enable reviews see the "not available" fallback.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/reviews', namespaceKey: 'reviews', baseUrl: BASE_URL })
}

export default async function ReviewsPage() {
  const t = await getTranslations('comingSoon')
  return (
    <CapabilityGuard
      capability="reviews"
      fallback={<CapabilityNotAvailable capability="reviews" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">{t('reviews')}</h1>
        <p className="text-[var(--fg-muted)]">{t('reviewsContent')}</p>
      </main>
    </CapabilityGuard>
  )
}
