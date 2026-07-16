'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { useActivateTenant, useSuspendTenant, useArchiveTenant } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { tenantService } from '@/services/tenant.service'
import type { Tenant } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-100',
  trial: 'text-blue-700 bg-blue-100',
  suspended: 'text-amber-700 bg-amber-100',
  churned: 'text-gray-500 bg-gray-100',
  archived: 'text-red-700 bg-red-100',
}

const TENANT_STATUS_KEY: Record<string, string> = {
  active: 'statusActive',
  trial: 'tenantStatusTrial',
  suspended: 'statusSuspended',
  churned: 'tenantStatusChurned',
  archived: 'tenantStatusArchived',
}

function ProfileSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const statusClass = STATUS_COLORS[tenant.status] ?? 'text-gray-500 bg-gray-100'
  return (
    <section aria-label={t('tenantProfileAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('profileTabLabel')}</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-gray-500">{t('nameLabel')}</dt><dd className="font-medium">{tenant.name}</dd></div>
        <div><dt className="text-gray-500">{t('slugLabel')}</dt><dd className="font-mono">{tenant.slug}</dd></div>
        <div><dt className="text-gray-500">{t('idLabel')}</dt><dd className="font-mono text-xs">{tenant.id}</dd></div>
        <div>
          <dt className="text-gray-500">{t('tableHeaders.status')}</dt>
          <dd>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
              {t(TENANT_STATUS_KEY[tenant.status] ?? 'statusInactive')}
            </span>
          </dd>
        </div>
        <div><dt className="text-gray-500">{t('createdLabel')}</dt><dd>{new Date(tenant.created_at).toLocaleDateString()}</dd></div>
      </dl>
    </section>
  )
}

function BusinessTypeSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  return (
    <section aria-label={t('businessTypeLabel')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('businessTypeAndModuleConfigLabel')}</h2>
      <div className="flex flex-wrap gap-2">
        {tenant.businessTypes?.map((bt) => (
          <span key={bt} className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium">
            {bt.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </section>
  )
}

function BrandingSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const theme = (tenant.settings?.theme ?? {}) as Record<string, string>
  const hasBranding = Object.keys(theme).length > 0

  return (
    <section aria-label={t('brandingSectionAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('brandingSectionAria')}</h2>
      {hasBranding ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {theme.primaryColor && (
            <div>
              <dt className="text-gray-500">{t('primaryColorLabel')}</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded border"
                  style={{ backgroundColor: theme.primaryColor }}
                  aria-hidden="true"
                />
                <span className="font-mono">{theme.primaryColor}</span>
              </dd>
            </div>
          )}
          {theme.accentHoverColor && (
            <div>
              <dt className="text-gray-500">{t('accentHoverColorLabel')}</dt>
              <dd className="font-mono">{theme.accentHoverColor}</dd>
            </div>
          )}
          {theme.logoUrl && (
            <div className="col-span-2">
              <dt className="text-gray-500">{t('logoUrlLabel')}</dt>
              <dd className="font-mono text-xs break-all">{theme.logoUrl}</dd>
            </div>
          )}
          {theme.fontBody && (
            <div>
              <dt className="text-gray-500">{t('bodyFontLabel')}</dt>
              <dd className="font-mono">{theme.fontBody}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-gray-400">{t('noBrandingConfiguredHint')}</p>
      )}
    </section>
  )
}

function CapabilitiesSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
  const enabledFlags = Object.entries(flags).filter(([, v]) => v)
  const disabledFlags = Object.entries(flags).filter(([, v]) => !v)

  return (
    <section aria-label={t('capabilitiesAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('capabilitiesAndFeatureFlagsLabel')}</h2>
      {enabledFlags.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">{t('enabledLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {enabledFlags.map(([key]) => (
              <span key={key} className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded">
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
      {disabledFlags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('disabledLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {disabledFlags.map(([key]) => (
              <span key={key} className="px-2 py-0.5 text-xs bg-gray-50 text-gray-400 rounded">
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
      {enabledFlags.length === 0 && disabledFlags.length === 0 && (
        <p className="text-sm text-gray-400">{t('noFeatureFlagsConfigured')}</p>
      )}
    </section>
  )
}

function StatusActionsSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const activate = useActivateTenant()
  const suspend = useSuspendTenant()
  const archive = useArchiveTenant()
  const isArchived = tenant.status === 'archived'

  return (
    <section aria-label={t('statusManagementLabel')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('statusManagementLabel')}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('currentStatusColon', { status: t(TENANT_STATUS_KEY[tenant.status] ?? 'statusInactive') })}
      </p>
      {isArchived ? (
        <p className="text-sm text-gray-400">{t('tenantArchivedCannotModifyHint')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tenant.status !== 'active' && (
            <button
              type="button"
              onClick={() => activate.mutate(tenant.slug)}
              disabled={activate.isPending}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50"
              aria-label={t('activateTenantAria')}
            >
              {activate.isPending ? t('activatingEllipsis') : t('activateLabel')}
            </button>
          )}
          {tenant.status === 'active' && (
            <button
              type="button"
              onClick={() => suspend.mutate(tenant.slug)}
              disabled={suspend.isPending}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg disabled:opacity-50"
              aria-label={t('suspendTenantAria')}
            >
              {suspend.isPending ? t('suspendingEllipsis') : t('suspendLabel')}
            </button>
          )}
          <button
            type="button"
            onClick={() => archive.mutate(tenant.slug)}
            disabled={archive.isPending}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
            aria-label={t('archiveTenantAria')}
          >
            {archive.isPending ? t('archivingEllipsis') : t('archiveTitle')}
          </button>
        </div>
      )}
    </section>
  )
}

function TenantDetailContent({ slug }: { slug: string }) {
  const t = useTranslations('console')
  const { data: tenant, isLoading, isError } = useQuery<Tenant>({
    queryKey: ['tenant', slug],
    queryFn: () => tenantService.getTenant(slug),
  })

  if (isLoading) {
    return (
      <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-gray-500">{t('loadingTenantEllipsis')}</p>
      </main>
    )
  }

  if (isError || !tenant) {
    return (
      <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600">{t('tenantNotFoundPeriod')}</p>
        <Link href="/console/tenants" className="text-sm text-accent underline mt-2 block">
          {t('backToTenantsLabel')}
        </Link>
      </main>
    )
  }

  return (
    <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/console/tenants" className="text-sm text-gray-500 hover:underline">
            {t('backArrowTenants')}
          </Link>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
        </div>
        <PreviewButton href="/" label={t('previewTenantSiteLabel')} size="sm" />
      </div>

      <ProfileSection tenant={tenant} />
      <BusinessTypeSection tenant={tenant} />
      <BrandingSection tenant={tenant} />
      <CapabilitiesSection tenant={tenant} />
      <StatusActionsSection tenant={tenant} />
    </main>
  )
}

export default function TenantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <ErrorBoundary feature="Tenant Detail">
      <PermissionGuard permission="tenant.view" fallback={<AccessDenied />}>
        <TenantDetailContent slug={slug} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
