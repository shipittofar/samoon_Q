'use client'

import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function FoodTruckRoutesPage() {
  const t = useTranslations('console')
  return (
    <ErrorBoundary feature="Food Truck Route Management">
      <PermissionGuard permission="operations.view">
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">{t('routeManagementTitle')}</h1>
          <p className="text-[var(--fg-muted)] text-sm">{t('planManageRoutesFoodTruckHint')}</p>
          <div className="mt-8 rounded-lg border border-dashed border-[var(--border-strong)] p-12 text-center text-[var(--fg-subtle)]">
            {t('comingSoon')}
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
