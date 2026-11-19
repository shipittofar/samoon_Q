'use client'

import { useTranslations } from 'next-intl'
import { resolveTenantImage } from '@/lib/tenant-branding'
import type { Tenant } from '@/types'

const BUSINESS_TYPE_LABEL_KEYS: Record<string, string> = {
  restaurant: 'businessTypeRestaurant',
  cafe: 'businessTypeCafe',
  bar: 'businessTypeBar',
  food_court: 'businessTypeFoodCourt',
  food_truck: 'businessTypeFoodTruck',
  mobile_cafe: 'businessTypeMobileCafe',
  beauty_salon: 'businessTypeBeautySalon',
  clinic: 'businessTypeClinic',
}

export function BranchTenantContextCard({
  tenant,
  mode,
}: {
  tenant: Tenant
  mode: 'create' | 'edit'
}) {
  const t = useTranslations('console')
  const logo = resolveTenantImage(tenant)
  const types = (tenant.businessTypes ?? [])
    .map((bt) => t(BUSINESS_TYPE_LABEL_KEYS[bt] ?? 'businessTypeLabel'))
    .join(', ')

  return (
    <section
      aria-label={t('tenantContextAria')}
      className="mb-6 rounded-lg border border-[var(--border)] p-4 flex gap-4 items-center"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-14 w-14 rounded-lg object-cover border border-[var(--border)]" />
      ) : (
        <div className="h-14 w-14 rounded-lg bg-[var(--card-hover)] border border-[var(--border)]" />
      )}
      <div className="min-w-0">
        <p className="text-xs text-[var(--fg-muted)]">
          {mode === 'create'
            ? t('createBranchForTenant', { name: tenant.name })
            : t('editBranchForTenant', { name: tenant.name })}
        </p>
        <p className="text-base font-semibold truncate">{tenant.name}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{types || t('businessTypeLabel')}</p>
      </div>
    </section>
  )
}
