import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { getLocalizedPageMetadata } from '@/lib/seo'
import { PromotionsClientPage } from './PromotionsClientPage'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/promotions', namespaceKey: 'promotions', baseUrl: BASE_URL })
}

export default function PromotionsPage() {
  return <PromotionsClientPage />
}
