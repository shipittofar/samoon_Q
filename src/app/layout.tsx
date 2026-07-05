import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { headers } from 'next/headers'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import { Providers } from '@/providers'
import { getDirection } from '@/i18n/runtime'
import './globals.css'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: { default: 'Savor — Hospitality Platform', template: '%s | Savor' },
  description: 'Discover restaurants, cafés, bars, food trucks, and more. Browse menus, book tables, and order from local businesses on Savor.',
  keywords: ['restaurant discovery', 'hospitality platform', 'food ordering', 'table booking', 'cafe', 'bar', 'food truck', 'local dining', 'marketplace', 'restaurant marketplace'],
  openGraph: { type: 'website', siteName: 'Savor Platform', title: 'Savor — Hospitality Platform', description: 'Discover restaurants, cafés, and bars near you.', images: [{ url: '/og-image.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Savor — Hospitality Platform', images: ['/og-image.jpg'] },
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fafaf9' }, { media: '(prefers-color-scheme: dark)', color: '#0c0a09' }],
  width: 'device-width', initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const direction = getDirection(locale)
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
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('savor-theme');const th=t?JSON.parse(t).state?.theme:'system';if(th==='dark'||(th==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
