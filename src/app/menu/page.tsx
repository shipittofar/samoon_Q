/**
 * Menu Page — Phase 4 (P4.4.2 / P4.4.4)
 *
 * Server Component wrapper that:
 *  1. Exports SEO metadata (P4.4.4)
 *  2. Prefetches categories and the default menu listing on the server (P4.4.2)
 *  3. Dehydrates the QueryClient and wraps the client component in
 *     HydrationBoundary so useCategories() / useMenuItems() do not issue
 *     duplicate requests on first client render.
 *
 * The interactive UI lives in MenuContent (client component). This file is
 * intentionally kept thin — no business logic, no UI.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { menuService } from '@/services/menu.service'
import { createServerQueryClient, dehydrateClient, HydrationBoundary } from '@/lib/react-query'
import { MenuContent } from '@/components/menu/MenuContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { DEFAULT_MENU_JSON_LD, serializeJsonLd } from '@/lib/json-ld'
import MenuLoading from './loading'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export const metadata: Metadata = {
  title: 'Menu — Savor',
  description:
    'Browse menus from restaurants, cafés, bars, and more on Savor. Find dishes, explore categories, and order online.',
  openGraph: {
    title: 'Menu — Savor',
    description: 'Browse menus from local businesses on Savor.',
    url: `${BASE_URL}/menu`,
    siteName: 'Savor Platform',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Savor' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Menu — Savor',
    description: 'Browse menus from local businesses on Savor.',
    images: [`${BASE_URL}/og-image.jpg`],
  },
  alternates: { canonical: `${BASE_URL}/menu` },
}

export default async function MenuPage() {
  const queryClient = createServerQueryClient()

  // Prefetch the default view (all categories, default sort).
  // Failures are intentionally swallowed — the client will re-fetch on mount.
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['categories'],
      queryFn: () => menuService.getCategories(),
    }),
    queryClient.prefetchQuery({
      queryKey: ['menu-items', undefined],
      queryFn: () => menuService.getItems(),
    }),
  ])

  const dehydrated = dehydrateClient(queryClient)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(DEFAULT_MENU_JSON_LD) }}
      />
      <HydrationBoundary state={dehydrated}>
        <ErrorBoundary feature="MenuContent">
          <Suspense fallback={<MenuLoading />}>
            <MenuContent />
          </Suspense>
        </ErrorBoundary>
      </HydrationBoundary>
    </>
  )
}
