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
import { resolveTenantImage } from '@/lib/tenant-branding'
import {
  isTenantOperational,
  isTenantVisible,
} from '@/lib/tenant-state'
import { tenantStatusLabelKey } from '@/lib/provision-result-display'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { APP_URL } from '@/constants'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-[var(--success-text)] bg-[var(--success-subtle)]',
  INACTIVE: 'text-[var(--fg-muted)] bg-[var(--card-hover)]',
  CLOSED: 'text-[var(--warning-text)] bg-[var(--warning-subtle)]',
}

function ProfileSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const statusClass = STATUS_COLORS[tenant.status] ?? 'text-[var(--fg-muted)] bg-[var(--card-hover)]'
  return (
    <section aria-label={t('tenantProfileAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('profileTabLabel')}</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-[var(--fg-muted)]">{t('nameLabel')}</dt><dd className="font-medium">{tenant.name}</dd></div>
        <div><dt className="text-[var(--fg-muted)]">{t('slugLabel')}</dt><dd className="font-mono">{tenant.slug}</dd></div>
        <div><dt className="text-[var(--fg-muted)]">{t('idLabel')}</dt><dd className="font-mono text-xs">{tenant.id}</dd></div>
        <div>
          <dt className="text-[var(--fg-muted)]">{t('tableHeaders.status')}</dt>
          <dd>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
              {t(tenantStatusLabelKey(tenant.status))}
            </span>
          </dd>
        </div>
        <div><dt className="text-[var(--fg-muted)]">{t('createdLabel')}</dt><dd>{new Date(tenant.created_at).toLocaleDateString()}</dd></div>
      </dl>
    </section>
  )
}

function TenantQrSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const publicUrl = `${APP_URL}/${tenant.slug}`
  return (
    <section aria-label={t('businessQrSectionAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-1">{t('businessQrTitle')}</h2>
      <p className="text-sm text-[var(--fg-muted)] mb-4">{t('businessQrDescription')}</p>
      <CopyUrlWidget
        url={publicUrl}
        label={t('currentPublicPageLabel')}
        qrUrl={tenant.qr?.url}
        qrTitle=""
      />
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
  const theme = tenant.settings?.theme ?? {}
  const tenantImage = resolveTenantImage(tenant)
  const hasBranding =
    Boolean(theme.primaryColor || theme.accentHoverColor || theme.fontBody || tenantImage)

  return (
    <section aria-label={t('brandingSectionAria')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('brandingSectionAria')}</h2>
      {hasBranding ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {theme.primaryColor && (
            <div>
              <dt className="text-[var(--fg-muted)]">{t('primaryColorLabel')}</dt>
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
              <dt className="text-[var(--fg-muted)]">{t('accentHoverColorLabel')}</dt>
              <dd className="font-mono">{theme.accentHoverColor}</dd>
            </div>
          )}
          {tenantImage && (
            <div className="col-span-2">
              <dt className="text-[var(--fg-muted)]">{t('logoUploadLabel')}</dt>
              <dd className="font-mono text-xs break-all">{tenantImage}</dd>
            </div>
          )}
          {theme.fontBody && (
            <div>
              <dt className="text-[var(--fg-muted)]">{t('bodyFontLabel')}</dt>
              <dd className="font-mono">{theme.fontBody}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-[var(--fg-subtle)]">{t('noBrandingConfiguredHint')}</p>
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
          <p className="text-xs font-semibold text-[var(--success-text)] uppercase tracking-wide mb-2">{t('enabledLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {enabledFlags.map(([key]) => (
              <span key={key} className="px-2 py-0.5 text-xs bg-[var(--success-subtle)] text-[var(--success-text)] rounded">
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
      {disabledFlags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--fg-subtle)] uppercase tracking-wide mb-2">{t('disabledLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {disabledFlags.map(([key]) => (
              <span key={key} className="px-2 py-0.5 text-xs bg-[var(--card-hover)] text-[var(--fg-subtle)] rounded">
                {key}
              </span>
            ))}
          </div>
        </div>
      )}
      {enabledFlags.length === 0 && disabledFlags.length === 0 && (
        <p className="text-sm text-[var(--fg-subtle)]">{t('noFeatureFlagsConfigured')}</p>
      )}
    </section>
  )
}

function StatusActionsSection({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const activate = useActivateTenant()
  const suspend = useSuspendTenant()
  const archive = useArchiveTenant()
  const operational = isTenantOperational(tenant)
  const visible = isTenantVisible(tenant)
  // Archived from public catalog: hidden + closed — console treats as terminal for these actions.
  const isArchived = !visible && !operational

  return (
    <section aria-label={t('statusManagementLabel')} className="border rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold mb-4">{t('statusManagementLabel')}</h2>
      <p className="text-sm text-[var(--fg-muted)] mb-4">
        {t('currentStatusColon', { status: t(tenantStatusLabelKey(tenant.status)) })}
      </p>
      {isArchived ? (
        <p className="text-sm text-[var(--fg-subtle)]">{t('tenantArchivedCannotModifyHint')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {!operational && (
            <button
              type="button"
              onClick={() => activate.mutate(tenant.id)}
              disabled={activate.isPending}
              className="px-4 py-2 text-sm bg-[var(--success)] text-[var(--success-fg)] rounded-lg disabled:opacity-50"
              aria-label={t('activateTenantAria')}
            >
              {activate.isPending ? t('activatingEllipsis') : t('activateLabel')}
            </button>
          )}
          {operational && (
            <button
              type="button"
              onClick={() => suspend.mutate(tenant.id)}
              disabled={suspend.isPending}
              className="px-4 py-2 text-sm bg-[var(--warning)] text-[var(--warning-fg)] rounded-lg disabled:opacity-50"
              aria-label={t('suspendTenantAria')}
            >
              {suspend.isPending ? t('suspendingEllipsis') : t('suspendLabel')}
            </button>
          )}
          {visible && (
            <button
              type="button"
              onClick={() => archive.mutate(tenant.id)}
              disabled={archive.isPending}
              className="px-4 py-2 text-sm bg-[var(--danger)] text-[var(--danger-fg)] rounded-lg disabled:opacity-50"
              aria-label={t('archiveTenantAria')}
            >
              {archive.isPending ? t('archivingEllipsis') : t('archiveTitle')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function TenantDetailContent({ tenantId }: { tenantId: string }) {
  const t = useTranslations('console')
  const { data: tenant, isLoading, isError } = useQuery<Tenant>({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenantById(tenantId),
  })

  if (isLoading) {
    return (
      <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-[var(--fg-muted)]">{t('loadingTenantEllipsis')}</p>
      </main>
    )
  }

  if (isError || !tenant) {
    return (
      <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
        <p className="text-[var(--danger-text)]">{t('tenantNotFoundPeriod')}</p>
        <Link href="/console/tenants"className="text-sm text-accent underline mt-2 block">
          {t('backToTenantsLabel')}
        </Link>
      </main>
    )
  }

  return (
    <main aria-label={t('tenantDetailAria')} className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/console/tenants"className="text-sm text-[var(--fg-muted)] hover:underline">
            {t('backArrowTenants')}
          </Link>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/console/tenants/${tenant.id}/edit`}
            className="text-sm text-accent hover:underline"
          >
            {t('editTenantSettingsLabel')}
          </Link>
          <PreviewButton href="/"label={t('previewTenantSiteLabel')} size="sm"/>
        </div>
      </div>

      <ProfileSection tenant={tenant} />
      <TenantQrSection tenant={tenant} />
      <BusinessTypeSection tenant={tenant} />
      <BrandingSection tenant={tenant} />
      <CapabilitiesSection tenant={tenant} />
      <StatusActionsSection tenant={tenant} />
    </main>
  )
}

export default function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params)
  return (
    <ErrorBoundary feature="Tenant Detail">
      <PermissionGuard permission="tenant.view"fallback={<AccessDenied />}>
        <TenantDetailContent tenantId={tenantId} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
