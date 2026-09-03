'use client'

import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function MobileCafeRoutesPage() {
  const t = useTranslations('console')
  return (
    <ErrorBoundary feature="Mobile Cafe Route Management">
      <PermissionGuard permission="operations.view"fallback={<AccessDenied />}>
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">{t('routeManagementTitle')}</h1>
          <p className="text-[var(--fg-muted)] text-sm">{t('planManageRoutesMobileCafeHint')}</p>
          <div className="mt-8 rounded-lg border border-dashed border-[var(--border-strong)] p-12 text-center text-[var(--fg-subtle)]">
            {t('comingSoon')}
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
