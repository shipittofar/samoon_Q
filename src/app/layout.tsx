import type { Metadata, Viewport } from 'next'
import { getLocale, getMessages } from 'next-intl/server'
import { headers } from 'next/headers'
import localFont from 'next/font/local'
import { Providers } from '@/providers'
import { configurationService } from '@/config'
import { getPlatformConfigOverrides } from '@/config/platform-overrides-server'
import { PlatformConfigHydrator } from '@/components/PlatformConfigHydrator'
import { getDirection } from '@/i18n/runtime'
import { ClientIntlProvider } from '@/i18n/ClientIntlProvider'
import { getLocalizedPageMetadata } from '@/lib/seo'
import { getLanguageMetadata } from '@/i18n/language-registry'
import './globals.css'

// Self-hosted latin variable faces (same families as next/font/google).
// Turbopack's Rust Google Fonts fetcher fails on some Windows/TLS setups and
// then leaves CSS referencing `@vercel/turbopack-next/internal/font/google/font`
// unresolved. Local fonts avoid that compile-time network path entirely.
const playfair = localFont({
  src: '../fonts/PlayfairDisplay-latin-variable.woff2',
  variable: '--font-display',
  display: 'swap',
  weight: '400 900',
})
const dmSans = localFont({
  src: '../fonts/DMSans-latin-variable.woff2',
  variable: '--font-body',
  display: 'swap',
  weight: '100 1000',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// P9.5.4 Phase F/G — localized title/description/keywords/OpenGraph/Twitter/
// canonical/hreflang, sourced from the `seo` namespace via
// getLocalizedPageMetadata() (src/lib/seo.ts) instead of a hand-written
// literal Metadata object. Static, locale-independent fields (icons,
// manifest, images, metadataBase) stay exactly as they were.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const localized = await getLocalizedPageMetadata({ locale, path: '/', namespaceKey: 'root', baseUrl: APP_URL })
  return {
    ...localized,
    title: { default: String(localized.title), template: '%s | Samoon' },
    metadataBase: new URL(APP_URL),
    openGraph: { ...localized.openGraph, images: [{ url: '/og-image.jpg', width: 1200, height: 630 }] },
    twitter: { ...localized.twitter, images: ['/og-image.jpg'] },
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
  }
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fafaf9' }, { media: '(prefers-color-scheme: dark)', color: '#0c0a09' }],
  width: 'device-width', initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Platform settings saved by superusers (Django), applied before anything
  // below reads configuration (locale, text direction, sign-in flags, ...).
  const platformOverrides = await getPlatformConfigOverrides()
  configurationService.hydratePlatformOverrides(platformOverrides)
  const locale = await getLocale()
  const messages = await getMessages()
  const direction = getDirection(locale)
  const timeZone = getLanguageMetadata(locale)?.defaultTimezone ?? 'UTC'
  // P1B.3 — Read tenant slug injected by middleware and expose it to the client
  // bootstrapper via a <meta> tag. The bootstrapper calls readTenantSlug() which
  // queries this tag, so it knows which tenant to load without re-parsing the host.
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-slug') ?? ''
  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        {tenantSlug && <meta name="x-tenant-slug" content={tenantSlug} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* P4.7.4 — Preconnect to external origins actually used by the app */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('samoon-theme');const th=t?JSON.parse(t).state?.theme:'system';if(th==='dark'||(th==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
        <ClientIntlProvider locale={locale} messages={messages} timeZone={timeZone}>
          <PlatformConfigHydrator overrides={platformOverrides}>
            <Providers>{children}</Providers>
          </PlatformConfigHydrator>
        </ClientIntlProvider>
      </body>
    </html>
  )
}
