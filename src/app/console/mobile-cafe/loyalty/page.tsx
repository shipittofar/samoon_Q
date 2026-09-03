'use client'

import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'

export default function MobileCafeLoyaltyPage() {
  const t = useTranslations('console')
  return (
    <ErrorBoundary feature="Mobile Cafe Loyalty Management">
      <PermissionGuard permission="loyalty.manage"fallback={<AccessDenied />}>
        <main className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">{t('loyaltyManagementTitle')}</h1>
            <PreviewButton href="/loyalty"label={t('previewLoyaltyLabel')} size="sm"/>
          </div>
          <p className="text-[var(--fg-muted)] text-sm">{t('configureLoyaltyRewardsMobileCafeHint')}</p>
          <div className="mt-8 rounded-lg border border-dashed border-[var(--border-strong)] p-12 text-center text-[var(--fg-subtle)]">
            {t('comingSoon')}
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
