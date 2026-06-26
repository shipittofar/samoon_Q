'use client'

/**
 * P8.7.5 — Context-aware Menu Preview
 * Renders the menu for the tenant/branch selected via the URL path.
 * Context (tenant slug, branch slug) is initialized by the parent layout.
 */

import { Suspense } from 'react'
import { MenuContent } from '@/components/menu/MenuContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function TenantBranchMenuPage() {
  return (
    <ErrorBoundary feature="Menu Preview">
      <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Loading menu…</div>}>
        <MenuContent />
      </Suspense>
    </ErrorBoundary>
  )
}
