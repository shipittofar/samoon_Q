import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { PlanClientPage } from './PlanClientPage'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/plan', namespaceKey: 'planner', baseUrl: BASE_URL })
}

export default function PlanPage() {
  return <PlanClientPage />
}
