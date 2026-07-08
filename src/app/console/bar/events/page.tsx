'use client'

import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'

export default function BarEventsPage() {
  const t = useTranslations('console')
  return (
    <ErrorBoundary feature="Bar Event Management">
      <PermissionGuard permission="operations.view" fallback={<AccessDenied />}>
        <main className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">{t('eventManagementTitle')}</h1>
            <PreviewButton href="/events" label={t('previewEventsLabel')} size="sm" />
          </div>
          <p className="text-gray-500 text-sm">{t('manageBarEventsHint')}</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            {t('comingSoon')}
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
