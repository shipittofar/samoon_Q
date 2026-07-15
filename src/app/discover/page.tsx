import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { DiscoverClientPage } from './DiscoverClientPage'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const localized = await getLocalizedPageMetadata({ locale, path: '/discover', namespaceKey: 'discover', baseUrl: BASE_URL })
  return {
    ...localized,
    openGraph: {
      ...localized.openGraph,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
          width: 1200,
          height: 630,
          alt: 'Discover restaurants and cafés on Samoon',
        },
      ],
    },
    twitter: {
      ...localized.twitter,
      images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80'],
    },
  }
}

export default function DiscoverPage() {
  return <DiscoverClientPage />
}
