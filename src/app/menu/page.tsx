/**
 * Menu Page — Phase 4 (P4.4.2 / P4.4.4)
 *
 * Server Component wrapper that exports SEO metadata (P4.4.4).
 *
 * This route carries no [tenantSlug]/[branchSlug] segment, so the server has
 * no branch identity to scope a prefetch to (menus are branch-scoped — see
 * docs/BRANCH_MENU_ANALYSIS.md / docs/BRANCH_MENU_IMPLEMENTATION.md).
 * Server-side prefetching of categories/menu-items was removed rather than
 * left in place with a mismatched cache key: it previously prefetched
 * ['categories'] / ['menu-items', undefined], which never matched the
 * client's branch-scoped keys and was silently discarded on hydration. The
 * client component now resolves its own branch from useBranchStore.
 *
 * The interactive UI lives in MenuContent (client component). This file is
 * intentionally kept thin — no business logic, no UI.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { MenuContent } from '@/components/menu/MenuContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { DEFAULT_MENU_JSON_LD, serializeJsonLd } from '@/lib/json-ld'
import { getLocalizedPageMetadata } from '@/lib/seo'
import MenuLoading from './loading'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const localized = await getLocalizedPageMetadata({ locale, path: '/menu', namespaceKey: 'menu', baseUrl: BASE_URL })
  return {
    ...localized,
    openGraph: {
      ...localized.openGraph,
      images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Samoon' }],
    },
    twitter: {
      ...localized.twitter,
      images: [`${BASE_URL}/og-image.jpg`],
    },
  }
}

export default async function MenuPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(DEFAULT_MENU_JSON_LD) }}
      />
      <ErrorBoundary feature="MenuContent">
        <Suspense fallback={<MenuLoading />}>
          <MenuContent />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
