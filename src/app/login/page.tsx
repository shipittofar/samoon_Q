import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { getLocalizedPageMetadata } from '@/lib/seo'
import { LoginClientPage } from './LoginClientPage'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/login', namespaceKey: 'login', baseUrl: BASE_URL })
}

export default function LoginPage() {
  return <LoginClientPage />
}
