'use client'

/**
 * P8.7.5 — Context-aware Menu Preview
 * Renders the menu for the tenant/branch selected via the URL path.
 * Context (tenant slug, branch slug) is initialized by the parent layout.
 */

import { Suspense, use } from 'react'
import { useTranslations } from 'next-intl'
import { MenuContent } from '@/components/menu/MenuContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

function MenuLoadingFallback() {
  const t = useTranslations('branch')
  return <div className="flex items-center justify-center h-64 text-gray-400">{t('loadingMenuEllipsis')}</div>
}

interface Props {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}

export default function TenantBranchMenuPage({ params }: Props) {
  const { branchSlug } = use(params)
  return (
    <ErrorBoundary feature="Menu Preview">
      <Suspense fallback={<MenuLoadingFallback />}>
        <MenuContent branchId={branchSlug} />
      </Suspense>
    </ErrorBoundary>
  )
}
