import type { Tenant } from '@/types'
import type { TenantMembership } from '@/types/rbac'
import { featureFlagsService } from '@/services/feature-flags.service'
import { useTenantStore } from '@/stores'
import { hasMembershipTenantDisplayMetadata } from '@/lib/console-tenant-display'

function membershipToTenantShell(membership: TenantMembership): Tenant {
  return {
    id: membership.tenantId,
    name: membership.tenantName ?? membership.tenantSlug ?? membership.tenantId,
    slug: membership.tenantSlug ?? membership.tenantId,
    image: membership.tenantLogo ?? undefined,
    businessTypes: [],
    // Console shell: visible for workspace UI; operational state from membership.
    is_active: true,
    status:
      membership.status === 'suspended' || membership.status === 'revoked'
        ? 'CLOSED'
        : 'ACTIVE',
    created_at: '',
    settings: {},
  }
}

/**
 * Hydrates a minimal resolved tenant record from GET /auth/me membership metadata.
 * Avoids GET /tenants/:id for selector rendering when membership is complete.
 */
export function hydrateConsoleTenantFromMembership(membership: TenantMembership): void {
  const tenant = membershipToTenantShell(membership)
  useTenantStore.setState({
    tenant,
    isLoading: false,
    tenantState: 'resolved',
    lastAttemptedTenantId: membership.tenantId,
    lastAttemptedSlug: membership.tenantSlug,
    featureFlags: featureFlagsService.resolve(tenant),
    featureFlagsInitialized: true,
    rbacInitialized: true,
  })
}

/**
 * Loads the full tenant record (theme, settings, feature-flag overrides) in the
 * background — never required for selector boot.
 */
export function ensureFullTenantRecord(tenantId: string): Promise<void> {
  const current = useTenantStore.getState()
  if (current.tenant?.id === tenantId && current.tenant.settings && Object.keys(current.tenant.settings).length > 0) {
    return Promise.resolve()
  }
  return useTenantStore.getState().loadTenantById(tenantId).then(() => undefined)
}

export function canBootTenantFromMembership(membership: TenantMembership | undefined): membership is TenantMembership {
  return Boolean(membership && hasMembershipTenantDisplayMetadata(membership))
}
