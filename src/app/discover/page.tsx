import type { Metadata } from 'next'
import { DiscoverClientPage } from './DiscoverClientPage'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export const metadata: Metadata = {
  title: 'Discover Businesses — Savor Platform',
  description:
    'Browse restaurants, cafés, bars, food trucks, and more. Find your next favourite spot and explore menus, branches, and opening hours.',
  openGraph: {
    title: 'Discover Businesses — Savor Platform',
    description: 'Browse all businesses registered on the Savor platform.',
    url: `${BASE_URL}/discover`,
    siteName: 'Savor',
    type: 'website',
  },
}

export default function DiscoverPage() {
  return <DiscoverClientPage />
}
