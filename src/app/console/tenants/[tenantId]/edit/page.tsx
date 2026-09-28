'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { TenantCanonicalSettingsForm } from '@/components/admin/TenantCanonicalSettingsForm'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { useUpdateTenantSettings } from '@/hooks'
import { tenantService } from '@/services/tenant.service'
import { APP_URL } from '@/constants'
import type { Tenant } from '@/types'

function TenantEditContent({ tenantId }: { tenantId: string }) {
  const t = useTranslations('console')
  const { data: tenant, isLoading, isError } = useQuery<Tenant>({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenantById(tenantId),
  })
  const { mutateAsync: save, isPending, isSuccess } = useUpdateTenantSettings(tenantId)

  if (isLoading) {
    return (
      <main aria-label={t('tenantEditAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-[var(--fg-muted)]">{t('loadingTenantEllipsis')}</p>
      </main>
    )
  }

  if (isError || !tenant) {
    return (
      <main aria-label={t('tenantEditAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-[var(--danger-text)]">{t('tenantNotFoundPeriod')}</p>
        <Link href="/console/tenants"className="text-sm text-accent underline mt-2 block">
          {t('backToTenantsLabel')}
        </Link>
      </main>
    )
  }

  return (
    <main aria-label={t('tenantEditAria')} className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/console/tenants/${tenantId}`} className="text-sm text-[var(--fg-muted)] hover:underline">
          {t('backArrowTenants')}
        </Link>
        <h1 className="text-2xl font-bold">{t('editColonName', { name: tenant.name })}</h1>
      </div>
      <p className="text-sm text-[var(--fg-muted)] mb-6">{t('hoursManagedPerBranch')}</p>
      <TenantCanonicalSettingsForm
        tenant={tenant}
        onSave={save}
        isPending={isPending}
        saved={isSuccess}
      />
      <div className="mt-8">
        <QrManagementPanel
          scope="tenant"
          entityId={tenant.id}
          canManage
          publicUrl={`${APP_URL}/${tenant.slug}`}
          publicUrlLabel={t('currentPublicPageLabel')}
          title={t('businessQrTitle')}
          description={t('businessQrDescription')}
          sectionAria={t('businessQrSectionAria')}
        />
      </div>
    </main>
  )
}

export default function TenantEditPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params)
  return (
    <ErrorBoundary feature="Tenant Edit">
      <PermissionGuard permission="tenant.manage"fallback={<AccessDenied />}>
        <TenantEditContent tenantId={tenantId} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
