import * as React from 'react'
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { menuService } from '@/services/menu.service'
import { orderService } from '@/services/order.service'
import { adminService } from '@/services/admin.service'
import { loyaltyService } from '@/services/loyalty.service'
import type { EarnPointsPayload } from '@/services/loyalty.service'
import { promotionService } from '@/services/promotion.service'
import type { CreatePromotionPayload, UpdatePromotionPayload } from '@/services/promotion.service'
import { vendorService } from '@/services/vendor.service'
import type { CreateVendorPayload, UpdateVendorPayload, CreateSettlementPayload } from '@/services/vendor.service'
import {
  branchService,
  reservationService,
  tableService,
  userService,
} from '@/services/combined.service'
import { authService, type GetMeResponse } from '@/services/auth.service'
import { qrExperienceService } from '@/services/qr-experience.service'
import { analyticsService } from '@/services/analytics.service'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { PUBLIC_TENANTS_QUERY_KEY, fetchPublicTenantBySlug } from '@/lib/public-tenant-resolution'
import { resolveStatusUpdate, type OrderStatusContext } from '@/lib/order-status'
import { staffService } from '@/services/staff.service'
import type {
  InviteStaffPayload,
  UpdateStaffRolesPayload,
  TransferOwnershipPayload,
} from '@/types/staff'
import { branchManagementService } from '@/services/branch.service'
import type {
  Branch as BranchEntity,
  AssignManagerPayload,
  BranchResolutionState,
} from '@/types/branch'
import type { BranchWriteRequest, BranchCreateRequest } from '@/types/branch-form'
import { branchAnalyticsService } from '@/services/branch-analytics.service'
import type {
  BranchRevenueAnalytics,
  BranchOrderAnalytics,
  BranchReservationAnalytics,
} from '@/types/analytics'
import { auditLogService } from '@/services/audit-log.service'
import type { AuditFilter, AuditExportRequest } from '@/types/audit-log'
import { notificationRichService } from '@/services/notification.service'
import { notificationPreferencesService } from '@/services/notification-preferences.service'
import type {
  NotificationFilter,
  NotificationCategory,
  NotificationPreference,
  ChannelPreference,
  NotificationPriority,
} from '@/types/notification'
import { useAuthStore, useNotificationStore, useTenantStore, useLangStore, useRbacStore, useBranchStore, useCartStore } from '@/stores'
import { hasMembershipBranches } from '@/lib/console-workspace'
import { dispatchPostLoginRedirect } from '@/lib/post-auth-navigation'
import {
  type AuthTransitionPhase,
  redirectAndAwaitMount,
} from '@/lib/auth-transition'
import { resolvePostAuthDestination } from '@/utils/auth-redirect'
import { getAccessToken } from '@/services/axios.instance'
import { useConsoleTenantId, useConsoleBranchId } from './console-workspace'
import {
  invalidatePendingOrdersCountQueries,
  invalidatePendingReservationsCountQueries,
} from '@/lib/console-pending-counts'
import {
  synchronizeTenantMutation,
  synchronizeBranchMutation,
  synchronizeBranchDeleted,
} from '@/lib/entity-sync'
import { logRbacDiagnostics } from '@/lib/rbac-diagnostics'
import { usePermissionStore } from '@/stores/permission-store'
import { normalizeTenantPermissions, canAccessBranch, hasAnyMembership } from '@/services/permission.service'
import { refreshPermissionCache } from '@/lib/permission-cache'
import {
  isMockAuthMode,
  sessionHasRoles,
  withDashboardAccess,
} from '@/lib/effective-permissions'
import { clearAuthenticatedClientState } from '@/lib/auth-session-teardown'
import { applyTenantSessionRbac } from '@/lib/auth-session-rbac'
import { applyPlatformRoleFromSession } from '@/platform-admin/store'
import type { P7Permission, PermissionCheckOptions, Role } from '@/types/rbac'
// Phase 2 (RBAC unification) — no imports from ownership-resolution.service.ts,
// owner.service.ts, or staff-assignment.service.ts remain in this file.
// Access decisions come from usePermissions()/currentTenantSession only.
import { getHeaderNav, getDashboardNav, getAdminNav, hasCapability, CAPABILITY_FLAG_MAP } from '@/modules/registry'
import { CACHE_TIME, STALE_TIME } from '@/constants'
import { paymentService } from '@/services/payment.service'
import { reviewService } from '@/services/review.service'
import {
  favoritesKeys,
  prefetchFavoritesList,
  useFavoritesList,
  useFavoritesQuery,
  useFavoritesSync,
  useAddFavorite,
  useRemoveFavorite,
  useIsFavorite,
  useFavoriteAction,
  useRefreshFavorites,
  type UseFavoritesListResult,
} from './favorites'
import type { MenuFilters, ConsoleMenuItemsParams, ConsoleMenuTagsParams } from '@/services/menu.service'
import type { CreateOrderPayload } from '@/services/order.service'
import type { CreatePaymentIntentPayload } from '@/services/payment.service'
import type { CreateReviewPayload } from '@/services/review.service'
import type { CreateReservationPayload } from '@/services/combined.service'
import type {
  AdminCustomerFilters,
  AdminOrderFilters,
  AdminOrdersScope,
  AdminReservationFilters,
  ConsoleCustomer,
  Capability,
  Category,
  CategoryWriteRequest,
  ConsoleMenuTag,
  Extra,
  ExtraWriteRequest,
  ExtraGroup,
  LoginCredentials,
  LoyaltyReward,
  MenuItem,
  MenuItemWriteRequest,
  NavItem,
  Order,
  OrderStatus,
  PaginatedResponse,
  RegisterData,
  Reservation,
  ReservationStatus,
  SystemReadiness,
  TagWriteRequest,
  TenantLifecycle,
  SendOTPRequest,
  User,
  VerifyOTPRequest,
} from '@/types'
import { buildDrfPaginationParams } from '@/utils/pagination'
import { publicBranchFromDetail, type PublicBranchInfo } from '@/types/marketplace'
import type { Tenant } from '@/types'
import { resolvePublicBranchList } from '@/lib/public-branches'
import { mergeBranchCheckout } from '@/lib/branch-checkout'
import { adaptDiscoverResponse } from '@/lib/discover-adapter'
import { discoverService } from '@/services/discover.service'
import type { DiscoverItem } from '@/lib/discover-adapter'
import { invalidateRbacStaffQueries, invalidatePermissionCatalog, invalidateRbacWave4Mutations, invalidateRbacAssignmentMutations, invalidatePermissionOverrides, invalidateEffectivePermissions, invalidatePermissionAudit, invalidateRolePermissions } from '@/lib/rbac-query-invalidation'
import { upsertOverrideInList } from '@/lib/permission-override-lifecycle'
import { fetchTenantRoles, listAssignments, createAssignment, updateAssignment, revokeAssignment } from '@/api/rbac'
import { fetchPermissionCatalog } from '@/api/permissions'
import {
  listPermissionOverrides,
  createPermissionOverride,
  updatePermissionOverride,
  deletePermissionOverride,
  fetchEffectivePermissions,
  listPermissionAudit,
  fetchRolePermissions,
  replaceRolePermissions,
} from '@/api/authorization'
import type {
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
  CreatePermissionOverridePayload,
  UpdatePermissionOverridePayload,
  ReplaceRolePermissionsPayload,
  PermissionOverride,
} from '@/types/rbac-api'

// ── Tenant Lifecycle Hook (Phase 1B stabilization) ────────────────────────────
/**
 * Returns the raw tenant lifecycle state.
 * Prefer useSystemReady() in Phase 1B consumers — it provides the full
 * execution gate contract without requiring callers to re-derive booleans.
 */
export function useTenantState(): TenantLifecycle {
  return useTenantStore((s) => s.tenantState)
}

// ── System Ready Hook — P1B.6 execution gate ─────────────────────────────────
/**
 * Returns the authoritative execution gate for all Phase 1B+ systems.
 * Fully derived — introduces no new state, not persisted.
 *
 * Aggregates three independent bootstrap signals:
 *   tenantState             (P1A.1) — must not be 'loading'
 *   rbacInitialized         (P1B.1) — RBAC system must have completed setup
 *   featureFlagsInitialized (P1B.2) — feature flag system must have completed setup
 *
 * Canonical usage in every Phase 1B consumer:
 *
 *   const { canExecute, isFallback } = useSystemReady()
 *   if (!canExecute) return <safe-default>
 *   // all subsystems ready; branch on isFallback for DEFAULT_TENANT vs. full rules
 *
 * See SystemReadiness in types/index.ts for the complete field contract.
 */
export function useSystemReady(): SystemReadiness {
  const tenantState = useTenantStore((s) => s.tenantState)
  const rbacInitialized = useTenantStore((s) => s.rbacInitialized)
  const featureFlagsInitialized = useTenantStore((s) => s.featureFlagsInitialized)
  const isLoading = tenantState === 'loading'
  const isReady = tenantState === 'resolved'
  const isFallback = tenantState === 'not_found' || tenantState === 'forbidden' || tenantState === 'error'

  // Dev-only: warn when tenant has settled but a subsystem initializer has not fired.
  // TenantBootstrapper sets both flags synchronously after loadTenant() in production.
  // In development this surfaces a missing or broken initializer immediately.
  if (process.env.NODE_ENV !== 'production' && !isLoading && (!rbacInitialized || !featureFlagsInitialized)) {
    console.warn('[SystemReadiness] System partially initialized: execution gate may be unstable')
  }

  return {
    isLoading,
    isReady,
    isFallback,
    canExecute: !isLoading && rbacInitialized && featureFlagsInitialized,
  }
}

// ── P7.1 + P8.5 Permission Hooks ─────────────────────────────────────────────

/**
 * Returns all P7 permissions effective for the current user in the active
 * tenant.
 *
 * Real backend: GET /auth/me/permissions (permission store) is the source of
 * truth. Client ROLE_PERMISSION_MAP expansions must not widen that set.
 * `dashboard:access` is synthesized when the API omits it but the user has
 * tenant roles or any API permission.
 *
 * Mock mode: session permissions (role-derived) remain authoritative, with
 * an optional union when the permission store is also populated for the
 * active tenant.
 */
export function usePermissions(): readonly P7Permission[] {
  const tenantId = useConsoleTenantId()
  const storePermissions = usePermissionStore((s) => s.permissions)
  const storeTenantId = usePermissionStore((s) => s.tenantId)
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)

  return useMemo(() => {
    const sessionAligned =
      currentTenantSession && currentTenantSession.tenantId === tenantId
        ? currentTenantSession
        : null
    const sessionPerms = sessionAligned?.permissions ?? []
    const hasRoles = sessionHasRoles(sessionAligned?.roles)

    let resolved: P7Permission[]
    if (!isMockAuthMode()) {
      // API cache for this tenant is authoritative once present (including []).
      if (storeTenantId === tenantId) {
        resolved = withDashboardAccess(storePermissions, { hasTenantRoles: hasRoles })
      } else {
        // Permissions not loaded yet — deny fine-grained access (empty nav / guards).
        resolved = []
      }
    } else if (storeTenantId === tenantId && storePermissions.length > 0) {
      resolved = [...new Set([...sessionPerms, ...storePermissions])] as P7Permission[]
    } else {
      resolved = sessionPerms as P7Permission[]
    }

    logRbacDiagnostics(resolved)
    return resolved
  }, [tenantId, storePermissions, storeTenantId, currentTenantSession])
}

// P10.6 Phase G — shared per-resource feature-flag gate, previously
// duplicated inline in usePermission() only. useAnyPermission()/
// useAllPermissions() now apply it too (see
// docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md Phase G) so all three
// permission hooks share identical Permission AND Capability AND
// FeatureFlag semantics — closing the P10.5.5 documented inconsistency.
const PERMISSION_FEATURE_FLAG_MAP: Record<string, string> = {
  orders: 'ordering.enabled',
  menu: 'menu.enabled',
  reservations: 'reservations.enabled',
  loyalty: 'loyalty.enabled',
  promotions: 'promotions.enabled',
  vendors: 'food_court.vendor_management.enabled',
  reviews: 'reviews.enabled',
}

function isPermissionFeatureFlagGated(permission: P7Permission, featureFlags: Record<string, boolean>): boolean {
  const resource = permission.split('.')[0]!
  const flagKey = PERMISSION_FEATURE_FLAG_MAP[resource]
  return !!flagKey && featureFlags[flagKey] === false
}

/**
 * Returns true if the current user holds the given P7 permission for the active tenant.
 * Respects: Permission AND Capability AND FeatureFlag AND UserOverrides.
 */
export function usePermission(permission: P7Permission, opts?: PermissionCheckOptions): boolean {
  const permissions = usePermissions()
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    if (!permissions.includes(permission)) return false
    const resource = permission.split('.')[0]!
    if (opts?.capabilities?.[resource] === false) return false
    if (isPermissionFeatureFlagGated(permission, featureFlags)) return false
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions, permission, featureFlags])
}

/**
 * Phase 9.4 — the single frontend answer to "can the current session see
 * `branchId`." Reads ONLY `currentTenantSession.branchAccess` (via
 * `canAccessBranch()`, permission.service.ts — the one implementation
 * this wraps; never recomputed or duplicated here). Does not inspect
 * roles or `accountType` directly, and does not call
 * `resolveBranchAccess()` again — that already ran once, when the
 * session was seeded, to produce the `branchAccess` this hook reads.
 *
 * Frontend-only, defense-in-depth / UX signal — NOT a security boundary.
 * See `canAccessBranch()`'s doc comment for why: the backend remains the
 * sole enforcement point for every branch-scoped request. This hook
 * exists purely to avoid firing doomed requests, avoid rendering
 * branches/links the user can't use, and give an immediate local
 * "Access Denied" instead of waiting on a round trip that would fail
 * anyway once the backend enforces this.
 */
export function useBranchAccess(branchId: string | null | undefined): boolean {
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)
  const activeTenantId = useRbacStore((s) => s.activeMembership?.tenantId)
  const branchAccess = currentTenantSession && currentTenantSession.tenantId === activeTenantId
    ? currentTenantSession.branchAccess
    : undefined
  return canAccessBranch(branchAccess, branchId)
}

/**
 * Returns true if the current user holds AT LEAST ONE of the given permissions.
 * Respects user overrides, capability gates (opts.capabilities), and — as
 * of P10.6 Phase G — the same per-resource feature-flag gate usePermission()
 * applies (previously a documented inconsistency, see P10.5.5).
 */
export function useAnyPermission(permissions: P7Permission[], opts?: PermissionCheckOptions): boolean {
  const effectivePermissions = usePermissions()
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    if (permissions.length === 0) return false
    return permissions.some((p) => {
      if (!effectivePermissions.includes(p)) return false
      const resource = p.split('.')[0]!
      if (opts?.capabilities?.[resource] === false) return false
      if (isPermissionFeatureFlagGated(p, featureFlags)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePermissions, permissions.join(','), featureFlags])
}

/**
 * Returns true if the current user holds ALL of the given permissions.
 * Respects user overrides, capability gates (opts.capabilities), and — as
 * of P10.6 Phase G — the same per-resource feature-flag gate usePermission()
 * applies (previously a documented inconsistency, see P10.5.5).
 */
export function useAllPermissions(permissions: P7Permission[], opts?: PermissionCheckOptions): boolean {
  const effectivePermissions = usePermissions()
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    if (permissions.length === 0) return false
    return permissions.every((p) => {
      if (!effectivePermissions.includes(p)) return false
      const resource = p.split('.')[0]!
      if (opts?.capabilities?.[resource] === false) return false
      if (isPermissionFeatureFlagGated(p, featureFlags)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePermissions, permissions.join(','), featureFlags])
}

// ── Feature Flag Hook — P1B.2 ─────────────────────────────────────────────────
/**
 * Returns the resolved boolean value of a feature flag for the active tenant.
 * Returns false for any key not present in the resolved flag map (safe default off).
 *
 * Canonical usage:
 *   const deliveryEnabled = useFeatureFlag('delivery.enabled')
 */
export function useFeatureFlag(key: string): boolean {
  return useTenantStore((s) => s.featureFlags[key] ?? false)
}

// ── Navigation Hooks — Phase 2 (P2.4) ────────────────────────────────────────

/**
 * Returns header nav items for the active tenant's modules, filtered by feature flags.
 *
 * Filtering rules:
 *   - Items without `featureFlagKey` are always shown (backward compatible).
 *   - Items with `featureFlagKey` are hidden when the flag resolves to false.
 *   - When system is not yet ready (canExecute=false), all nav items are returned
 *     so the header is never empty during bootstrap.
 *
 * Canonical replacement for calling getHeaderNav() directly in UI components.
 */
export function useModuleNav(): NavItem[] {
  const { canExecute } = useSystemReady()
  const tenant = useTenantStore((s) => s.tenant)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const allNav = getHeaderNav(tenant?.businessTypes ?? [])
  if (!canExecute) return allNav
  return allNav.filter(
    (item) => !item.featureFlagKey || featureFlags[item.featureFlagKey] !== false,
  )
}

/**
 * P10.2.2 — `dashboard:access` as a derived, computed boolean, per
 * docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §8.1:
 *
 *   dashboard:access = (actor is an Owner with ≥1 owned Tenant)
 *                    OR (actor has ≥1 active StaffAssignment, any tenant, any role)
 *
 * P10.4.10 — the legacy `rbacService.hasPermission(role, 'dashboard:access')`
 * fallback ('legacyGranted') was removed from this OR-expression.
 * docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md closed the id-space gap it
 * existed for (`staff@samoon.com`/`multirole@samoon.com` — and
 * `admin@samoon.com`/`kitchen@samoon.com`, found during that phase — now
 * have real StaffMember/StaffAssignment fixtures), and
 * docs/P10.4.10_REMOVE_LEGACY_DASHBOARD_FALLBACK.md proved every
 * console-capable demo account resolves through this ownership/
 * StaffAssignment path alone. This is the single source of truth
 * `AuthGuard` and `useDashboardNav()` both now read — no parallel
 * implementation of the `dashboard:access` check exists anywhere else.
 *
 * Issue investigation fix (real-backend admin/owner/staff lockout) — the
 * ownership/StaffAssignment path above is backed by mock-only lookups
 * (`staffService.findStaffMemberByEmail`/`ownerService.getOwnerByUserIdSync`,
 * both hard-gated `if (!USE_MOCK) return undefined`). In real-backend mode
 * `identity` is therefore always `{}`, and — before this fix — this hook
 * always returned `false`, locking every real-backend user out of
 * /console regardless of role. The role-based fallback below only runs
 * when NO mock fixture was found at all (`!identity.owner &&
 * !identity.staffMember`) — an identity that WAS found but failed an
 * eligibility check (suspended/archived) still falls through to `false`
 * unchanged, so existing mock-mode denials are preserved. The fallback
 * reuses `resolveWorkspace()` (src/utils/navigation-intelligence.ts) —
 * the same role→workspace mapping AuthGuard's post-login redirect
 * already trusts — instead of inventing a second role list: any role
 * that resolves to a console workspace (not `/dashboard`, which is
 * `customer`'s destination) is granted dashboard access.
 */
export function useHasDashboardAccess(): boolean {
  // Phase 2 (RBAC unification) — `dashboard:access` is a real permission.
  // Real backend: while /auth/me/permissions is in flight, provisionally
  // allow console shell entry when the session already has tenant roles —
  // fine-grained nav/guards still deny until the API cache is ready.
  //
  // Require a concrete tenantId AND a non-null session before reading
  // `.roles`. `currentTenantSession?.tenantId === tenantId` is vacuously
  // true when BOTH are undefined (pre-bootstrap / no activeMembership),
  // which used to evaluate `currentTenantSession.roles` and crash
  // ConsoleWorkspaceGate on /console before AuthBootstrapper finished.
  const tenantId = useConsoleTenantId()
  const loading = usePermissionStore((s) => s.loading)
  const storeTenantId = usePermissionStore((s) => s.tenantId)
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)
  const hasPermission = usePermission('dashboard:access')

  if (
    !isMockAuthMode() &&
    tenantId != null &&
    currentTenantSession != null &&
    currentTenantSession.tenantId === tenantId &&
    sessionHasRoles(currentTenantSession.roles) &&
    (loading || storeTenantId !== tenantId)
  ) {
    return true
  }
  return hasPermission
}

/**
 * Returns dashboard sidebar nav items, filtered by RBAC.
 *
 * - Returns empty array when user lacks `dashboard:access` (see
 *   `useHasDashboardAccess()` — now ownership/StaffAssignment-aware).
 * - Returns full dashboard nav for staff and admin.
 * - Safe for unauthenticated users (no identity → no access → empty array).
 */
export function useDashboardNav(): NavItem[] {
  const hasAccess = useHasDashboardAccess()
  if (!hasAccess) return []
  return getDashboardNav()
}

// ── Capability Hooks — P6.8 ───────────────────────────────────────────────────

/**
 * Returns true when the active tenant's modules support the given capability
 * at the module-default level (required or defaultEnabled).
 *
 * This reflects the module-level default, NOT a tenant override. For the
 * tenant-overridden value use useFeatureFlag(CAPABILITY_FLAG_MAP[cap]) or
 * useCapabilityFlag() instead.
 *
 * Canonical usage:
 *   const hasLoyalty = useCapability('loyalty')
 *   if (!hasLoyalty) return null
 */
export function useCapability(cap: Capability): boolean {
  const tenant = useTenantStore((s) => s.tenant)
  return hasCapability(tenant?.businessTypes ?? [], cap)
}

/**
 * Returns the resolved boolean value of the feature flag that corresponds to
 * the given capability, after applying tenant overrides (layer 3).
 *
 * This is the tenant-override-aware counterpart to useCapability(). Prefer
 * this when the tenant may have explicitly enabled or disabled a capability.
 *
 * Canonical usage:
 *   const loyaltyOn = useCapabilityFlag('loyalty')  // reads 'loyalty.enabled'
 */
export function useCapabilityFlag(cap: Capability): boolean {
  const flagKey = CAPABILITY_FLAG_MAP[cap]
  return useTenantStore((s) => s.featureFlags[flagKey] ?? false)
}

/**
 * Returns admin nav items for the active tenant's modules, filtered by
 * feature flags and permission keys.
 *
 * Filtering rules:
 *   - Items without `featureFlagKey` are always shown (flag-wise).
 *   - Items with `featureFlagKey` are hidden when the flag resolves to false.
 *   - Items with `permissionKey` require an exact permission match.
 *   - When system is not ready, or real-backend permissions are still
 *     loading, returns [] — never flash unauthorized items.
 *
 * Canonical usage in admin layouts:
 *   const adminNav = useAdminModuleNav()
 */
export function useAdminModuleNav(): NavItem[] {
  const { canExecute } = useSystemReady()
  const tenantId = useConsoleTenantId()
  const tenant = useTenantStore((s) => s.tenant)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const permissionsLoading = usePermissionStore((s) => s.loading)
  const storeTenantId = usePermissionStore((s) => s.tenantId)
  const alignedTenant = tenantId && tenant?.id === tenantId ? tenant : null
  const permissions = usePermissions()
  const allAdminNav = getAdminNav(alignedTenant?.businessTypes ?? [])

  // Deny-by-default while bootstrap or API permissions are unsettled.
  if (!canExecute) return []
  if (!isMockAuthMode() && (permissionsLoading || storeTenantId !== tenantId)) return []

  return allAdminNav.filter((item) => {
    if (item.featureFlagKey && featureFlags[item.featureFlagKey] === false) return false
    if (item.permissionKey && !permissions.includes(item.permissionKey)) return false
    return true
  })
}

// ── Auth Hooks ────────────────────────────────────────────────────────────────
/**
 * Phase 2 (RBAC unification) — seeds currentTenantSession via
 * normalizeTenantPermissions(), the one place that translates whichever
 * field name the auth response used (`p7Roles` here, `tenantRoles` from
 * getMe()) into `{ roles, permissions }`. No consumer downstream needs to
 * know which field this came from.
 *
 * Phase Z.1 — also accepts the frozen-contract `memberships`/
 * `activeMembership` fields (optional; mock mode now sends them alongside
 * `p7Roles` — see deriveMockAuthSession() in auth.service.ts). Passing
 * them through here is what actually exercises
 * normalizeTenantPermissions()'s memberships-priority branch end to end,
 * rather than leaving it type-compatible but never invoked.
 */
function seedTenantSession(
  tenantId: string,
  response: {
    p7Roles?: import('@/types/rbac').Role[]
    memberships?: import('@/types/rbac').TenantMembership[]
    activeMembership?: import('@/types/rbac').TenantMembership
  },
) {
  applyTenantSessionRbac(tenantId, {
    memberships: response.memberships,
    activeMembership: response.activeMembership,
    p7Roles: response.p7Roles,
  })
}

function seedAuthSessionMemberships(
  response: {
    p7Roles?: import('@/types/rbac').Role[]
    memberships?: import('@/types/rbac').TenantMembership[]
    activeMembership?: import('@/types/rbac').TenantMembership
  },
) {
  useRbacStore.getState().setHasTenantMembership(hasAnyMembership(response))
  useRbacStore.getState().setSessionMemberships(
    response.memberships !== undefined && response.memberships !== null ? response.memberships : null,
    response.activeMembership ?? null,
  )
}


function tenantRolesForPostLoginRedirect(data: GetMeResponse): Role[] | undefined {
  const activeId = data.activeMembership?.tenantId
  if (activeId && data.memberships?.length) {
    const active = data.memberships.find((m) => m.tenantId === activeId)
    if (active?.roles?.length) return active.roles
  }
  if (data.memberships?.length === 1 && data.memberships[0].roles.length > 0) {
    return data.memberships[0].roles
  }
  const legacy = data as GetMeResponse & { tenantRoles?: Role[]; p7Roles?: Role[] }
  if (legacy.tenantRoles?.length) return legacy.tenantRoles
  if (legacy.p7Roles?.length) return legacy.p7Roles
  return undefined
}

/**
 * Hydrates auth + RBAC from GET /auth/me after tokens are set, then optionally
 * requests post-login navigation. Redirect decisions use only the /me profile.
 */
async function establishAuthenticatedSession(
  setUser: (user: User) => void,
  options?: { navigate?: boolean; preserveOrderingContext?: boolean },
): Promise<{ user: User; p7Roles?: Role[] }> {
  const data = await authService.getMe()
  if (!data.user.accountType) {
    throw new Error('Authenticated profile is missing accountType')
  }
  const p7Roles = tenantRolesForPostLoginRedirect(data)
  applyPlatformRoleFromSession(null)
  setUser(data.user)
  seedAuthSessionMemberships({
    memberships: data.memberships,
    activeMembership: data.activeMembership,
    p7Roles,
  })
  // Seed RBAC against the new session's active membership only — never against
  // a leftover useTenantStore.tenant from a previous account (auth boundary).
  const seedTenantId = data.activeMembership?.tenantId
  if (seedTenantId && !options?.preserveOrderingContext) {
    seedTenantSession(seedTenantId, {
      memberships: data.memberships,
      activeMembership: data.activeMembership,
      p7Roles,
    })
  }
  if (options?.navigate !== false) {
    dispatchPostLoginRedirect(data.user, p7Roles)
  }
  // Guest cart lines from localStorage may be flat/order-shaped — normalize after auth.
  useCartStore.getState().reconcileItems()
  return { user: data.user, p7Roles }
}

/**
 * Full login transition: credentials → token persistence → session hydration →
 * redirect with mount confirmation. Used by the login page transition UI.
 * Does not treat HTTP 200 as completed login until redirect succeeds.
 */
export async function performAuthenticatedLoginFlow(
  creds: LoginCredentials,
  router: { replace: (path: string) => void },
  onPhase: (phase: AuthTransitionPhase) => void,
): Promise<void> {
  const setUser = useAuthStore.getState().setUser

  onPhase('authenticating')
  await authService.login(creds)

  onPhase('storing_session')
  if (!getAccessToken()) {
    throw new Error('token_storage_failed')
  }

  onPhase('loading_user')
  const { user, p7Roles } = await establishAuthenticatedSession(setUser, { navigate: false })
  if (!user?.accountType) {
    throw new Error('session_hydration_failed')
  }

  onPhase('redirecting')
  const path = resolvePostAuthDestination(user.accountType, p7Roles)
  await redirectAndAwaitMount(router, path)

  onPhase('authenticated')
}

/**
 * `navigate: false` hydrates the session in place (checkout AuthModal).
 * `preserveOrderingContext: true` skips swapping the current tenant/branch
 * from GET /auth/me active membership so checkout cart context stays put.
 */
export type AuthSessionHookOptions = {
  navigate?: boolean
  preserveOrderingContext?: boolean
}

export function useLogin(options?: AuthSessionHookOptions) {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = options?.navigate !== false
  const preserveOrderingContext = options?.preserveOrderingContext === true
  return useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      await authService.login(creds)
      await establishAuthenticatedSession(setUser, { navigate, preserveOrderingContext })
    },
  })
}


// P10.9 — mirrors useLogin()/useVerifyOTP(): hydrates the authenticated
// user and, if present, tenantRoles after a successful registration.
export function useRegister(options?: AuthSessionHookOptions) {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = options?.navigate !== false
  const preserveOrderingContext = options?.preserveOrderingContext === true
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: async () => {
      await establishAuthenticatedSession(setUser, { navigate, preserveOrderingContext })
    },
  })
}

/** P8.9.2 — Send OTP to a phone_number number. */
export function useSendOTP() {
  return useMutation({
    mutationFn: (payload: SendOTPRequest) =>
      authService.sendOTP(payload),
  })
}

/**
 * P8.9.2 — Verify OTP and complete phone_number login / registration.
 * P10.8 — split into two completely different outcomes per the backend
 * contract:
 *   is_new_user: true  — registration is NOT complete. No session is
 *     initialized here (no setUser, no RBAC hydration) — the caller
 *     (VerifyPage) is solely responsible for redirecting to
 *     /complete-profile, which establishes the real session via
 *     useRegister() once the user finishes their profile.
 *   is_new_user: false — a real login. Behaves exactly like
 *     useLogin()/useVerifyOTP() always have: hydrate the authenticated
 *     user and, if present, tenantRoles.
 */
export function useVerifyOTP(options?: AuthSessionHookOptions) {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = options?.navigate !== false
  const preserveOrderingContext = options?.preserveOrderingContext === true
  return useMutation({
    mutationFn: (payload: VerifyOTPRequest) => authService.verifyOTP(payload),
    onSuccess: async (result) => {
      if (result.is_new_user) return
      await establishAuthenticatedSession(setUser, { navigate, preserveOrderingContext })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Full auth-boundary teardown (tenant/slug/workspace/branches/RBAC/cache).
      // Cart intentionally survives — cleared only on order success or explicit clear.
      clearAuthenticatedClientState({ queryClient: qc })
    },
  })
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe(),
    staleTime: STALE_TIME,
    retry: false,
  })
}

// ── Menu Hooks ────────────────────────────────────────────────────────────────
// Menus are branch-scoped: every hook here requires a canonical branch id before
// it will fetch anything. Callers that already know which branch they're
// rendering (e.g. a `[tenantSlug]/[branchSlug]` route) should pass it
// explicitly; callers with no route-level branch context fall back to the
// customer's currently active branch in useBranchStore (never the URL slug).
export function useActiveBranchId(): string | undefined {
  return useBranchStore((s) => s.selectedBranch?.id ?? s.activeBranch?.id)
}

export function useCategories(branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['categories', tenantId, scopedBranchId],
    queryFn: () => menuService.getCategories(scopedBranchId!),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useAvailableMenuTags(branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['available-menu-tags', tenantId, scopedBranchId],
    queryFn: () => menuService.getAvailableTags(scopedBranchId!),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useConsoleCategories(branchId?: string) {
  const tenantId = useConsoleTenantId()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['console-categories', tenantId, scopedBranchId],
    queryFn: () => menuService.getConsoleCategories(scopedBranchId!),
    enabled: Boolean(tenantId) && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useExtraGroups(branchId?: string, options?: { enabled?: boolean }) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['extra-groups', tenantId, scopedBranchId],
    queryFn: () => menuService.getExtraGroups(scopedBranchId!),
    enabled: enabled && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

/** Customer-facing branch extras (menu PDP / cart). */
export function useMenuExtras(branchId?: string, options?: { enabled?: boolean }) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['menu-extras', tenantId, scopedBranchId],
    queryFn: () => menuService.getExtras(scopedBranchId!),
    enabled: enabled && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useConsoleExtraGroups(branchId?: string) {
  // const tenantId = useTenantStore((s) => s.tenant?.id) #-ch001
  const tenantId = useConsoleTenantId()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['console-extra-groups', tenantId, scopedBranchId],
    queryFn: () => menuService.getConsoleExtraGroups(scopedBranchId!),
    enabled: Boolean(tenantId) && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  }) // #+ch001 #+ch001 #+ch001
}

export function useConsoleExtras(branchId?: string, groupId?: string) {
  const tenantId = useConsoleTenantId()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['console-extras', tenantId, scopedBranchId, groupId],
    queryFn: () => menuService.getExtras(scopedBranchId!, groupId),
    enabled: Boolean(tenantId) && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useExtras(branchId?: string, groupId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['extras', tenantId, scopedBranchId, groupId],
    queryFn: () => menuService.getExtras(scopedBranchId!, groupId),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useMenuItems(branchId?: string, filters?: MenuFilters) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['menu-items', tenantId, scopedBranchId, filters],
    queryFn: () => menuService.getItems(scopedBranchId!, filters),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
  })
}

export function useConsoleMenuItems(branchId?: string, params?: ConsoleMenuItemsParams) {
  const tenantId = useConsoleTenantId()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId

  const queryParams = useMemo(() => {
    const listParams = params ?? {}
    return { ...listParams, ...buildDrfPaginationParams(listParams) }
  }, [params?.page, params?.page_size])

  const pagination = useMemo(
    () => buildDrfPaginationParams(params),
    [params?.page, params?.page_size],
  )

  const query = useQuery({
    queryKey: ['console-menu-items', tenantId, scopedBranchId, queryParams],
    queryFn: () => menuService.getConsoleItems(scopedBranchId!, params),
    enabled: Boolean(tenantId) && !!scopedBranchId,
  })

  return {
    ...query,
    pagination,
  }
}

export function useMenuItem(branchId: string | undefined, id: string) {
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['menu-item', scopedBranchId, id],
    queryFn: () => menuService.getItem(scopedBranchId!, id),
    staleTime: STALE_TIME,
    enabled: !!scopedBranchId && !!id,
  })
}

export function useConsoleMenuItem(branchId: string | undefined, id: string) {
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['console-menu-item', scopedBranchId, id],
    queryFn: () => menuService.getConsoleItem(scopedBranchId!),
    staleTime: STALE_TIME,
    enabled: !!scopedBranchId && !!id,
  })
}

export function useFeaturedItems(branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['featured-items', tenantId, scopedBranchId],
    queryFn: () => menuService.getFeatured(scopedBranchId!),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
  })
}

export function usePopularItems(branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['popular-items', tenantId, scopedBranchId],
    queryFn: () => menuService.getPopular(scopedBranchId!),
    enabled: !!scopedBranchId,
    staleTime: STALE_TIME,
  })
}

export function useRelatedItems(
  branchId: string | undefined,
  id: string,
  options?: { enabled?: boolean },
) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['related-items', tenantId, scopedBranchId, id],
    queryFn: () => menuService.getRelated(scopedBranchId!, id),
    staleTime: STALE_TIME,
    enabled: enabled && !!scopedBranchId && !!id,
  })
}

export function useMenuSearch(query: string, branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['menu-search', tenantId, scopedBranchId, query],
    queryFn: () => menuService.search(scopedBranchId!, query),
    enabled: !!scopedBranchId && query.length >= 2,
    staleTime: 30_000,
  })
}

// ── Order Hooks ───────────────────────────────────────────────────────────────
export function useOrders() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => orderService.getOrders(),
    staleTime: 30_000,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', 'public', id],
    queryFn: () => orderService.getOrder(id),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

/** Console order detail — tenant-scoped via activeMembership. */
export function useConsoleOrder(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['order', tenantId, id],
    queryFn: () => orderService.getOrder(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => orderService.createOrder(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      invalidatePendingOrdersCountQueries(qc)
    },
  })
}

export function useValidateDiscount() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      orderService.validateDiscountCode(code, subtotal),
  })
}

// P4.3 — Review hooks
export function useItemReviews(itemId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['reviews', itemId],
    queryFn: () => reviewService.getItemReviews(itemId),
    enabled: enabled && Boolean(itemId),
    staleTime: STALE_TIME,
  })
}

export function useCreateReview(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => reviewService.createReview(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', itemId] })
    },
  })
}

// P4.1 — Payment hooks
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (payload: CreatePaymentIntentPayload) =>
      paymentService.createPaymentIntent(payload),
  })
}

// ── Branch Hooks (public) ─────────────────────────────────────────────────────
/**
 * Phase Z.1 — routes through branchService.getTenantBranches(tenantId)
 * once a tenant has resolved, so the intent at this call site is
 * unambiguous ("this tenant's branches," never "every branch"). Before
 * the tenant resolves, this still falls back to the untargeted
 * getBranches() exactly as before — that bootstrap-timing behavior is
 * unchanged (and covered by context-integrity.test.ts), not something
 * this phase redesigns.
 */
export function useBranches() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['storefront-branches', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return []
      }
      const entities = await branchManagementService.getTenantsBranches(tenantId)
      const { branchEntityToLocation } = await import('@/lib/branch-adapters')
      return entities.map(branchEntityToLocation)
    },
    staleTime: CACHE_TIME,
  })
}

export function useTenantsBranches() {
  const tenantId = useTenantStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['branches', tenantId],

    queryFn: () =>
      tenantId
        ? branchManagementService.getTenantsBranches(tenantId)
        : Promise.resolve([]),

    enabled: !!tenantId,

    staleTime: CACHE_TIME,
  })
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchService.getBranch(id),
    enabled: !!id,
    staleTime: CACHE_TIME,
  })
}

// ── Branch Resolution (Phase 3) ────────────────────────────────────────────────

/**
 * The single allowlist of admin query-key prefixes that are branch-scoped
 * and must be invalidated on every branch switch. Shared between
 * AdminBranchSwitcher's invalidation call and every branch-scoped hook
 * below, so there is exactly one list to keep in sync rather than a
 * hardcoded set duplicated at each call site.
 *
 * Phase 3.2 audit — every entry here was verified against its actual
 * `queryKey`/`queryFn`, not assumed from its name:
 *   - `branch-orders`/`branch-reservations` (useBranchOrders/
 *     useBranchReservations): queryKey is `[name, branchId]` — genuinely
 *     branch-scoped.
 *   - `branch-analytics` (useBranchAnalytics): queryKey is
 *     `['branch-analytics', branchId]` — genuinely branch-scoped.
 *   - `kitchen-status` (useKitchenStatus): queryKey is
 *     `['kitchen-status', tenantId, branchId]` — genuinely branch-scoped.
 *   - `operations-dashboard`/`live-orders`/`live-reservations`
 *     (useOperationsDashboard/useLiveOrders/useLiveReservations): queryKey
 *     is `[name, scope.tenantId, scope.branchId]` — genuinely branch-scoped.
 *
 * Removed (Phase 3.2) — verified NOT branch-scoped, so invalidating them
 * on a branch switch was refetching identical, unchanged data:
 *   - `admin-orders`/`admin-reservations`/`admin-customers`/`admin-stats`
 *     (the four admin list/summary hooks further below in this file):
 *     queryKey is `[name, tenantId, filters?]` — tenant-scoped only, no
 *     `branchId` anywhere in the key or in the underlying service call.
 *   - `analytics-summary`/`analytics-revenue`/`analytics-reservations`
 *     (the corresponding analytics summary hooks further below):
 *     queryKey is `[name, tenantId]` — tenant-scoped only; the underlying
 *     `analyticsService` calls take no branch parameter at all.
 *   - `admin-branches` (useAdminBranches) is deliberately EXCLUDED: its
 *     queryKey is `['admin-branches', tenantId]` — it lists every branch
 *     of the tenant, not one branch's data, so it must not be invalidated
 *     on a branch switch (it hasn't changed).
 *
 * Added (Phase X.3 — Console context stabilization audit, finding B6) —
 * verified branch-scoped but previously missing from this list, so they
 * only refreshed once `staleTime` elapsed rather than immediately on
 * switch:
 *   - `admin-branch`/`admin-branch-metrics` (useAdminBranch/
 *     useAdminBranchMetrics): queryKey is `[name, id]` where `id` IS the
 *     branchId.
 *   - `branch-status`/`staff-presence`/`sla-alerts`/`realtime-statistics`/
 *     `operations-stream` (the P7.7 realtime-operations hooks further
 *     below): queryKey is `[name, scope.tenantId, scope.branchId, ...]`.
 *     `invalidateQueries({ queryKey: [key] })` matches by prefix, so the
 *     trailing `limit` param on `operations-stream` doesn't prevent this.
 *
 * If a future backend adds branch-level scoping to any of the Removed
 * entries above, add the corresponding hook's `branchId` to its own
 * queryKey FIRST, then re-add its key here — never the reverse.
 */
export const BRANCH_SCOPED_QUERY_KEYS = [
  'admin-customers',
  'branch-orders',
  'branch-reservations',
  'branch-analytics',
  'kitchen-status',
  'operations-dashboard',
  'live-orders',
  'live-reservations',
  'admin-branch',
  'admin-branch-metrics',
  'branch-status',
  'staff-presence',
  'sla-alerts',
  'realtime-statistics',
  'operations-stream',
  'pending-orders-count',
  'pending-reservations-count',
] as const

/** Current admin branch-resolution state (BranchResolutionState) — see types/branch.ts. */
export function useBranchState(): BranchResolutionState {
  return useBranchStore((s) => s.branchState)
}

/** The resolved, valid admin branch, or null. Only meaningful when useBranchState() === 'ready'. */
export function useSelectedBranch() {
  return useBranchStore((s) => s.selectedBranch)
}

/**
 * Guard for branch-scoped hooks/pages: true only once a valid branch is
 * selected (`branchState === 'ready'`). Hooks that must never fire with an
 * undefined/null branchId should gate their `enabled` on this (or on
 * `branchState === 'ready'` directly) rather than only checking
 * `!!branchId`, since a stale/persisted-but-unvalidated id must never
 * reach a query key.
 */
export function useIsBranchReady(): boolean {
  return useBranchStore((s) => s.branchState === 'ready' && s.selectedBranch !== null)
}

/**
 * Phase 3.2 — explicit retry for `branchState === 'error'`. There is no
 * automatic retry anywhere (BranchResolutionBootstrapper only re-runs on
 * a tenant change, not on a timer or on mount) — this is the one way out
 * of the error state within a session, and it must be triggered by an
 * explicit user action (e.g. a "Retry" button), never called on its own.
 * Calls loadBranchesForTenant() again for the current tenant; nothing
 * else changes.
 */
export function useRetryLoadBranches(): () => void {
  const tenantId = useConsoleTenantId()
  const loadBranchesForTenant = useBranchStore((s) => s.loadBranchesForTenant)
  const loadBranchesFromMembership = useBranchStore((s) => s.loadBranchesFromMembership)
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  return () => {
    if (!tenantId) return
    const membership = sessionMemberships?.find((m) => m.tenantId === tenantId)
    if (hasMembershipBranches(membership)) {
      void loadBranchesFromMembership(tenantId, membership.branches)
    } else {
      void loadBranchesForTenant(tenantId)
    }
  }
}

// ── Branch Management Hooks (P7.3) ────────────────────────────────────────────

/**
 * Phase 2 — tenant access is no longer decided client-side (see
 * ownership-resolution.service.ts removal). The backend is the sole
 * authority on which tenants/branches a request may see; this hook just
 * asks for `tenantId`'s branches and returns whatever comes back.
 *
 * Phase 3 note: this remains a plain fetch hook for pages that manage the
 * branch LIST itself (e.g. /console/branches). It is NOT the source of
 * `selectedBranch`/`branchState` — those live in useBranchStore, populated
 * once per tenant by BranchResolutionBootstrapper (providers/index.tsx),
 * not by this hook.
 */
export function useAdminBranches(tenantId: string) {
  return useQuery({
    queryKey: ['admin-branches', tenantId],
    queryFn: () => branchManagementService.getTenantsBranches(tenantId),
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  })
}

export function useAdminBranch(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['admin-branch', tenantId, id],
    queryFn: () => branchManagementService.getBranch(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useAdminBranchMetrics(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['admin-branch-metrics', tenantId, id],
    queryFn: () => branchManagementService.getBranchMetrics(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: 30_000,
  })
}

export function useConsoleAdminBranchMetrics(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['console-admin-branch-metrics', tenantId, id],
    queryFn: () => branchManagementService.getConsoleBranchMetrics(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: 30_000,
  })
}

export function useCreateBranch(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BranchWriteRequest) =>
      branchManagementService.createBranch(tenantId, payload),
    onSuccess: (branch) => {
      synchronizeBranchMutation(qc, tenantId, branch)
    },
  })
}

export function useConsoleCreateBranch(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BranchCreateRequest) =>
      branchManagementService.consoleCreateBranch(tenantId, payload),
    retry: 0,
    onSuccess: (branch) => {
      synchronizeBranchMutation(qc, tenantId, branch)
    },
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BranchWriteRequest }) =>
      branchManagementService.updateBranch(id, tenantId, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', tenantId, id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', tenantId, id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', tenantId, id], {
          ...snapshot,
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.location && {
            location: {
              ...snapshot.location,
              ...payload.location,
              latitude: payload.location.latitude ?? snapshot.location.latitude,
              longitude: payload.location.longitude ?? snapshot.location.longitude,
            },
          }),
          ...(payload.contact && { contact: { ...snapshot.contact, ...payload.contact } }),
          ...(payload.managerId !== undefined && { managerId: payload.managerId }),
          ...(payload.businessHours && { businessHours: payload.businessHours }),
          ...(payload.checkout && {
            checkout: mergeBranchCheckout(snapshot.checkout, payload.checkout),
          }),
          ...(payload.description !== undefined && { description: payload.description }),
          ...(payload.marketplaceVisible !== undefined && { marketplaceVisible: payload.marketplaceVisible }),
          ...(payload.reservationsEnabled !== undefined && { reservationsEnabled: payload.reservationsEnabled }),
          ...(payload.maxCapacity !== undefined && { maxCapacity: payload.maxCapacity }),
          ...(payload.timeZone !== undefined && { timeZone: payload.timeZone }),
          ...(payload.currency !== undefined && { currency: payload.currency }),
          ...(payload.language !== undefined && { language: payload.language }),
          ...(payload.cuisines !== undefined && { cuisines: payload.cuisines }),
          ...(payload.amenities !== undefined && { amenities: payload.amenities }),
          ...(payload.type !== undefined && { type: payload.type }),
          ...(payload.isDefault !== undefined && { isDefault: payload.isDefault }),
        })
      }
      return { snapshot }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', tenantId, id], ctx.snapshot)
    },
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

export function useActivateBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => branchManagementService.activateBranch(id, tenantId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', tenantId, id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', tenantId, id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', tenantId, id], { ...snapshot, status: 'active' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', tenantId, id], ctx.snapshot)
    },
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

export function useDeactivateBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => branchManagementService.deactivateBranch(id, tenantId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', tenantId, id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', tenantId, id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', tenantId, id], { ...snapshot, status: 'inactive' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', tenantId, id], ctx.snapshot)
    },
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

export function useMaintenanceBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => branchManagementService.setMaintenanceMode(id, tenantId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', tenantId, id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', tenantId, id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', tenantId, id], { ...snapshot, status: 'maintenance' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', tenantId, id], ctx.snapshot)
    },
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

export function useAssignBranchManager() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignManagerPayload }) =>
      branchManagementService.assignManager(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', tenantId, id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', tenantId, id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', tenantId, id], {
          ...snapshot,
          managerId: payload.managerId,
        })
      }
      return { snapshot }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', tenantId, id], ctx.snapshot)
    },
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => branchManagementService.deleteBranch(id, tenantId),
    onSuccess: (_void, id) => {
      synchronizeBranchDeleted(qc, tenantId, id)
    },
  })
}

export function useConsoleDeleteBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (branch_id: string) => branchManagementService.consoleDeleteBranch(branch_id, tenantId),
    onSuccess: (_void, branch_id) => {
      synchronizeBranchDeleted(qc, tenantId, branch_id)
    },
  })
}

export function useSetDefaultBranch() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => branchManagementService.setDefaultBranch(id, tenantId),
    onSuccess: (data) => {
      synchronizeBranchMutation(qc, tenantId, data)
    },
  })
}

// ── Reservation Hooks ─────────────────────────────────────────────────────────
export function useReservations() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['reservations', tenantId],
    queryFn: () => reservationService.getReservations(),
    staleTime: STALE_TIME,
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReservationPayload) => reservationService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      invalidatePendingReservationsCountQueries(qc)
    },
  })
}

export function useAvailableSlots(date: string, branchId: string) {
  return useQuery({
    queryKey: ['available-slots', date, branchId],
    queryFn: () => reservationService.getAvailableSlots(date, branchId),
    enabled: !!date && !!branchId,
    staleTime: 60_000,
  })
}

// ── Health Check Hook — P4.9.6 ────────────────────────────────────────────────

export interface HealthPayload {
  status: 'ok' | string
  version?: string
  environment?: string
  timestamp?: string
  uptime?: number
  memory?: { rss: number; heapUsed: number; heapTotal: number }
}

/**
 * Lightweight hook that fetches /api/health for optional dashboard indicators.
 * Caches for 30 s; retries disabled; background refetch disabled.
 * Safe to mount in non-critical paths — never blocks rendering.
 */
export function useHealthCheck() {
  return useQuery<HealthPayload>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
      return res.json() as Promise<HealthPayload>
    },
    staleTime: 30_000,
    gcTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

// ── Email Verification Hooks ─────────────────────────────────────────────────
// Deliberately separate from any profile-update mutation — email verification
// owns its own request/confirm lifecycle and never shares a payload with
// userService.updateProfile().
export function useRequestEmailVerification() {
  return useMutation({
    mutationFn: (email: string) => authService.requestEmailVerification({ email }),
  })
}

function trimmedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

/** Merge confirmed email onto the in-memory auth user without replacing the User shape. */
function applyConfirmedEmailToAuthUser(email: string, queryClient: QueryClient) {
  const current = useAuthStore.getState().user
  if (!current) return
  const next: User = { ...current, email }
  useAuthStore.getState().setUser(next)
  const cached = queryClient.getQueryData<GetMeResponse>(['me'])
  if (cached?.user) {
    queryClient.setQueryData<GetMeResponse>(['me'], { ...cached, user: { ...cached.user, email } })
  }
}

export function useConfirmEmailVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authService.confirmEmailVerification({ email, code }),
    // Settings derives "confirmed" from user.email (not is_verified). Apply the
    // confirm payload's email immediately, then optionally refresh GET /auth/me.
    // A /me failure must not fail the mutation: OTP confirm already succeeded.
    onSuccess: async (confirmed) => {
      const confirmedEmail = trimmedEmail(confirmed?.email)
      if (confirmedEmail) {
        applyConfirmedEmailToAuthUser(confirmedEmail, qc)
      }

      try {
        const fresh = await authService.getMe()
        const current = useAuthStore.getState().user
        const meEmail = trimmedEmail(fresh.user.email)
        const email = meEmail ?? confirmedEmail ?? current?.email ?? fresh.user.email
        const syncedUser: User = { ...fresh.user, email }
        useAuthStore.getState().setUser(syncedUser)
        qc.setQueryData<GetMeResponse>(['me'], { ...fresh, user: syncedUser })
      } catch {
        // Confirm already succeeded; keep the local email merge.
      }
    },
  })
}

// ── Address Hooks ─────────────────────────────────────────────────────────────
export {
  addressKeys,
  useAddressList,
  useInfiniteAddresses,
  useAddresses,
  useAddress,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useRestoreAddress,
  useSetDefaultAddress,
  useAddressSuggestions,
  useReverseGeocode,
  useCheckServiceability,
  AddressProfileIncompleteError,
} from './address'
export { useAddressOwnerProfile } from './useAddressOwnerProfile'

export {
  favoritesKeys,
  prefetchFavoritesList,
  useFavoritesList,
  useFavoritesQuery,
  useFavoritesSync,
  useAddFavorite,
  useRemoveFavorite,
  useIsFavorite,
  useFavoriteAction,
  useRefreshFavorites,
  type UseFavoritesListResult,
}

// P4.8 — Locale switching with server-side re-render trigger
export function useSetLocale() {
  const { setLocale } = useLangStore()
  const router = useRouter()
  return (locale: string) => {
    setLocale(locale)
    router.refresh()
  }
}

// P6.13 — Analytics hooks
export function useAnalyticsSummary() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-summary', tenantId],
    queryFn: () => analyticsService.getAnalyticsSummary(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useRevenueAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-revenue', tenantId],
    queryFn: () => analyticsService.getRevenueAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useReservationAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-reservations', tenantId],
    queryFn: () => analyticsService.getReservationAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useLoyaltyAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-loyalty', tenantId],
    queryFn: () => analyticsService.getLoyaltyAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function usePromotionAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-promotions', tenantId],
    queryFn: () => analyticsService.getPromotionAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useVendorAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-vendors', tenantId],
    queryFn: () => analyticsService.getVendorAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useMenuAnalytics() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['analytics-menu', tenantId],
    queryFn: () => analyticsService.getMenuAnalytics(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

// P6.12 — QR Experience hook
export {
  useTenantQr,
  useBranchQr,
  useEnableTenantQr,
  useDisableTenantQr,
  useRegenerateTenantQr,
  useSetTenantQrDestination,
  useEnableBranchQr,
  useDisableBranchQr,
  useRegenerateBranchQr,
  useSetBranchQrDestination,
  useMenuQr,
  useReservationQr,
  useEnableMenuQr,
  useDisableMenuQr,
  useRegenerateMenuQr,
  useSetMenuQrDestination,
  useEnableReservationQr,
  useDisableReservationQr,
  useRegenerateReservationQr,
  useSetReservationQrDestination,
} from './qr-management'

export function useQRExperience(businessType?: string) {
  return useQuery({
    queryKey: ['qr-experience', businessType ?? 'default'],
    queryFn: () => qrExperienceService.getQRExperience(businessType),
    staleTime: STALE_TIME,
  })
}

// P4.4 — Table metadata hook
export function useTableInfo(tableId: string | null) {
  return useQuery({
    queryKey: ['table-info', tableId],
    queryFn: () => tableService.getTableInfo(tableId!),
    enabled: !!tableId,
    staleTime: STALE_TIME,
  })
}

// ── Admin Hooks (P5.1) ────────────────────────────────────────────────────────

export function useAdminStats() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['admin-stats', tenantId],
    queryFn: () => adminService.getStats(),
    staleTime: 60_000,
    enabled: Boolean(tenantId),
  })
}

/**
 * Console admin orders — scoped to active tenant + branch by default.
 * Pass `{ scope: 'global' }` for the tenant-wide admin list.
 */
export function useAdminOrders(
  filters: AdminOrderFilters = {},
  options: { scope?: AdminOrdersScope } = {},
) {
  const scope = options.scope ?? 'scoped'
  const tenantId = useConsoleTenantId()
  const branchId = useConsoleBranchId()
  const scoped = scope === 'scoped'
  return useQuery({
    queryKey: scoped
      ? ['admin-orders', scope, tenantId, branchId, filters]
      : ['admin-orders', scope, tenantId, filters],
    queryFn: () =>
      adminService.getAdminOrders(
        scoped
          ? { scope, tenantId, branchId, filters }
          : { scope, tenantId, filters },
      ),
    staleTime: 30_000,
    enabled: scoped ? !!(tenantId && branchId) : !!tenantId,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: ({ id, status, order }: { id: string; status: OrderStatus; order?: OrderStatusContext }) => {
      if (!tenantId) throw new Error('No tenant')
      return adminService.updateOrderStatus(id, status, tenantId, order)
    },
    onMutate: async ({ id, status, order }) => {
      const resolvedStatus = resolveStatusUpdate(order, status)
      await qc.cancelQueries({ queryKey: ['admin-orders'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<Order>>({ queryKey: ['admin-orders'] })
      qc.setQueriesData<PaginatedResponse<Order>>(
        { queryKey: ['admin-orders'] },
        (old) => old
          ? { ...old, results: old.results.map((o) => o.id === id ? { ...o, status: resolvedStatus } : o) }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (data, { id }) => {
      qc.setQueriesData<PaginatedResponse<Order>>(
        { queryKey: ['admin-orders'] },
        (old) => old
          ? { ...old, results: old.results.map((o) => o.id === id ? { ...o, status: data.status } : o) }
          : old,
      )
      qc.setQueryData<Order>(['order', tenantId, id], (old) => old ? { ...old, status: data.status } : old)
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      invalidatePendingOrdersCountQueries(qc)
      auditLogService.record(
        'ORDER_STATUS_CHANGED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'order', id, displayName: `Order ${id}` },
        { tenantId: tenantId ?? '' },
        { before: null, after: { status: data.status }, changedFields: ['status'] },
      )
    },
  })
}

/** Phase 2 — same scoping approach as useAdminOrders() above. */
export function useAdminReservations(filters: AdminReservationFilters = {}) {
  const tenantId = useConsoleTenantId()
  const scopedFilters = { ...filters, ...(tenantId ? { tenantId } : {}) }
  return useQuery({
    queryKey: ['admin-reservations', tenantId, scopedFilters],
    queryFn: () => adminService.getAdminReservations(scopedFilters),
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}

export function useAdminReservation(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['admin-reservation', tenantId, id],
    queryFn: () => adminService.getAdminReservation(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: 10_000,
  })
}

export function useConfirmReservation() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('No tenant')
      return adminService.confirmReservation(id, tenantId)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-reservations'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<Reservation>>({ queryKey: ['admin-reservations'] })
      qc.setQueriesData<PaginatedResponse<Reservation>>(
        { queryKey: ['admin-reservations'] },
        (old) => old
          ? { ...old, results: old.results.map((r) => r.id === id ? { ...r, status: 'confirmed' as ReservationStatus } : r) }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
      invalidatePendingReservationsCountQueries(qc)
      auditLogService.record(
        'RESERVATION_CONFIRMED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'reservation', id, displayName: `Reservation ${id}` },
        { tenantId: tenantId ?? '' },
        { before: { status: 'pending' }, after: { status: 'confirmed' }, changedFields: ['status'] },
      )
    },
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('No tenant')
      return reservationService.cancelReservation(id, tenantId)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-reservations'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<Reservation>>({ queryKey: ['admin-reservations'] })
      qc.setQueriesData<PaginatedResponse<Reservation>>(
        { queryKey: ['admin-reservations'] },
        (old) => old
          ? { ...old, results: old.results.map((r) => r.id === id ? { ...r, status: 'cancelled' as ReservationStatus } : r) }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
      invalidatePendingReservationsCountQueries(qc)
      auditLogService.record(
        'RESERVATION_CANCELLED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'reservation', id, displayName: `Reservation ${id}` },
        { tenantId: tenantId ?? '' },
        { before: { status: 'confirmed' }, after: { status: 'cancelled' }, changedFields: ['status'] },
      )
    },
  })
}

export function useAdminCustomers(
  filters: AdminCustomerFilters = {},
  options: { scope?: AdminOrdersScope } = {},
) {
  const scope = options.scope ?? 'scoped'
  const tenantId = useConsoleTenantId()
  const branchId = useConsoleBranchId()
  const scoped = scope === 'scoped'
  return useQuery({
    queryKey: scoped
      ? ['admin-customers', scope, tenantId, branchId, filters]
      : ['admin-customers', scope, tenantId, filters],
    queryFn: () =>
      adminService.getCustomers({
        ...filters,
        tenantId: tenantId ?? undefined,
        ...(scoped ? { branchId: branchId ?? undefined } : {}),
      }),
    staleTime: STALE_TIME,
    enabled: scoped ? !!(tenantId && branchId) : !!tenantId,
  })
}

export function useAdminCustomer(id: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['admin-customer', tenantId, id],
    queryFn: () => adminService.getCustomer(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerStats(id: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['admin-customer-stats', tenantId, id],
    queryFn: () => adminService.getCustomerStats(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerReviews(id: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['admin-customer-reviews', tenantId, id],
    queryFn: () => adminService.getCustomerReviews(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

// ── P8.9.6 — BusinessCustomer / BranchCustomer hooks ─────────────────────────

export function useBusinessCustomer(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['business-customer', tenantId, userId],
    queryFn: () => adminService.getBusinessCustomer(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useBranchCustomers(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['branch-customers', tenantId, userId],
    queryFn: () => adminService.getBranchCustomers(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerLoyalty(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-loyalty', tenantId, userId],
    queryFn: () => loyaltyService.getAccount(userId, tenantId ?? undefined),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

// ── P8.9.7 Customer 360° CRM Hooks ───────────────────────────────────────────

export function useCustomerTimeline(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-timeline', tenantId, userId],
    queryFn: () => adminService.getCustomerTimeline(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerNotes(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-notes', tenantId, userId],
    queryFn: () => adminService.getCustomerNotes(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: 0,
  })
}

export function useCreateCustomerNote(userId: string) {
  const tenantId = useConsoleTenantId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, authorId, authorName }: { content: string; authorId: string; authorName: string }) =>
      adminService.createCustomerNote(userId, tenantId ?? '', content, authorId, authorName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useUpdateCustomerNote(userId: string) {
  const tenantId = useConsoleTenantId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      adminService.updateCustomerNote(noteId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useDeleteCustomerNote(userId: string) {
  const tenantId = useConsoleTenantId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => adminService.deleteCustomerNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useCustomerTags(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-tags', tenantId, userId],
    queryFn: () => adminService.getCustomerTags(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useTenantTagDefinitions() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['tenant-tags', tenantId],
    queryFn: () => adminService.getTenantTagDefinitions(tenantId ?? ''),
    enabled: !!tenantId,
    staleTime: CACHE_TIME,
  })
}

export function useUpdateCustomerTags(userId: string) {
  const tenantId = useConsoleTenantId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagIds: string[]) => adminService.updateCustomerTags(userId, tenantId ?? '', tagIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-tags', tenantId, userId] }),
  })
}

export function useCustomerAnalytics(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-analytics', tenantId, userId],
    queryFn: () => adminService.getCustomerAnalytics(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerMarketing(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-marketing', tenantId, userId],
    queryFn: () => adminService.getCustomerMarketing(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerCoupons(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-coupons', tenantId, userId],
    queryFn: () => adminService.getCustomerCoupons(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerPayments(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-payments', tenantId, userId],
    queryFn: () => adminService.getCustomerPayments(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerOrders360(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-orders-360', tenantId, userId],
    queryFn: () => adminService.getCustomerOrders(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerReservations360(userId: string) {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['customer-reservations-360', tenantId, userId],
    queryFn: () => adminService.getCustomerReservations(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

// ── Bulk Operation Hooks (P7.14) ──────────────────────────────────────────────

export function useBulkUpdateOrderStatus() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrderStatus }) => {
      if (!tenantId) throw new Error('No tenant')
      return Promise.all(ids.map((id) => adminService.updateOrderStatus(id, status, tenantId)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      invalidatePendingOrdersCountQueries(qc)
    },
  })
}

export function useBulkCancelOrders() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!tenantId) throw new Error('No tenant')
      return Promise.all(ids.map((id) => adminService.updateOrderStatus(id, 'cancelled', tenantId)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      invalidatePendingOrdersCountQueries(qc)
    },
  })
}

export function useBulkConfirmReservations() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!tenantId) throw new Error('No tenant')
      return Promise.all(ids.map((id) => adminService.confirmReservation(id, tenantId)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
      invalidatePendingReservationsCountQueries(qc)
    },
  })
}

export function useBulkCancelReservations() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!tenantId) throw new Error('No tenant')
      return Promise.all(ids.map((id) => reservationService.cancelReservation(id, tenantId)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
      invalidatePendingReservationsCountQueries(qc)
    },
  })
}

export type CustomerExportRow = Pick<
  ConsoleCustomer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone_number' | 'orders_count' | 'reservations_count'
>

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value)
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

export function useBulkExportCustomers() {
  return useMutation({
    mutationFn: (rows: CustomerExportRow[]) => {
      const header = 'id,first_name,last_name,email,phone_number,orders_count,reservations_count'
      const body = rows.map((row) =>
        [
          csvCell(row.id),
          csvCell(row.first_name),
          csvCell(row.last_name),
          csvCell(row.email),
          csvCell(row.phone_number),
          csvCell(row.orders_count),
          csvCell(row.reservations_count),
        ].join(','),
      )
      const csv = [header, ...body].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-export-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      return Promise.resolve()
    },
  })
}

export function useNotificationPermission() {
  const [permission, setPermission] = React.useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const request = React.useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  return { permission, request }
}

// ── Menu Admin Hooks (P5.1) ───────────────────────────────────────────────────

/** Matches only this branch's cached `menu-items` entries, regardless of which tenantId/filters partitioned them — never touches another branch's cache. */
function menuItemsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'menu-items' && query.queryKey[2] === branchId
}

/** Matches only this branch's cached `console-menu-items` entries. */
function consoleMenuItemsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'console-menu-items' && query.queryKey[2] === branchId
}

function branchMenuItemsQueryPredicates(branchId: string) {
  return [menuItemsQueryPredicate(branchId), consoleMenuItemsQueryPredicate(branchId)]
}

function invalidateBranchMenuItemsQueries(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
) {
  for (const predicate of branchMenuItemsQueryPredicates(branchId)) {
    qc.invalidateQueries({ predicate })
  }
}

async function updateBranchMenuItemsQueries(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
  updater: (old: PaginatedResponse<MenuItem>) => PaginatedResponse<MenuItem>,
) {
  const snapshots: Array<[readonly unknown[], PaginatedResponse<MenuItem> | undefined]> = []
  for (const predicate of branchMenuItemsQueryPredicates(branchId)) {
    await qc.cancelQueries({ predicate })
    const entries = qc.getQueriesData<PaginatedResponse<MenuItem>>({ predicate })
    snapshots.push(...entries)
    qc.setQueriesData<PaginatedResponse<MenuItem>>(
      { predicate },
      (old) => (old ? updater(old) : old),
    )
  }
  return { snapshots }
}

/** Matches this branch's cached category list queries (`categories` + `console-categories`). */
function categoriesQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    (query.queryKey[0] === 'categories' || query.queryKey[0] === 'console-categories') &&
    query.queryKey[2] === branchId
}

// ── Category Admin Hooks ─────────────────────────────────────────────────────
// Same pattern as the Menu Item admin hooks below: branchId is required (no
// store fallback for mutations — the Console always acts on the branch the
// admin has explicitly selected), and invalidation is scoped to that branch's
// cached queries via categoriesQueryPredicate, never a blanket ['categories']
// prefix that would touch every branch's cache.

export function useCreateCategory(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CategoryWriteRequest) => menuService.createCategory(branchId, payload),
    onSuccess: (newCategory) => {
      const predicate = categoriesQueryPredicate(branchId)
      qc.setQueriesData<Category[]>(
        { predicate },
        (old) => {
          if (!old) return [newCategory]
          if (old.some((c) => c.id === newCategory.id)) return old
          return [...old, newCategory]
        },
      )
      qc.invalidateQueries({ predicate })
    },
  })
}

export function useUpdateCategory(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryWriteRequest }) =>
      menuService.updateCategory(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const { image_asset_id: _image, ...optimistic } = payload
      const predicate = categoriesQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Category[]>({ predicate })
      qc.setQueriesData<Category[]>(
        { predicate },
        (old) => old ? old.map((c) => c.id === id ? { ...c, ...optimistic } : c) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useDeleteCategory(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteCategory(branchId, id),
    onMutate: async (id) => {
      const predicate = categoriesQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Category[]>({ predicate })
      qc.setQueriesData<Category[]>(
        { predicate },
        (old) => old ? old.filter((c) => c.id !== id) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useReorderCategories(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => menuService.reorderCategories(branchId, orderedIds),
    onMutate: async (orderedIds) => {
      const predicate = categoriesQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Category[]>({ predicate })
      qc.setQueriesData<Category[]>(
        { predicate },
        (old) => {
          if (!old) return old
          const byId = new Map(old.map((c) => [c.id, c]))
          return orderedIds
            .map((id, index) => {
              const c = byId.get(id)
              return c ? { ...c, sort_order: index + 1 } : undefined
            })
            .filter((c): c is Category => !!c)
        },
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

// ── Tag Admin Hooks ───────────────────────────────────────────────────────────

function consoleMenuTagsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'console-menu-tags' && query.queryKey[2] === branchId
}

function branchTagQueryPredicates(branchId: string) {
  return [
    consoleMenuTagsQueryPredicate(branchId),
    (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === 'available-menu-tags' && query.queryKey[2] === branchId,
  ]
}

function invalidateBranchTagQueries(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
) {
  for (const predicate of branchTagQueryPredicates(branchId)) {
    qc.invalidateQueries({ predicate })
  }
}

export function useConsoleMenuTags(branchId?: string, params?: ConsoleMenuTagsParams) {
  const tenantId = useConsoleTenantId()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId

  const queryParams = useMemo(() => {
    const listParams = params ?? {}
    return { ...listParams, ...buildDrfPaginationParams(listParams) }
  }, [params?.page, params?.page_size, params?.search, params?.ordering, params?.is_active])

  const pagination = useMemo(
    () => buildDrfPaginationParams(params),
    [params?.page, params?.page_size],
  )

  const query = useQuery({
    queryKey: ['console-menu-tags', tenantId, scopedBranchId, queryParams],
    queryFn: () => menuService.getConsoleTags(scopedBranchId!, params),
    enabled: Boolean(tenantId) && !!scopedBranchId,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })

  return { ...query, pagination }
}

/** Alias for console tag list — see `useConsoleMenuTags`. */
export const useMenuTags = useConsoleMenuTags

export function useConsoleMenuTag(branchId: string, id: number | undefined) {
  return useQuery({
    queryKey: ['console-menu-tag', branchId, id],
    queryFn: () => menuService.getConsoleTag(branchId, id!),
    enabled: !!branchId && id != null,
    staleTime: STALE_TIME,
  })
}

/** Alias for single console tag — see `useConsoleMenuTag`. */
export const useMenuTag = useConsoleMenuTag

export function useCreateMenuTag(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TagWriteRequest) => menuService.createTag(branchId, payload),
    onSuccess: () => {
      invalidateBranchTagQueries(qc, branchId)
    },
  })
}

export function useUpdateMenuTag(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TagWriteRequest }) =>
      menuService.updateTag(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const { image_asset_id: _image, ...optimistic } = payload
      const predicate = consoleMenuTagsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<PaginatedResponse<ConsoleMenuTag>>({ predicate })
      qc.setQueriesData<PaginatedResponse<ConsoleMenuTag>>(
        { predicate },
        (old) =>
          old
            ? {
                ...old,
                results: old.results.map((tag) =>
                  tag.id === id ? { ...tag, ...optimistic } : tag,
                ),
              }
            : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchTagQueries(qc, branchId)
    },
  })
}

export function useDeleteMenuTag(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => menuService.deleteTag(branchId, id),
    onMutate: async (id) => {
      const predicate = consoleMenuTagsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<PaginatedResponse<ConsoleMenuTag>>({ predicate })
      qc.setQueriesData<PaginatedResponse<ConsoleMenuTag>>(
        { predicate },
        (old) =>
          old
            ? { ...old, count: Math.max(0, old.count - 1), results: old.results.filter((t) => t.id !== id) }
            : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchTagQueries(qc, branchId)
    },
  })
}

// ── Extra Group Admin Hooks ───────────────────────────────────────────────────
// Same pattern as the Menu Item admin hooks above: branchId required (no store
// fallback for mutations), invalidation scoped to the active branch's cached
// queries via branchExtraGroupsQueryPredicates, optimistic update + rollback on
// read-then-write ops — covers both legacy `extra-groups` and console
// `console-extra-groups` caches.

/** Matches only this branch's cached `extra-groups` entries. */
function extraGroupsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'extra-groups' && query.queryKey[2] === branchId
}

/** Matches only this branch's cached `console-extra-groups` entries. */
function consoleExtraGroupsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'console-extra-groups' && query.queryKey[2] === branchId
}

function branchExtraGroupsQueryPredicates(branchId: string) {
  return [extraGroupsQueryPredicate(branchId), consoleExtraGroupsQueryPredicate(branchId)]
}

function invalidateBranchExtraGroupsQueries(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
) {
  for (const predicate of branchExtraGroupsQueryPredicates(branchId)) {
    qc.invalidateQueries({ predicate })
  }
}

async function updateBranchExtraGroupsQueries(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
  updater: (old: ExtraGroup[]) => ExtraGroup[],
) {
  const snapshots: Array<[readonly unknown[], ExtraGroup[] | undefined]> = []
  for (const predicate of branchExtraGroupsQueryPredicates(branchId)) {
    await qc.cancelQueries({ predicate })
    const entries = qc.getQueriesData<ExtraGroup[]>({ predicate })
    snapshots.push(...entries)
    qc.setQueriesData<ExtraGroup[]>(
      { predicate },
      (old) => (old ? updater(old) : old),
    )
  }
  return { snapshots }
}

/** Matches only this branch's cached `extras` entries, across every group filter. */
function extrasQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'extras' && query.queryKey[2] === branchId
}

export function useCreateExtraGroup(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<ExtraGroup>) => menuService.createExtraGroup(branchId, payload),
    onSuccess: () => {
      invalidateBranchExtraGroupsQueries(qc, branchId)
    },
  })
}

export function useUpdateExtraGroup(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExtraGroup> }) =>
      menuService.updateExtraGroup(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      return updateBranchExtraGroupsQueries(qc, branchId, (old) =>
        old.map((g) => (g.id === id ? { ...g, ...payload } : g)),
      )
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchExtraGroupsQueries(qc, branchId)
    },
  })
}

export function useDeleteExtraGroup(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteExtraGroup(branchId, id),
    onMutate: async (id) => {
      return updateBranchExtraGroupsQueries(qc, branchId, (old) =>
        old.filter((g) => g.id !== id),
      )
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchExtraGroupsQueries(qc, branchId)
      // A deleted group can no longer be assigned to any item — its menu-item
      // assignments/materialized extras may need to be refreshed too.
      invalidateBranchMenuItemsQueries(qc, branchId)
    },
  })
}

export function useReorderExtraGroups(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => menuService.reorderExtraGroups(branchId, orderedIds),
    onMutate: async (orderedIds) => {
      return updateBranchExtraGroupsQueries(qc, branchId, (old) => {
        const byId = new Map(old.map((g) => [g.id, g]))
        return orderedIds
          .map((id, index) => {
            const g = byId.get(id)
            return g ? { ...g, order: index + 1 } : undefined
          })
          .filter((g): g is ExtraGroup => !!g)
      })
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchExtraGroupsQueries(qc, branchId)
    },
  })
}

// ── Extra Admin Hooks ──────────────────────────────────────────────────────────

export function useCreateExtra(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExtraWriteRequest & { group_id: string }) => menuService.createExtra(branchId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extrasQueryPredicate(branchId) })
    },
  })
}

export function useUpdateExtra(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExtraWriteRequest }) =>
      menuService.updateExtra(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const { image_asset_id: _image, ...optimistic } = payload
      const predicate = extrasQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Extra[]>({ predicate })
      qc.setQueriesData<Extra[]>(
        { predicate },
        (old) => old ? old.map((e) => e.id === id ? { ...e, ...optimistic } : e) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extrasQueryPredicate(branchId) })
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
    },
  })
}

export function useDeleteExtra(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteExtra(branchId, id),
    onMutate: async (id) => {
      const predicate = extrasQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Extra[]>({ predicate })
      qc.setQueriesData<Extra[]>(
        { predicate },
        (old) => old ? old.filter((e) => e.id !== id) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extrasQueryPredicate(branchId) })
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
    },
  })
}

/** Attaches/detaches Extra Groups on a menu item from the Menu Item editor. */
export function useAssignExtraGroupsToItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, groupIds }: { itemId: string; groupIds: string[] }) =>
      menuService.assignExtraGroupsToItem(branchId, itemId, groupIds),
    onSuccess: (_data, { itemId }) => {
      invalidateBranchMenuItemsQueries(qc, branchId)
      qc.invalidateQueries({ queryKey: ['menu-item', branchId, itemId] })
    },
  })
}

export function useCreateMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MenuItemWriteRequest) => menuService.createItem(branchId, payload),
    onSuccess: () => {
      // Scoped invalidation: only the active branch's cached menu-items/categories
      // are refetched — other branches' cached queries are left untouched.
      invalidateBranchMenuItemsQueries(qc, branchId)
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useConsoleCreateMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MenuItemWriteRequest) => menuService.consoleCreateItem(branchId, payload),
    onSuccess: () => {
      // Scoped invalidation: only the active branch's cached menu-items/categories
      // are refetched — other branches' cached queries are left untouched.
      invalidateBranchMenuItemsQueries(qc, branchId)
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useUpdateMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MenuItemWriteRequest }) =>
      menuService.updateItem(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const { image_asset_id: _image, ...optimistic } = payload
      return updateBranchMenuItemsQueries(qc, branchId, (old) => ({
        ...old,
        results: old.results.map((i) => (i.id === id ? { ...i, ...optimistic } : i)),
      }))
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_data, { id }) => {
      invalidateBranchMenuItemsQueries(qc, branchId)
      qc.invalidateQueries({ queryKey: ['menu-item', branchId, id] })
    },
  })
}

// ── Vendor Hooks (P6.11) ─────────────────────────────────────────────────────

export function useVendors() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['vendors', tenantId],
    queryFn: () => vendorService.getVendors(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useVendor(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['vendor', tenantId, id],
    queryFn: () => vendorService.getVendor(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (payload: CreateVendorPayload) => vendorService.createVendor(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors', tenantId] }),
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVendorPayload }) => {
      if (!tenantId) throw new Error('No tenant')
      return vendorService.updateVendor(id, tenantId, payload)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendors', tenantId] })
      qc.invalidateQueries({ queryKey: ['vendor', tenantId, id] })
    },
  })
}

export function useDisableVendor() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('No tenant')
      return vendorService.disableVendor(id, tenantId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors', tenantId] }),
  })
}

export function useVendorStats(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['vendor-stats', tenantId, id],
    queryFn: () => vendorService.getVendorStats(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: 60_000,
  })
}

export function useVendorSettlements(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['vendor-settlements', tenantId, id],
    queryFn: () => vendorService.getVendorSettlements(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCreateSettlement() {
  const tenantId = useConsoleTenantId() ?? ''
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSettlementPayload) => vendorService.createSettlement(payload, tenantId),
    onSuccess: (_data, { vendorId }) => {
      qc.invalidateQueries({ queryKey: ['vendor-settlements', tenantId, vendorId] })
      qc.invalidateQueries({ queryKey: ['vendor-stats', tenantId, vendorId] })
    },
  })
}

// ── Promotion Hooks (P6.10) ───────────────────────────────────────────────────

export function usePromotions() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['promotions', tenantId],
    queryFn: () => promotionService.getPromotions(tenantId!),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function usePromotion(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['promotion', tenantId, id],
    queryFn: () => promotionService.getPromotion(id, tenantId),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useActivePromotions() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['active-promotions', tenantId],
    queryFn: () => promotionService.getActivePromotions(tenantId!),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(tenantId),
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (payload: CreatePromotionPayload) => {
      if (!tenantId) throw new Error('No tenant')
      return promotionService.createPromotion(tenantId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', tenantId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', tenantId] })
    },
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePromotionPayload }) => {
      if (!tenantId) throw new Error('No tenant')
      return promotionService.updatePromotion(id, tenantId, payload)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['promotions', tenantId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', tenantId] })
      qc.invalidateQueries({ queryKey: ['promotion', tenantId, id] })
    },
  })
}

export function useDisablePromotion() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('No tenant')
      return promotionService.disablePromotion(id, tenantId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', tenantId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', tenantId] })
    },
  })
}

export function useActivatePromotion() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('No tenant')
      return promotionService.activatePromotion(id, tenantId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', tenantId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', tenantId] })
    },
  })
}

// ── Loyalty Hooks (P6.9) ──────────────────────────────────────────────────────

export function useLoyaltyAccount() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['loyalty-account', tenantId],
    queryFn: () => loyaltyService.getAccount(),
    staleTime: 30_000,
  })
}

export function useLoyaltyTransactions() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['loyalty-transactions', tenantId],
    queryFn: () => loyaltyService.getTransactions(),
    staleTime: 30_000,
  })
}

export function useLoyaltyRewards() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['loyalty-rewards', tenantId],
    queryFn: () => loyaltyService.getRewards(),
    staleTime: STALE_TIME,
  })
}

export function useRedeemReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rewardId: string) => loyaltyService.redeemReward(rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-account'] })
      qc.invalidateQueries({ queryKey: ['loyalty-transactions'] })
    },
  })
}

export function useEarnPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: EarnPointsPayload) => loyaltyService.earnPoints(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-account'] })
      qc.invalidateQueries({ queryKey: ['loyalty-transactions'] })
    },
  })
}

export function useAdminLoyaltyRewards() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['admin-loyalty-rewards', tenantId],
    queryFn: () => loyaltyService.adminGetRewards(),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useAdminCreateReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<LoyaltyReward, 'id' | 'created_at'>) =>
      loyaltyService.adminCreateReward(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards'] }),
  })
}

export function useAdminUpdateReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<LoyaltyReward, 'id' | 'created_at'>> }) =>
      loyaltyService.adminUpdateReward(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards'] }),
  })
}

export function useAdminDisableReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => loyaltyService.adminDisableReward(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards'] }),
  })
}

// ── Menu Admin Hooks (P5.1) ───────────────────────────────────────────────────

export function useDeleteMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteItem(branchId, id),
    onMutate: async (id) => {
      return updateBranchMenuItemsQueries(qc, branchId, (old) => ({
        ...old,
        results: old.results.filter((i) => i.id !== id),
        count: old.count - 1,
      }))
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      invalidateBranchMenuItemsQueries(qc, branchId)
    },
  })
}

// ── Tenant Provisioning Hooks (P6.14) ────────────────────────────────────────

export function useTenantTemplates() {
  return useQuery({
    queryKey: ['tenant-templates'],
    queryFn: () => Promise.resolve(tenantProvisioningService.getTemplates()),
    staleTime: Infinity,
  })
}

export function useProvisionTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: Parameters<typeof tenantProvisioningService.provisionTenant>[0]) =>
      tenantProvisioningService.provisionTenant(req),
    onSuccess: async (result) => {
      if (!result.success) return
      await synchronizeTenantMutation(qc, result.tenant, {
        session: true,
        templates: true,
        discover: true,
        publicTenants: true,
      })
    },
  })
}

export function useCloneTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      sourceTenantId,
      newSlug,
      newName,
    }: {
      sourceTenantId: string
      newSlug: string
      newName: string
    }) => tenantProvisioningService.cloneTenant(sourceTenantId, newSlug, newName),
    onSuccess: async (result) => {
      if (!result.success) return
      await synchronizeTenantMutation(qc, result.tenant, {
        session: true,
        templates: true,
        discover: true,
        publicTenants: true,
      })
    },
  })
}

export function useUpdateTenantSettings(explicitTenantId?: string) {
  const qc = useQueryClient()
  const workspaceTenantId = useConsoleTenantId()
  const tenantId = explicitTenantId || workspaceTenantId
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => {
      if (!tenantId) throw new Error('No tenant')
      return tenantService.updateTenantSettings(tenantId, patch)
    },
    onSuccess: async (updated) => {
      await synchronizeTenantMutation(qc, updated, {
        featureFlags: true,
        discover: true,
        publicTenants: true,
      })
    },
  })
}

export function useUpdateTenantMedia(explicitTenantId?: string) {
  const qc = useQueryClient()
  const workspaceTenantId = useConsoleTenantId()
  const tenantId = explicitTenantId || workspaceTenantId
  return useMutation({
    mutationFn: (payload: import('@/lib/tenant-media').TenantMediaWriteRequest) => {
      if (!tenantId) throw new Error('No tenant')
      return tenantService.updateTenantMedia(tenantId, payload)
    },
    onSuccess: async (updated) => {
      await synchronizeTenantMutation(qc, updated, {
        discover: true,
        publicTenants: true,
      })
    },
  })
}

// ── Tenant Management Hooks (P6.15) ──────────────────────────────────────────

export function useTenants() {
  const canView = usePermission('tenant.view')
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.getTenants(),
    staleTime: STALE_TIME,
    enabled: canView,
  })
}

/**
 * Tenants associated with the current user (GET /tenants/me/), including
 * INACTIVE. Not the public discover list and not "every platform tenant."
 */
export function useMyTenants() {
  const canView = usePermission('tenant.view')
  return useQuery({
    queryKey: ['console-tenants'],
    queryFn: () => tenantService.getMyTenants(),
    staleTime: STALE_TIME,
    enabled: canView,
  })
}

/**
 * Phase Z.1 — "all platform tenants." Use this at any call site that
 * genuinely means every tenant on the platform (e.g. /console/tenants'
 * tenant-administration table) — never "tenants I belong to."
 */
export function usePlatformTenants() {
  const canView = usePermission('tenant.view')
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.getPlatformTenants(),
    staleTime: STALE_TIME,
    enabled: canView,
  })
}

/** Console tenant administration list — ACTIVE, INACTIVE, and CLOSED. */
export function useConsoleTenants() {
  const canView = usePermission('tenant.view')
  return useQuery({
    queryKey: ['console-platform-tenants'],
    queryFn: () => tenantService.getConsolePlatformTenants(),
    staleTime: STALE_TIME,
    enabled: canView,
  })
}

/**
 * P8.7.7.1 — Public marketplace discovery hook.
 * Returns tenants visible in the public /discover page (`is_active`).
 * No RBAC guard — this is explicitly public data for business discovery.
 * Uses a separate query key so it never collides with the admin useTenants().
 */
export function usePublicTenants() {
  return useQuery({
    queryKey: PUBLIC_TENANTS_QUERY_KEY,
    queryFn: () => tenantService.getTenants(),
    staleTime: STALE_TIME,
    select: (tenants) =>
      tenants.filter((t) => t.slug !== 'default' && t.is_active === true),
  })
}

/** Public discover marketplace — single consolidated tenant + branch payload. */
export function useDiscover() {
  return useQuery<DiscoverItem[]>({
    queryKey: ['public-discover'],
    queryFn: async () => {
      const response = await discoverService.getDiscover()
      return adaptDiscoverResponse(response)
    },
    staleTime: STALE_TIME,
  })
}

/**
 * Fetches a single public tenant by slug. Returns null for an unknown slug
 * (mistyped public URL — not a query error/toast). Forbidden is not mapped to
 * null so inactive/inaccessible tenants stay distinct from not-found.
 */
export function usePublicTenant(slug: string, options?: { initialData?: Tenant }) {
  return useQuery({
    queryKey: ['public-tenant', slug],
    queryFn: async () => {
      try {
        return await fetchPublicTenantBySlug(slug)
      } catch (err) {
        if (err instanceof TenantNotFoundError) return null
        throw err
      }
    },
    initialData: options?.initialData,
    staleTime: STALE_TIME,
    enabled: !!slug,
  })
}

/** Fetches canonical public branch detail by tenant id + branch id. */
export function usePublicBranch(
  tenantId: string,
  branchId: string,
  options?: {
    marketplaceBranch?: PublicBranchInfo
    initialData?: PublicBranchInfo
  },
) {
  return useQuery<PublicBranchInfo | null>({
    queryKey: ['public-branch', tenantId, branchId],
    queryFn: async (): Promise<PublicBranchInfo | null> => {
      const detail = await branchManagementService.getPublicBranch(tenantId, branchId)
      return publicBranchFromDetail(detail)
    },
    initialData: options?.initialData,
    staleTime: STALE_TIME,
    enabled: !!tenantId && !!branchId,
  })
}

/** Canonical public branch list for a tenant (Branch API). */
export function usePublicBranches(
  tenantId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<PublicBranchInfo[]>({
    queryKey: ['public-branches', tenantId],
    queryFn: () => resolvePublicBranchList(tenantId),
    staleTime: STALE_TIME,
    enabled: !!tenantId && (options?.enabled ?? true),
  })
}

export function useActivateTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (tenantId: string) => tenantService.activateTenant(tenantId),
    onSuccess: async (data, tenantId) => {
      await synchronizeTenantMutation(qc, data, { discover: true, publicTenants: true })
      auditLogService.record(
        'TENANT_ACTIVATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: tenantId, displayName: tenantId },
        { tenantId },
        { before: { status: 'suspended' }, after: { status: 'active' }, changedFields: ['status'] },
      )
    },
  })
}

export function useSuspendTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (tenantId: string) => tenantService.suspendTenant(tenantId),
    onSuccess: async (data, tenantId) => {
      await synchronizeTenantMutation(qc, data, { discover: true, publicTenants: true })
      auditLogService.record(
        'TENANT_SUSPENDED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: tenantId, displayName: tenantId },
        { tenantId },
        { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
      )
    },
  })
}

export function useArchiveTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (tenantId: string) => tenantService.archiveTenant(tenantId),
    onSuccess: async (data, tenantId) => {
      await synchronizeTenantMutation(qc, data, { discover: true, publicTenants: true })
      auditLogService.record(
        'TENANT_ARCHIVED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: tenantId, displayName: tenantId },
        { tenantId },
        { before: { status: 'active' }, after: { status: 'archived' }, changedFields: ['status'] },
      )
    },
  })
}

// ── RBAC D2 Hooks ─────────────────────────────────────────────────────────────

export function useTenantRoles(tenantId: string) {
  return useQuery({
    queryKey: ['tenant-roles', tenantId],
    queryFn: () => fetchTenantRoles(tenantId),
    staleTime: CACHE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['permission-catalog'],
    queryFn: () => fetchPermissionCatalog(),
    staleTime: CACHE_TIME,
  })
}

export function useAssignments(tenantId: string, params?: import('@/api/rbac').ListAssignmentsParams) {
  return useQuery({
    queryKey: ['assignments', tenantId, params],
    queryFn: () => listAssignments(tenantId, params),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

export function useCreateAssignment(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAssignmentPayload) => createAssignment(tenantId, payload),
    onSuccess: (_data, payload) => {
      invalidateRbacAssignmentMutations(qc, tenantId, {
        userId: payload.user_id,
        membershipId: payload.membership_id,
      })
    },
  })
}

export function useUpdateAssignment(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
      userId,
    }: {
      assignmentId: string
      payload: UpdateAssignmentPayload
      userId?: string
    }) => updateAssignment(tenantId, assignmentId, payload),
    onSuccess: (_data, { userId }) => {
      invalidateRbacAssignmentMutations(qc, tenantId, { userId })
    },
  })
}

export function useRevokeAssignment(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      userId,
      membershipId,
    }: {
      assignmentId: string
      userId?: string
      membershipId?: string
    }) => revokeAssignment(tenantId, assignmentId),
    onSuccess: (_data, { userId, membershipId }) => {
      invalidateRbacAssignmentMutations(qc, tenantId, { userId, membershipId })
    },
  })
}

// ── RBAC Wave 4 Hooks ─────────────────────────────────────────────────────────

export function usePermissionOverrides(
  tenantId: string,
  params?: import('@/api/authorization').ListPermissionOverridesParams,
  enabled = true,
) {
  return useQuery({
    queryKey: ['permission-overrides', tenantId, params],
    queryFn: () => listPermissionOverrides(tenantId, params),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId) && enabled,
  })
}

function patchPermissionOverridesCache(
  qc: QueryClient,
  tenantId: string,
  membershipId: string | undefined,
  next: PermissionOverride,
) {
  const apply = (old: unknown) => {
    if (!Array.isArray(old)) return old
    return upsertOverrideInList(old as PermissionOverride[], next)
  }
  if (membershipId) {
    qc.setQueriesData(
      { queryKey: ['permission-overrides', tenantId, { membership_id: membershipId }] },
      apply,
    )
  }
  qc.setQueriesData({ queryKey: ['permission-overrides', tenantId] }, apply)
}

function removePermissionOverrideFromCache(
  qc: QueryClient,
  tenantId: string,
  membershipId: string,
  overrideId: string,
) {
  const apply = (old: unknown) =>
    Array.isArray(old)
      ? (old as PermissionOverride[]).filter((o) => o.id !== overrideId)
      : old
  qc.setQueriesData(
    { queryKey: ['permission-overrides', tenantId, { membership_id: membershipId }] },
    apply,
  )
  qc.setQueriesData({ queryKey: ['permission-overrides', tenantId] }, apply)
}

export function useCreatePermissionOverride(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePermissionOverridePayload) =>
      createPermissionOverride(tenantId, payload),
    onSuccess: (data, payload) => {
      patchPermissionOverridesCache(qc, tenantId, payload.membership_id, data)
      invalidateRbacWave4Mutations(qc, tenantId, {
        membershipId: payload.membership_id,
        userId: payload.user_id,
      })
    },
  })
}

export function useUpdatePermissionOverride(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      overrideId,
      payload,
      membershipId,
      userId,
    }: {
      overrideId: string
      payload: UpdatePermissionOverridePayload
      membershipId: string
      userId?: string
    }) => updatePermissionOverride(tenantId, membershipId, overrideId, payload),
    onSuccess: (data, { membershipId, userId }) => {
      patchPermissionOverridesCache(qc, tenantId, membershipId, data)
      invalidateRbacWave4Mutations(qc, tenantId, { membershipId, userId })
    },
  })
}

export function useDeletePermissionOverride(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      overrideId,
      membershipId,
      userId,
    }: {
      overrideId: string
      membershipId: string
      userId?: string
    }) => deletePermissionOverride(tenantId, membershipId, overrideId),
    onSuccess: (_data, { overrideId, membershipId, userId }) => {
      removePermissionOverrideFromCache(qc, tenantId, membershipId, overrideId)
      invalidateRbacWave4Mutations(qc, tenantId, { membershipId, userId })
    },
  })
}

export function useEffectivePermissions(
  params?: import('@/api/authorization').EffectivePermissionsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: ['effective-permissions', params],
    queryFn: () => fetchEffectivePermissions(params),
    staleTime: STALE_TIME,
    enabled,
  })
}

export function usePermissionAudit(
  tenantId: string,
  params?: import('@/types/rbac-api').ListPermissionAuditParams,
  enabled = true,
) {
  return useQuery({
    queryKey: ['permission-audit', tenantId, params],
    queryFn: () => listPermissionAudit(tenantId, params),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId) && enabled,
  })
}

export function useRolePermissions(roleId: string, enabled = true) {
  return useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () => fetchRolePermissions(roleId),
    staleTime: STALE_TIME,
    enabled: Boolean(roleId) && enabled,
  })
}

export function useReplaceRolePermissions(roleId: string, tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReplaceRolePermissionsPayload) =>
      replaceRolePermissions(roleId, payload),
    onSuccess: () => {
      invalidateRolePermissions(qc, roleId)
      invalidatePermissionAudit(qc, tenantId)
      invalidateEffectivePermissions(qc)
      invalidatePermissionCatalog(qc)
      qc.invalidateQueries({ queryKey: ['me-permissions'] })
    },
  })
}

// ── Staff Management Hooks (P7.2) ─────────────────────────────────────────────

/** Paginated staff list — uses backend pagination/filtering when not in mock mode. */
export function useStaffPage(tenantId: string, params?: import('@/api/staff').ListStaffParams) {
  return useQuery({
    queryKey: ['staff', tenantId, params],
    queryFn: () => staffService.listStaffPage(tenantId, params),
    staleTime: STALE_TIME,
    enabled: Boolean(tenantId),
  })
}

/** Phase 2 — tenant scoping via `tenantId` only; access enforcement is the backend's job. */
export function useStaff(tenantId: string) {
  return useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => staffService.getStaff(tenantId),
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  })
}

export function useStaffMember(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    queryKey: ['staff-member', tenantId, id],
    queryFn: () => staffService.getStaffMember(id, tenantId),
    staleTime: STALE_TIME,
    enabled: !!id && !!tenantId,
  })
}

export function useInvites(tenantId: string) {
  return useQuery({
    queryKey: ['staff-invites', tenantId],
    queryFn: () => staffService.getInvites(tenantId),
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  })
}

export function useInviteStaff(tenantId: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeTenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (payload: InviteStaffPayload) => staffService.inviteStaff(tenantId, payload),
    onSuccess: (_data, variables) => {
      invalidateRbacStaffQueries(qc, tenantId)
      invalidatePermissionCatalog(qc)
      qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] })
      auditLogService.record(
        'STAFF_CREATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id: variables.email, displayName: variables.email },
        { tenantId: activeTenantId ?? tenantId },
        { before: null, after: { email: variables.email, role_id: variables.role_id } },
      )
    },
  })
}

export function useUpdateStaffRoles() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStaffRolesPayload }) =>
      staffService.updateStaffRoles(id, payload),
    onSuccess: (_data, { id, payload }) => {
      const member = qc.getQueryData<Awaited<ReturnType<typeof staffService.getStaffMember>>>(['staff-member', id])
      invalidateRbacStaffQueries(qc, member?.tenantId ?? tenantId ?? '', id, member?.userId)
      auditLogService.record(
        'STAFF_UPDATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenantId ?? '' },
        { before: null, after: { roles: payload.roles }, changedFields: ['roles'] },
      )
    },
  })
}

export function useSuspendStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (id: string) => staffService.suspendStaff(id, tenantId ?? ''),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['staff-member', id] })
      const snapshot = qc.getQueryData(['staff-member', id])
      qc.setQueryData(['staff-member', id], (old: { status: string } | undefined) =>
        old ? { ...old, status: 'suspended' } : old,
      )
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['staff-member', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      const member = qc.getQueryData<Awaited<ReturnType<typeof staffService.getStaffMember>>>(['staff-member', id])
      invalidateRbacStaffQueries(qc, member?.tenantId ?? tenantId ?? '', id, member?.userId)
      auditLogService.record(
        'STAFF_SUSPENDED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenantId ?? '' },
        { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
      )
    },
  })
}

export function useActivateStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (id: string) => staffService.activateStaff(id, tenantId ?? ''),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['staff-member', id] })
      const snapshot = qc.getQueryData(['staff-member', id])
      qc.setQueryData(['staff-member', id], (old: { status: string } | undefined) =>
        old ? { ...old, status: 'active' } : old,
      )
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['staff-member', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      const member = qc.getQueryData<Awaited<ReturnType<typeof staffService.getStaffMember>>>(['staff-member', id])
      invalidateRbacStaffQueries(qc, member?.tenantId ?? tenantId ?? '', id, member?.userId)
      auditLogService.record(
        'STAFF_REACTIVATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenantId ?? '' },
        { before: { status: 'suspended' }, after: { status: 'active' }, changedFields: ['status'] },
      )
    },
  })
}

export function useRemoveStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: (id: string) => staffService.removeStaff(id, tenantId ?? ''),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['staff-member', id] })
      const snapshot = qc.getQueryData(['staff-member', id])
      qc.setQueryData(['staff-member', id], (old: { status: string } | undefined) =>
        old ? { ...old, status: 'removed' } : old,
      )
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['staff-member', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      const member = qc.getQueryData<Awaited<ReturnType<typeof staffService.getStaffMember>>>(['staff-member', id])
      invalidateRbacStaffQueries(qc, member?.tenantId ?? tenantId ?? '', id, member?.userId)
      auditLogService.record(
        'STAFF_REMOVED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenantId ?? '' },
        { before: { status: 'active' }, after: { status: 'removed' }, changedFields: ['status'] },
      )
    },
  })
}

export function useTransferOwnership(tenantId: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeTenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: ({
      currentOwnerId,
      payload,
    }: {
      currentOwnerId: string
      payload: TransferOwnershipPayload
    }) => staffService.transferOwnership(currentOwnerId, payload.targetMemberId),
    onSuccess: (_data, { payload }) => {
      invalidateRbacStaffQueries(qc, tenantId)
      auditLogService.record(
        'OWNERSHIP_TRANSFERRED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: ['owner'] },
        { type: 'staff', id: payload.targetMemberId, displayName: payload.targetMemberId },
        { tenantId: activeTenantId ?? tenantId },
        { before: null, after: { newOwnerId: payload.targetMemberId } },
      )
    },
  })
}

export function useCancelInvite(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffService.cancelInvite(tenantId, id),
    onSuccess: () => {
      invalidateRbacStaffQueries(qc, tenantId)
      qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] })
    },
  })
}

export function useResendInvite(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffService.resendInvite(tenantId, id),
    onSuccess: () => {
      invalidateRbacStaffQueries(qc, tenantId)
      qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] })
    },
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffService.acceptInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-invites'] })
    },
  })
}

// ── Branch Routing & Isolation Hooks (P7.4) ──────────────────────────────────

// Phase 2 (RBAC unification) — useOwnershipBranchAccessContext(), which
// built a BranchAccessContext from client-held StaffAssignment fixtures
// via ownership-resolution.service.ts, has been removed: deciding which
// branches a staff member can see is an authorization decision and must
// come from the backend, not be computed in the browser.
//
// Phase 5 — useAccessibleBranches() (its would-be replacement) had zero
// consumers outside this file and was removed too, along with
// order-routing.service.ts (also zero runtime callers). branchAccessService
// (services/branch-access.service.ts) was NOT removed despite losing its
// only other caller here — ownership-resolution.service.ts still imports
// it directly (assertBranchAccess), and that file is intentionally kept
// until its dependent tests are migrated (see its own header comment).

/** Fetches orders for a specific branch. Phase 2 — branch access is a backend concern, not a client-side check. */
export function useBranchOrders(branchId: string) {
  return useQuery({
    queryKey: ['branch-orders', branchId],
    queryFn: () => adminService.getAdminOrders({ branch_id: branchId }),
    enabled: !!branchId,
  })
}

/** Fetches reservations for a specific branch. */
export function useBranchReservations(branchId: string) {
  return useQuery({
    queryKey: ['branch-reservations', branchId],
    queryFn: () => adminService.getAdminReservations({ branch_id: branchId }),
    enabled: !!branchId,
  })
}

/** Fetches branch-scoped analytics (revenue, orders, reservations). */
export function useBranchAnalytics(branchId: string) {
  return useQuery({
    enabled: !!branchId,
    staleTime: 30_000,
    queryKey: ['branch-analytics', branchId],
    queryFn: async () => {
      const [revenue, orders, reservations] = await Promise.all([
        branchAnalyticsService.getBranchRevenueAnalytics(branchId),
        branchAnalyticsService.getBranchOrderAnalytics(branchId),
        branchAnalyticsService.getBranchReservationAnalytics(branchId),
      ])
      return { revenue, orders, reservations }
    },
  })
}

// ── Audit Log Hooks (P7.5) ────────────────────────────────────────────────────

/** Fetches a paginated, filtered list of audit logs. */
export function useAuditLogs(filter: AuditFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 15_000,
    queryKey: ['audit-logs', filter],
    queryFn: () => auditLogService.getAuditLogs(filter),
  })
}

/** Fetches a single audit log entry by ID. */
export function useAuditLog(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
    queryKey: ['audit-log', tenantId, id],
    queryFn: () => auditLogService.getAuditLog(id, tenantId),
  })
}

/** Fetches audit logs grouped into a timeline by date. */
export function useAuditTimeline(filter: AuditFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 15_000,
    queryKey: ['audit-timeline', filter],
    queryFn: () => auditLogService.getAuditTimeline(filter),
  })
}

/** Fetches aggregate audit statistics for the given filter. */
export function useAuditStatistics(filter: AuditFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 30_000,
    queryKey: ['audit-statistics', filter],
    queryFn: () => auditLogService.getAuditStatistics(filter),
  })
}

/** Mutation to export audit logs as CSV or Excel. Returns the file content string. */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (request: AuditExportRequest) => auditLogService.exportAuditLogs(request),
  })
}

// ── Notification Hooks (P7.6) ─────────────────────────────────────────────────

/** Fetches a paginated, filtered list of rich notifications. */
export function useNotifications(filter: NotificationFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 10_000,
    queryKey: ['rich-notifications', filter],
    queryFn: () => notificationRichService.getNotifications(filter),
  })
}

/** Fetches unread notifications only. */
export function useUnreadNotifications(filter: Omit<NotificationFilter, 'status'> = {}) {
  return useQuery({
    enabled: true,
    staleTime: 10_000,
    queryKey: ['rich-notifications-unread', filter],
    queryFn: () => notificationRichService.getNotifications({ ...filter, status: 'unread' }),
  })
}

/** Fetches a single rich notification by ID. */
export function useNotification(id: string) {
  const tenantId = useConsoleTenantId() ?? ''
  return useQuery({
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
    queryKey: ['rich-notification', tenantId, id],
    queryFn: () => notificationRichService.getNotification(id, tenantId),
  })
}

/** Fetches real-time unread notification count. */
export function useUnreadNotificationCount(filter: NotificationFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 10_000,
    queryKey: ['notification-unread-count', filter],
    queryFn: () => notificationRichService.getUnreadCount(filter),
    refetchInterval: 30_000,
  })
}

/** Fetches notification statistics for analytics. */
export function useNotificationStatistics(filter: NotificationFilter = {}) {
  return useQuery({
    enabled: true,
    staleTime: 30_000,
    queryKey: ['notification-statistics', filter],
    queryFn: () => notificationRichService.getNotificationStatistics(filter),
  })
}

/** Fetches notification summary (unread count, urgent count, latest). */
export function useNotificationSummary(tenantId?: string, branchId?: string) {
  return useQuery({
    enabled: true,
    staleTime: 10_000,
    queryKey: ['notification-summary', tenantId, branchId],
    queryFn: () => notificationRichService.getSummary({ tenantId, branchId }),
    refetchInterval: 30_000,
  })
}

/** Fetches notification preferences for a user. */
export function useNotificationPreferences(userId: string, tenantId: string, branchId?: string) {
  return useQuery({
    enabled: !!userId && !!tenantId,
    staleTime: 60_000,
    queryKey: ['notification-preferences', userId, tenantId, branchId],
    queryFn: () => notificationPreferencesService.getPreferences(userId, tenantId, branchId),
  })
}

/** Mutation to update a notification preference for a category. */
export function useUpdateNotificationPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId, tenantId, category, update, branchId,
    }: {
      userId: string
      tenantId: string
      category: NotificationCategory
      update: Partial<Pick<NotificationPreference, 'enabled' | 'channels' | 'minPriority'>>
      branchId?: string
    }) => notificationPreferencesService.updatePreference(userId, tenantId, category, update, branchId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notification-preferences', vars.userId, vars.tenantId] })
    },
  })
}

/** Mutation to mark a notification as read. */
export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationRichService.markAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rich-notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread-count'] })
      qc.invalidateQueries({ queryKey: ['notification-summary'] })
    },
  })
}

/** Mutation to mark all notifications as read. */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (filter: NotificationFilter = {}) => notificationRichService.markAllAsRead(filter),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rich-notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread-count'] })
      qc.invalidateQueries({ queryKey: ['notification-summary'] })
    },
  })
}

/** Mutation to archive a notification. */
export function useArchiveNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationRichService.archiveNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rich-notifications'] })
    },
  })
}

/** Mutation to delete a notification. */
export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationRichService.deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rich-notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread-count'] })
    },
  })
}

/** Mutation to reset notification preferences to defaults. */
export function useResetNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, tenantId }: { userId: string; tenantId: string }) =>
      notificationPreferencesService.resetPreferences(userId, tenantId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notification-preferences', vars.userId, vars.tenantId] })
    },
  })
}

// ── P7.7 Realtime Operations Hooks ───────────────────────────────────────────

import { realtimeOperationsService } from '@/services/realtime-operations.service'
import type {
  OperationsScope,
  LiveOrder,
  LiveReservation,
  StaffPresence,
  BranchStatus,
  KitchenStatus,
  SLAAlert,
  RealtimeStatistics,
  OperationsEvent,
  OperationsDashboard,
} from '@/types/realtime-operations'

/**
 * Phase 2 (RBAC unification) — deliberately a no-op now. Previously
 * delegated to `assertOwnershipBranchAccess()` (ownership-resolution.service.ts),
 * deciding branch access from client-held mock data. Branch/tenant access
 * enforcement belongs to the backend; every call site below is left
 * unchanged (still `await`s this) so this is a one-line seam if a future
 * phase needs to reintroduce a client-side check for a different reason.
 */
async function assertOperationsScopeAccess(_email: string | null | undefined, _scope: OperationsScope): Promise<void> {
  // no-op — see comment above
}

/** Full operations dashboard snapshot — polls every 15 s for freshness. */
export function useOperationsDashboard(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['operations-dashboard', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getOperationsSnapshot(scope)
    },
    refetchInterval: 15_000,
  })
}

/** Live orders — polls every 10 s; real-time updates supplement via websocket. */
export function useLiveOrders(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['live-orders', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getLiveOrders(scope)
    },
    refetchInterval: 10_000,
  })
}

/** Live reservations — polls every 10 s. */
export function useLiveReservations(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['live-reservations', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getLiveReservations(scope)
    },
    refetchInterval: 10_000,
  })
}

/** Branch status summary — polls every 20 s. */
export function useBranchStatus(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['branch-status', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getBranchStatuses(scope)
    },
    refetchInterval: 20_000,
  })
}

/** Kitchen queue per branch — polls every 8 s. */
export function useKitchenStatus(branchId: string, tenantId: string) {
  return useQuery({
    queryKey: ['kitchen-status', tenantId, branchId],
    queryFn: () => realtimeOperationsService.getKitchenStatus(branchId),
    refetchInterval: 8_000,
  })
}

/** Staff presence board — polls every 30 s. */
export function useStaffPresence(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['staff-presence', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getStaffPresence(scope)
    },
    refetchInterval: 30_000,
  })
}

/** Active SLA alerts — polls every 15 s. */
export function useSLAAlerts(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['sla-alerts', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getSLAAlerts(scope)
    },
    refetchInterval: 15_000,
  })
}

/** Realtime statistics — polls every 30 s. */
export function useRealtimeStatistics(scope: OperationsScope) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['realtime-statistics', scope.tenantId, scope.branchId],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      return realtimeOperationsService.getRealtimeStatistics(scope)
    },
    refetchInterval: 30_000,
  })
}

/** Recent operations events — polls every 10 s. */
export function useOperationsStream(scope: OperationsScope, limit = 50) {
  const email = useAuthStore((s) => s.user?.email)
  return useQuery({
    queryKey: ['operations-stream', scope.tenantId, scope.branchId, limit],
    queryFn: async () => {
      await assertOperationsScopeAccess(email, scope)
      const snapshot = await realtimeOperationsService.getOperationsSnapshot(scope)
      return snapshot.recentEvents.slice(0, limit)
    },
    refetchInterval: 10_000,
  })
}

// ── P7.8 Phase D — Feature Flag hooks ────────────────────────────────────────
import { featureFlagsService } from '@/services/feature-flags.service'

export function useFeatureFlags() {
  const tenantId = useConsoleTenantId()
  return useQuery({
    queryKey: ['feature-flags', tenantId],
    queryFn: () => {
      if (!tenantId) return []
      return featureFlagsService.listFlagsForTenant(tenantId)
    },
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  })
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient()
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) => {
      if (!tenantId) throw new Error('No tenant')
      return featureFlagsService.updateFlagForTenant(tenantId, key, value)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags'] })
      qc.invalidateQueries({ queryKey: ['tenant'] })
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['console-tenants'] })
      qc.invalidateQueries({ queryKey: ['console-platform-tenants'] })
      qc.invalidateQueries({ queryKey: ['public-discover'] })
      qc.invalidateQueries({ queryKey: PUBLIC_TENANTS_QUERY_KEY })
    },
  })
}

// ── P7.8 Phase H — WebSocket integration ─────────────────────────────────────
import {
  adminOperationsSocket,
  consoleWebSocket,
  staffBroadcastSocket,
  notificationsBroadcastSocket,
  auditBroadcastSocket,
} from '@/services/websocket.service'
import { eventMatchesWorkspace } from '@/lib/console-pending-counts'

/** Returns the live connection status of the Console workspace WebSocket. */
export function useWebSocketStatus() {
  const [status, setStatus] = React.useState(() => consoleWebSocket.getStatus())

  React.useEffect(() => {
    const off = consoleWebSocket.on('status', (s: unknown) => {
      setStatus(s as ReturnType<typeof consoleWebSocket.getStatus>)
    })
    return off
  }, [])

  return status
}

/** Wires a socket event (or wildcard `*`) to invalidate a query key. */
function useBroadcastInvalidation(
  socket: typeof adminOperationsSocket,
  queryKey: readonly unknown[],
  eventType = '*',
) {
  const qc = useQueryClient()
  React.useEffect(() => {
    const off = socket.on(eventType, () => {
      qc.invalidateQueries({ queryKey: [...queryKey] })
    })
    return off
  }, [qc, socket, eventType, ...queryKey]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Subscribe to Console `order.changed` to invalidate live-orders queries. */
export function useOrdersBroadcastSync(scope: OperationsScope) {
  const qc = useQueryClient()
  React.useEffect(() => {
    const tenantId = scope.tenantId
    const branchId = scope.branchId
    const off = consoleWebSocket.on('order.changed', (data) => {
      if (!eventMatchesWorkspace(data, tenantId, branchId)) return
      qc.invalidateQueries({ queryKey: ['live-orders', tenantId, branchId] })
    })
    return off
  }, [qc, scope.tenantId, scope.branchId])
}

/** Subscribe to Console `reservation.changed` to invalidate live-reservations queries. */
export function useReservationsBroadcastSync(scope: OperationsScope) {
  const qc = useQueryClient()
  React.useEffect(() => {
    const tenantId = scope.tenantId
    const branchId = scope.branchId
    const off = consoleWebSocket.on('reservation.changed', (data) => {
      if (!eventMatchesWorkspace(data, tenantId, branchId)) return
      qc.invalidateQueries({ queryKey: ['live-reservations', tenantId, branchId] })
    })
    return off
  }, [qc, scope.tenantId, scope.branchId])
}

/** Subscribe staff broadcast socket to invalidate staff-presence queries. */
export function useStaffBroadcastSync(scope: OperationsScope) {
  useBroadcastInvalidation(staffBroadcastSocket, ['staff-presence', scope.tenantId, scope.branchId])
}

/** Subscribe notifications broadcast to invalidate notification queries. */
export function useNotificationsBroadcastSync() {
  useBroadcastInvalidation(notificationsBroadcastSocket, ['notifications'])
}

/** Subscribe audit broadcast to invalidate audit-log queries. */
export function useAuditBroadcastSync() {
  useBroadcastInvalidation(auditBroadcastSocket, ['audit-logs'])
}

// ── P7.8 Phase I — Analytics Export hook ─────────────────────────────────────
export type ExportFormat = 'csv' | 'json' | 'pdf'
export type ExportDomain = 'summary' | 'revenue' | 'reservations' | 'loyalty' | 'promotions' | 'vendors' | 'menu'

function toCSV(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const flat = Object.entries(data as Record<string, unknown>).map(([k, v]) => ({
    key: k,
    value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
  }))
  const header = 'key,value'
  const rows = flat.map(({ key, value }) => `${key},"${String(value).replace(/"/g, '""')}"`)
  return [header, ...rows].join('\n')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toPDF(data: unknown, domain: string, timestamp: string): string {
  const entries = data && typeof data === 'object'
    ? Object.entries(data as Record<string, unknown>).map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
      return `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:600">${k}</td><td style="padding:4px 8px;border:1px solid #ddd">${val}</td></tr>`
    }).join('')
    : '<tr><td colspan="2">No data</td></tr>'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${domain} Analytics — ${timestamp}</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}h1{font-size:18px}</style></head><body><h1>${domain.charAt(0).toUpperCase() + domain.slice(1)} Analytics Report</h1><p>Generated: ${timestamp}</p><table><thead><tr><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Field</th><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Value</th></tr></thead><tbody>${entries}</tbody></table></body></html>`
}

export function useExportAnalytics() {
  const tenantId = useConsoleTenantId()
  return useMutation({
    mutationFn: async ({ domain, format }: { domain: ExportDomain; format: ExportFormat }) => {
      if (!tenantId) throw new Error('No active tenant')
      const fetchMap: Record<ExportDomain, () => Promise<unknown>> = {
        summary: () => analyticsService.getAnalyticsSummary(tenantId),
        revenue: () => analyticsService.getRevenueAnalytics(tenantId),
        reservations: () => analyticsService.getReservationAnalytics(tenantId),
        loyalty: () => analyticsService.getLoyaltyAnalytics(tenantId),
        promotions: () => analyticsService.getPromotionAnalytics(tenantId),
        vendors: () => analyticsService.getVendorAnalytics(tenantId),
        menu: () => analyticsService.getMenuAnalytics(tenantId),
      }
      const data = await fetchMap[domain]()
      const timestamp = new Date().toISOString().split('T')[0]
      if (format === 'json') {
        downloadBlob(JSON.stringify(data, null, 2), `${domain}-${timestamp}.json`, 'application/json')
      } else if (format === 'pdf') {
        const html = toPDF(data, domain, timestamp)
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(html)
          win.document.close()
          win.print()
        }
      } else {
        downloadBlob(toCSV(data), `${domain}-${timestamp}.csv`, 'text/csv')
      }
      return { domain, format }
    },
  })
}

// ── P7.8 Phase J — Analytics Comparison hook ─────────────────────────────────
type ComparisonPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface ComparisonResult<T> {
  current: T | undefined
  previous: T | undefined
  isLoading: boolean
  isError: boolean
}

export function useAnalyticsComparison(period: ComparisonPeriod = 'week'): ComparisonResult<AnalyticsSummaryPair> {
  const tenantId = useConsoleTenantId() ?? ''
  const now = new Date()
  const periodDays = period === 'day' ? 1 : period === 'month' ? 30 : period === 'quarter' ? 90 : period === 'year' ? 365 : 7
  const currentStart = new Date(now.getTime() - periodDays * 86_400_000).toISOString()
  const previousStart = new Date(now.getTime() - periodDays * 2 * 86_400_000).toISOString()
  const previousEnd = currentStart

  const currentQ = useQuery({
    queryKey: ['analytics-summary', tenantId, 'current', period, currentStart],
    queryFn: () => analyticsService.getAnalyticsSummary(tenantId, { dateFrom: currentStart }),
    staleTime: 60_000,
    enabled: !!tenantId,
  })
  const previousQ = useQuery({
    queryKey: ['analytics-summary', tenantId, 'previous', period, previousStart],
    queryFn: () => analyticsService.getAnalyticsSummary(tenantId, { dateFrom: previousStart, dateTo: previousEnd }),
    staleTime: 60_000,
    enabled: !!tenantId,
  })
  return {
    current: currentQ.data ? { ...currentQ.data, _period: 'current' as const } : undefined,
    previous: previousQ.data ? { ...previousQ.data, _period: 'previous' as const } : undefined,
    isLoading: currentQ.isLoading || previousQ.isLoading,
    isError: currentQ.isError || previousQ.isError,
  }
}

interface AnalyticsSummaryPair {
  _period: 'current' | 'previous'
  [key: string]: unknown
}

// ── Business Reviews Hooks — P8.8.5 ──────────────────────────────────────────

import { businessReviewService } from '@/services/business-review.service'
import type {
  BusinessReviewFilters,
  CreateBusinessReviewPayload,
  ReviewStatus,
} from '@/types/business-review'

export function useBusinessReviews(
  tenantId: string,
  filters: Partial<BusinessReviewFilters> = {},
) {
  return useQuery({
    queryKey: ['business-reviews', tenantId, filters],
    queryFn: () => businessReviewService.getBusinessReviews(tenantId, filters),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useRatingBreakdown(tenantId: string, branchId?: string) {
  return useQuery({
    queryKey: ['business-reviews', tenantId, 'rating', branchId ?? null],
    queryFn: () => businessReviewService.getRatingBreakdown(tenantId, branchId),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useCreateBusinessReview(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBusinessReviewPayload) => businessReviewService.createReview(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-reviews', tenantId] })
    },
  })
}

export function useReplyToReview(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) =>
      businessReviewService.replyToReview(reviewId, tenantId, text),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-reviews', tenantId] })
    },
  })
}

export function useMarkHelpful(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => businessReviewService.markHelpful(reviewId, tenantId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-reviews', tenantId] })
    },
  })
}

export function useModerateReview(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: ReviewStatus }) =>
      businessReviewService.moderateReview(reviewId, tenantId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-reviews', tenantId] })
    },
  })
}

export function useReviewAnalytics(tenantId: string) {
  return useQuery({
    queryKey: ['business-reviews', tenantId, 'analytics'],
    queryFn: () => businessReviewService.getReviewAnalytics(tenantId),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

// ── Website Builder Hooks — P8.8.6 ───────────────────────────────────────────

import { websiteBuilderService } from '@/services/website-builder.service'
import { uploadService } from '@/services/upload.service'
import type { HomepageLayout, BranchContentOverrides } from '@/types/website-builder'

export function useHomepageLayout(tenantId: string) {
  return useQuery({
    queryKey: ['website-builder', tenantId, 'layout'],
    queryFn: () => websiteBuilderService.getLayout(tenantId),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useSaveLayout(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (layout: HomepageLayout) => websiteBuilderService.saveLayout(tenantId, layout),
    onSuccess: (saved) => {
      qc.setQueryData(['website-builder', tenantId, 'layout'], saved)
    },
  })
}

export function usePublishLayout(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (layout: HomepageLayout) => websiteBuilderService.publishLayout(tenantId, layout),
    onSuccess: (published) => {
      qc.setQueryData(['website-builder', tenantId, 'layout'], published)
      void qc.invalidateQueries({ queryKey: ['tenant', tenantId] })
    },
  })
}

export function useRestoreVersion(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) => websiteBuilderService.restoreVersion(tenantId, versionId),
    onSuccess: (restored) => {
      qc.setQueryData(['website-builder', tenantId, 'layout'], restored)
    },
  })
}

export function useBranchOverrides(tenantId: string, branchId: string) {
  return useQuery({
    queryKey: ['website-builder', tenantId, 'branch-overrides', branchId],
    queryFn: () => websiteBuilderService.getBranchOverrides(tenantId, branchId),
    enabled: Boolean(tenantId) && Boolean(branchId),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useSaveBranchOverrides(tenantId: string, branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: BranchContentOverrides) =>
      websiteBuilderService.saveBranchOverrides(tenantId, branchId, overrides),
    onSuccess: (saved) => {
      qc.setQueryData(['website-builder', tenantId, 'branch-overrides', branchId], saved)
    },
  })
}

export function useUploadWebsiteMedia(_tenantId: string) {
  return useMutation({
    mutationFn: async (file: File) =>
      uploadService.uploadFile({
        file,
        purpose: 'website_media',
        tenantId: _tenantId,
        entityType: 'tenant',
        entityId: _tenantId,
      }),
    retry: 0,
  })
}

import { platformHomepageService } from '@/services/platform-homepage.service'
import type { PlatformHomepageHero } from '@/types/website-builder'

export function usePlatformHomepageHero() {
  return useQuery({
    queryKey: ['platform-homepage', 'hero'],
    queryFn: () => platformHomepageService.getHero(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useSavePlatformHomepageHero() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hero: PlatformHomepageHero) => platformHomepageService.saveHero(hero),
    onSuccess: (saved) => {
      qc.setQueryData(['platform-homepage', 'hero'], saved)
    },
  })
}

export function useUploadPlatformHomepageMedia() {
  return useMutation({
    mutationFn: async (file: File) =>
      uploadService.uploadFile({
        file,
        purpose: 'website_media',
        entityType: 'platform',
        entityId: 'homepage',
      }),
    retry: 0,
  })
}

export {
  useConsoleWorkspace,
  useConsoleTenantId,
  useConsoleBranchId,
  useConsoleSessionRefresh,
  useConsoleTenantSwitch,
  useConsoleBranchSwitch,
  refreshConsoleWorkspaceSession,
  refreshConsoleBranchSession,
  requestConsoleTenantSwitch,
  requestConsoleBranchSwitch,
  invalidateConsoleWorkspaceQueries,
  clearConsoleWorkspaceQueryCache,
  TENANT_SCOPED_QUERY_KEYS,
} from './console-workspace'

export {
  usePendingOrdersCount,
  usePendingReservationsCount,
  useConsoleWorkspaceRealtime,
  useConsolePendingCountsEnabled,
} from './console-realtime'
