'use client'

/**
 * P8.7.5 — Context-aware Menu Preview
 * Renders the menu for the tenant/branch selected via the URL path.
 * Context (tenant slug, branch slug) is initialized by the parent layout.
 */

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { MenuContent } from '@/components/menu/MenuContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useBranchStore } from '@/stores'

function MenuLoadingFallback() {
  const t = useTranslations('branch')
  return <div className="flex items-center justify-center h-64 text-[var(--fg-subtle)]">{t('loadingMenuEllipsis')}</div>
}

export default function TenantBranchMenuPage() {
  const branchId = useBranchStore((s) => s.activeBranch?.id)

  return (
    <ErrorBoundary feature="Menu Preview">
      <Suspense fallback={<MenuLoadingFallback />}>
        <MenuContent branchId={branchId} />
      </Suspense>
    </ErrorBoundary>
  )
}
