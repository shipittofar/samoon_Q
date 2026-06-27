import type { Metadata } from 'next'
import { DiscoverClientPage } from './DiscoverClientPage'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export const metadata: Metadata = {
  title: 'Discover Businesses — Savor Platform',
  description:
    'Browse restaurants, cafés, bars, food trucks, and more. Filter by cuisine, amenities, price, and opening hours. Find your next favourite spot.',
  keywords: [
    'discover restaurants',
    'find cafés',
    'food near me',
    'restaurant search',
    'marketplace',
    'food court',
    'bar finder',
    'food trucks',
    'Savor platform',
  ],
  alternates: {
    canonical: `${BASE_URL}/discover`,
  },
  openGraph: {
    title: 'Discover Businesses — Savor Platform',
    description:
      'Browse all restaurants, cafés, bars, food trucks and more on the Savor marketplace. Filter by cuisine, city, price, and more.',
    url: `${BASE_URL}/discover`,
    siteName: 'Savor Platform',
    type: 'website',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Discover restaurants and cafés on Savor',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover Businesses — Savor Platform',
    description: 'Browse restaurants, cafés, bars, food trucks and more on the Savor marketplace.',
    images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80'],
  },
}

export default function DiscoverPage() {
  return <DiscoverClientPage />
}
