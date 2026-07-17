import * as React from 'react'
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { authService } from '@/services/auth.service'
import { qrExperienceService } from '@/services/qr-experience.service'
import { analyticsService } from '@/services/analytics.service'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { staffService } from '@/services/staff.service'
import type {
  InviteStaffPayload,
  UpdateStaffRolesPayload,
  TransferOwnershipPayload,
} from '@/types/staff'
import { branchManagementService } from '@/services/branch.service'
import type {
  Branch as BranchEntity,
  CreateBranchPayload,
  UpdateBranchPayload,
  AssignManagerPayload,
  BranchResolutionState,
} from '@/types/branch'
import { branchAccessService } from '@/services/branch-access.service'
import { branchAnalyticsService } from '@/services/branch-analytics.service'
import type { BranchAccessContext } from '@/types/branch-routing'
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
import { useAuthStore, useFavoritesStore, useNotificationStore, useTenantStore, useLangStore, useRbacStore, useBranchStore, useCartStore, useDineInStore, useRecentlyViewedStore } from '@/stores'
import { applyOverrides, resolveEffectivePermissions, normalizeTenantPermissions } from '@/services/permission.service'
import type { P7Permission, PermissionCheckOptions, EffectivePermissionResult } from '@/types/rbac'
// Phase 2 (RBAC unification) — no imports from ownership-resolution.service.ts,
// owner.service.ts, or staff-assignment.service.ts remain in this file.
// Access decisions come from usePermissions()/currentTenantSession only.
import { getHeaderNav, getDashboardNav, getAdminNav, hasCapability, CAPABILITY_FLAG_MAP } from '@/modules/registry'
import { CACHE_TIME, STALE_TIME } from '@/constants'
import { paymentService } from '@/services/payment.service'
import { reviewService } from '@/services/review.service'
import type { MenuFilters } from '@/services/menu.service'
import type { CreateOrderPayload } from '@/services/order.service'
import type { CreatePaymentIntentPayload } from '@/services/payment.service'
import type { CreateReviewPayload } from '@/services/review.service'
import type { CreateReservationPayload } from '@/services/combined.service'
import type {
  AdminCustomerFilters,
  AdminOrderFilters,
  AdminReservationFilters,
  Capability,
  Category,
  Extra,
  ExtraGroup,
  LoginCredentials,
  LoyaltyReward,
  MenuItem,
  NavItem,
  Order,
  OrderStatus,
  PaginatedResponse,
  RegisterData,
  Reservation,
  ReservationStatus,
  SystemReadiness,
  TenantLifecycle,
  SendOTPRequest,
  VerifyOTPRequest,
} from '@/types'
import { getMarketplaceMeta, type PublicBranchInfo } from '@/types/marketplace'

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
  const tenantState             = useTenantStore((s) => s.tenantState)
  const rbacInitialized         = useTenantStore((s) => s.rbacInitialized)
  const featureFlagsInitialized = useTenantStore((s) => s.featureFlagsInitialized)
  const isLoading  = tenantState === 'loading'
  const isReady    = tenantState === 'resolved'
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
 * tenant. Applies user-level allow/deny overrides on top of
 * `currentTenantSession.permissions` — evaluation order: User Deny → User
 * Allow → Session Permissions → Default Deny.
 *
 * Phase 2 (RBAC unification) — this is now THE single permission source.
 * The parallel ownership/StaffAssignment-derived permission union
 * (src/services/ownership-resolution.service.ts) has been removed
 * entirely: the frontend does not decide access from client-held
 * Owner/StaffAssignment data. `currentTenantSession` is seeded by
 * normalizeTenantPermissions() (permission.service.ts) at login, session
 * restore, and every tenant switch — never computed here.
 */
export function usePermissions(): readonly P7Permission[] {
  const user = useAuthStore((s) => s.user)
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)
  const userOverrides = useRbacStore((s) => s.userOverrides)

  return useMemo(() => {
    // Defensive: only trust the session if it's actually for the active
    // tenant — guards against one stale render between a tenant switch
    // and the session reseed that follows it.
    const base = currentTenantSession && currentTenantSession.tenantId === tenantId
      ? currentTenantSession.permissions
      : []
    const override = userOverrides.find((o) => o.userId === user?.id && o.tenantId === tenantId)
    return applyOverrides(base, override)
  }, [user?.id, tenantId, currentTenantSession, userOverrides])
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

/**
 * P8.5 — Returns the full effective permission breakdown for the given user+tenant.
 * Used by the admin Permission Management UI to display per-permission source info.
 */
export function useEffectivePermissions(userId: string, tenantId: string): EffectivePermissionResult[] {
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const userOverrides = useRbacStore((s) => s.userOverrides)
  return useMemo(() => {
    const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
    const override = userOverrides.find((o) => o.userId === userId && o.tenantId === tenantId)
    return resolveEffectivePermissions(roles, override)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId, tenantRoles, userOverrides])
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
  // Phase 2 (RBAC unification) — no longer a second, ownership-derived
  // access model. `dashboard:access` is now a real permission granted to
  // every assignable role in ROLE_PERMISSION_MAP (permission.service.ts):
  // holding ANY tenant-scoped role is what makes the Console reachable.
  // This hook is kept only because it's a widely-imported, self-describing
  // name — it is a thin wrapper, not a duplicate permission path.
  return usePermission('dashboard:access')
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
 * Returns admin nav items for the active tenant's modules, filtered by feature flags.
 *
 * Filtering rules:
 *   - Items without `featureFlagKey` are always shown.
 *   - Items with `featureFlagKey` are hidden when the flag resolves to false.
 *   - When system is not yet ready, all admin nav items are returned.
 *
 * Canonical usage in admin layouts:
 *   const adminNav = useAdminModuleNav()
 *
 * P10.2.2 — now calls `usePermissions()` (the single source of truth,
 * ownership/StaffAssignment-aware as of this phase) instead of
 * recomputing `tenantRoles.find(...) → getPermissionsForRole()` inline.
 * The inline recomputation was a duplicate implementation of exactly what
 * `usePermissions()` already does (P10.2.2 Phase A/F finding) — it would
 * have silently kept nav filtering on the pre-ownership permission set
 * forever, since nothing routed StaffAssignment/Owner data through it.
 */
export function useAdminModuleNav(): NavItem[] {
  const { canExecute } = useSystemReady()
  const tenant = useTenantStore((s) => s.tenant)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const permissions = usePermissions()
  const allAdminNav = getAdminNav(tenant?.businessTypes ?? [])
  if (!canExecute) return allAdminNav
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
 */
function seedTenantSession(tenantId: string, response: { p7Roles?: import('@/types/rbac').Role[] }) {
  const { roles, permissions } = normalizeTenantPermissions(response)
  useRbacStore.getState().setCurrentTenantSession(tenantId, roles, permissions)
  // setTenantRoles() is retained for the admin role-management UI (view/edit
  // assignments across tenants) — a separate concern from "what can I do
  // right now," which currentTenantSession alone answers.
  if (roles.length > 0) useRbacStore.getState().setTenantRoles(tenantId, roles)
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.login(creds),
    onSuccess: ({ user, p7Roles }) => {
      setUser(user)
      const tenant = useTenantStore.getState().tenant
      if (tenant) seedTenantSession(tenant.id, { p7Roles })
    },
  })
}

// P10.9 — mirrors useLogin()/useVerifyOTP(): hydrates the authenticated
// user and, if present, tenantRoles after a successful registration.
export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: ({ user, p7Roles }) => {
      setUser(user)
      const tenant = useTenantStore.getState().tenant
      if (tenant) seedTenantSession(tenant.id, { p7Roles })
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
export function useVerifyOTP() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (payload: VerifyOTPRequest) => authService.verifyOTP(payload),
    onSuccess: (result) => {
      if (result.is_new_user) return
      setUser(result.user)
      const tenant = useTenantStore.getState().tenant
      if (tenant) seedTenantSession(tenant.id, { p7Roles: result.p7Roles })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const logout = useAuthStore((s) => s.logout)
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout()
      // P10.3 Phase G — _resetStore() clears every persisted RBAC field
      // (tenantRoles, userOverrides, customRoles, rbacAuditLog); the
      // previous clearRoles() only reset tenantRoles, leaving stale
      // authorization state behind after logout (P10.2.3 finding F-5).
      useRbacStore.getState()._resetStore()
      useBranchStore.getState().setAdminActiveBranch(null)
      useCartStore.getState().clearCart()
      useDineInStore.getState().clearTable()
      useFavoritesStore.getState().setFavorites([])
      useRecentlyViewedStore.getState().clear()
      qc.clear()
    },
  })
}

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe(),
    staleTime: STALE_TIME,
    retry: false,
    meta: { onSuccess: setUser },
  })
}

// ── Menu Hooks ────────────────────────────────────────────────────────────────
// Menus are branch-scoped: every hook here requires a branch identity before
// it will fetch anything. The identity is the branch's `slug` (the only
// stable identifier the public-facing branch representation — PublicBranchInfo
// — actually carries; see docs/BRANCH_MENU_ANALYSIS.md). Callers that already
// know which branch they're rendering (e.g. a `[tenantSlug]/[branchSlug]`
// route) should pass it explicitly; callers with no route-level branch context
// fall back to the customer's currently active branch in useBranchStore.
export function useActiveBranchId(): string | undefined {
  return useBranchStore((s) => s.activeBranch?.slug)
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

export function useExtraGroups(branchId?: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['extra-groups', tenantId, scopedBranchId],
    queryFn: () => menuService.getExtraGroups(scopedBranchId!),
    enabled: !!scopedBranchId,
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

export function useRelatedItems(branchId: string | undefined, id: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId
  return useQuery({
    queryKey: ['related-items', tenantId, scopedBranchId, id],
    queryFn: () => menuService.getRelated(scopedBranchId!, id),
    staleTime: STALE_TIME,
    enabled: !!scopedBranchId && !!id,
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
    queryKey: ['order', id],
    queryFn: () => orderService.getOrder(id),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => orderService.createOrder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useValidateDiscount() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      orderService.validateDiscountCode(code, subtotal),
  })
}

// P4.3 — Review hooks
export function useItemReviews(itemId: string) {
  return useQuery({
    queryKey: ['reviews', itemId],
    queryFn: () => reviewService.getItemReviews(itemId),
    enabled: Boolean(itemId),
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
export function useBranches() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['branches', tenantId],
    queryFn: () => branchService.getBranches(tenantId ?? undefined),
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
 * AdminBranchSwitcher's invalidation call and (eventually) every
 * branch-scoped hook below, so there is exactly one list to keep in sync
 * rather than a hardcoded set duplicated at each call site.
 */
export const BRANCH_SCOPED_QUERY_KEYS = [
  'admin-orders',
  'admin-reservations',
  'admin-customers',
  'admin-stats',
  'analytics-summary',
  'analytics-revenue',
  'analytics-reservations',
  'branch-orders',
  'branch-reservations',
  'branch-analytics',
  'kitchen-status',
  'operations-dashboard',
  'live-orders',
  'live-reservations',
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
    queryFn: () => branchManagementService.getBranches(tenantId),
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  })
}

export function useAdminBranch(id: string) {
  return useQuery({
    queryKey: ['admin-branch', id],
    queryFn: () => branchManagementService.getBranch(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useAdminBranchMetrics(id: string) {
  return useQuery({
    queryKey: ['admin-branch-metrics', id],
    queryFn: () => branchManagementService.getBranchMetrics(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCreateBranch(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBranchPayload) =>
      branchManagementService.createBranch(tenantId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-branches', tenantId] })
    },
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchPayload }) =>
      branchManagementService.updateBranch(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', id], {
          ...snapshot,
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.location && { location: { ...snapshot.location, ...payload.location } }),
          ...(payload.contact && { contact: { ...snapshot.contact, ...payload.contact } }),
          ...(payload.managerId !== undefined && { managerId: payload.managerId }),
          ...(payload.businessHours && { businessHours: payload.businessHours }),
          ...(payload.settings && { settings: { ...snapshot.settings, ...payload.settings } }),
        })
      }
      return { snapshot }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', id], ctx.snapshot)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-branch', id] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useActivateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchManagementService.activateBranch(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', id], { ...snapshot, status: 'active' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-branch', id] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useDeactivateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchManagementService.deactivateBranch(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', id], { ...snapshot, status: 'inactive' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-branch', id] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useMaintenanceBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchManagementService.setMaintenanceMode(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', id], { ...snapshot, status: 'maintenance' })
      }
      return { snapshot }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', id], ctx.snapshot)
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-branch', id] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useAssignBranchManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignManagerPayload }) =>
      branchManagementService.assignManager(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ['admin-branch', id] })
      const snapshot = qc.getQueryData<BranchEntity>(['admin-branch', id])
      if (snapshot) {
        qc.setQueryData<BranchEntity>(['admin-branch', id], {
          ...snapshot,
          managerId: payload.managerId,
        })
      }
      return { snapshot }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['admin-branch', id], ctx.snapshot)
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-branch', id] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchManagementService.deleteBranch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
    },
  })
}

export function useSetDefaultBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchManagementService.setDefaultBranch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-branch'] })
      qc.invalidateQueries({ queryKey: ['admin-branches'] })
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
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

export function useConfirmEmailVerification() {
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authService.confirmEmailVerification({ email, code }),
    // The UI derives "has an email" straight from user.email (no verification
    // flag) — so after confirming, re-fetch GET /auth/me for the authoritative
    // value, push it into the React Query cache, and hydrate the auth store.
    // That's the only thing that needs to happen; the settings page re-renders
    // off the store update with no local state of its own to reconcile.
    onSuccess: async () => {
      const fresh = await authService.getMe()
      qc.setQueryData(['me'], fresh)
      setUser(fresh)
    },
  })
}

// ── User Hooks ────────────────────────────────────────────────────────────────
export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: () => userService.getAddresses(),
    staleTime: STALE_TIME,
  })
}

export function useFavorites() {
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const ids = await userService.getFavorites()
      setFavorites(ids)
      return ids
    },
    staleTime: STALE_TIME,
  })
}

export function useToggleFavorite() {
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  return useMutation({
    mutationFn: (itemId: string) => userService.toggleFavorite(itemId),
    onMutate: (itemId) => toggleFavorite(itemId), // optimistic
    onError: (_err, itemId) => toggleFavorite(itemId), // rollback
  })
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
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-summary', tenantId],
    queryFn: () => analyticsService.getAnalyticsSummary(),
    staleTime: STALE_TIME,
  })
}

export function useRevenueAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-revenue', tenantId],
    queryFn: () => analyticsService.getRevenueAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useReservationAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-reservations', tenantId],
    queryFn: () => analyticsService.getReservationAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useLoyaltyAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-loyalty', tenantId],
    queryFn: () => analyticsService.getLoyaltyAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function usePromotionAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-promotions', tenantId],
    queryFn: () => analyticsService.getPromotionAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useVendorAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-vendors', tenantId],
    queryFn: () => analyticsService.getVendorAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useMenuAnalytics() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['analytics-menu', tenantId],
    queryFn: () => analyticsService.getMenuAnalytics(),
    staleTime: STALE_TIME,
  })
}

// P6.12 — QR Experience hook
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
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-stats', tenantId],
    queryFn: () => adminService.getStats(),
    staleTime: 60_000,
  })
}

/**
 * Phase 2 — tenant scoping for `/console/orders` now relies solely on the
 * `tenantId` query-key/param, the same as every other admin query; access
 * enforcement is the backend's responsibility, not a client-side check.
 */
export function useAdminOrders(filters: AdminOrderFilters = {}) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-orders', tenantId, filters],
    queryFn: () => adminService.getAdminOrders(filters),
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      adminService.updateOrderStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin-orders'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<Order>>({ queryKey: ['admin-orders'] })
      qc.setQueriesData<PaginatedResponse<Order>>(
        { queryKey: ['admin-orders'] },
        (old) => old
          ? { ...old, results: old.results.map((o) => o.id === id ? { ...o, status } : o) }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_data, { id, status }) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      auditLogService.record(
        'ORDER_STATUS_CHANGED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'order', id, displayName: `Order ${id}` },
        { tenantId: tenant?.id ?? '' },
        { before: null, after: { status }, changedFields: ['status'] },
      )
    },
  })
}

/** Phase 2 — same scoping approach as useAdminOrders() above. */
export function useAdminReservations(filters: AdminReservationFilters = {}) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-reservations', tenantId, filters],
    queryFn: () => adminService.getAdminReservations(filters),
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}

export function useAdminReservation(id: string) {
  return useQuery({
    queryKey: ['admin-reservation', id],
    queryFn: () => adminService.getAdminReservation(id),
    enabled: !!id,
    staleTime: 10_000,
  })
}

export function useConfirmReservation() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (id: string) => adminService.confirmReservation(id),
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
      auditLogService.record(
        'RESERVATION_CONFIRMED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'reservation', id, displayName: `Reservation ${id}` },
        { tenantId: tenant?.id ?? '' },
        { before: { status: 'pending' }, after: { status: 'confirmed' }, changedFields: ['status'] },
      )
    },
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (id: string) => reservationService.cancelReservation(id),
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
      auditLogService.record(
        'RESERVATION_CANCELLED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'reservation', id, displayName: `Reservation ${id}` },
        { tenantId: tenant?.id ?? '' },
        { before: { status: 'confirmed' }, after: { status: 'cancelled' }, changedFields: ['status'] },
      )
    },
  })
}

export function useAdminCustomers(filters: AdminCustomerFilters = {}) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-customers', tenantId, filters],
    queryFn: () => adminService.getCustomers({ ...filters, tenantId: tenantId ?? undefined }),
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  })
}

export function useAdminCustomer(id: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-customer', tenantId, id],
    queryFn: () => adminService.getCustomer(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerStats(id: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-customer-stats', tenantId, id],
    queryFn: () => adminService.getCustomerStats(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerReviews(id: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-customer-reviews', tenantId, id],
    queryFn: () => adminService.getCustomerReviews(id, tenantId ?? undefined),
    enabled: !!id && !!tenantId,
    staleTime: STALE_TIME,
  })
}

// ── P8.9.6 — BusinessCustomer / BranchCustomer hooks ─────────────────────────

export function useBusinessCustomer(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['business-customer', tenantId, userId],
    queryFn: () => adminService.getBusinessCustomer(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useBranchCustomers(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['branch-customers', tenantId, userId],
    queryFn: () => adminService.getBranchCustomers(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerLoyalty(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-loyalty', tenantId, userId],
    queryFn: () => loyaltyService.getAccount(userId, tenantId ?? undefined),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

// ── P8.9.7 Customer 360° CRM Hooks ───────────────────────────────────────────

export function useCustomerTimeline(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-timeline', tenantId, userId],
    queryFn: () => adminService.getCustomerTimeline(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerNotes(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-notes', tenantId, userId],
    queryFn: () => adminService.getCustomerNotes(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: 0,
  })
}

export function useCreateCustomerNote(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, authorId, authorName }: { content: string; authorId: string; authorName: string }) =>
      adminService.createCustomerNote(userId, tenantId ?? '', content, authorId, authorName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useUpdateCustomerNote(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      adminService.updateCustomerNote(noteId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useDeleteCustomerNote(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => adminService.deleteCustomerNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', tenantId, userId] }),
  })
}

export function useCustomerTags(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-tags', tenantId, userId],
    queryFn: () => adminService.getCustomerTags(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useTenantTagDefinitions() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['tenant-tags', tenantId],
    queryFn: () => adminService.getTenantTagDefinitions(tenantId ?? ''),
    enabled: !!tenantId,
    staleTime: CACHE_TIME,
  })
}

export function useUpdateCustomerTags(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagIds: string[]) => adminService.updateCustomerTags(userId, tenantId ?? '', tagIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-tags', tenantId, userId] }),
  })
}

export function useCustomerAnalytics(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-analytics', tenantId, userId],
    queryFn: () => adminService.getCustomerAnalytics(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerMarketing(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-marketing', tenantId, userId],
    queryFn: () => adminService.getCustomerMarketing(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerCoupons(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-coupons', tenantId, userId],
    queryFn: () => adminService.getCustomerCoupons(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerPayments(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-payments', tenantId, userId],
    queryFn: () => adminService.getCustomerPayments(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerOrders360(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['customer-orders-360', tenantId, userId],
    queryFn: () => adminService.getCustomerOrders(userId, tenantId ?? ''),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME,
  })
}

export function useCustomerReservations360(userId: string) {
  const tenantId = useTenantStore((s) => s.tenant?.id)
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
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrderStatus }) =>
      Promise.all(ids.map((id) => adminService.updateOrderStatus(id, status))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useBulkCancelOrders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => adminService.updateOrderStatus(id, 'cancelled'))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useBulkConfirmReservations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => adminService.confirmReservation(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useBulkCancelReservations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => reservationService.cancelReservation(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useBulkExportCustomers() {
  return useMutation({
    mutationFn: (ids: string[]) => {
      const rows = [
        'id,name,email',
        ...ids.map((id) => `${id},,`),
      ].join('\n')
      const blob = new Blob([rows], { type: 'text/csv' })
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

/** Matches only this branch's cached `categories` entries. */
function categoriesQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'categories' && query.queryKey[2] === branchId
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
    mutationFn: (payload: Partial<Category>) => menuService.createCategory(branchId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useUpdateCategory(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Category> }) =>
      menuService.updateCategory(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const predicate = categoriesQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Category[]>({ predicate })
      qc.setQueriesData<Category[]>(
        { predicate },
        (old) => old ? old.map((c) => c.id === id ? { ...c, ...payload } : c) : old,
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
              return c ? { ...c, order: index + 1 } : undefined
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

// ── Extra Group Admin Hooks ───────────────────────────────────────────────────
// Same pattern as the Category admin hooks above: branchId required (no store
// fallback for mutations), invalidation scoped to the active branch's cached
// queries via a predicate, optimistic update + rollback on read-then-write ops.

/** Matches only this branch's cached `extra-groups` entries. */
function extraGroupsQueryPredicate(branchId: string) {
  return (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'extra-groups' && query.queryKey[2] === branchId
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
      qc.invalidateQueries({ predicate: extraGroupsQueryPredicate(branchId) })
    },
  })
}

export function useUpdateExtraGroup(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExtraGroup> }) =>
      menuService.updateExtraGroup(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const predicate = extraGroupsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<ExtraGroup[]>({ predicate })
      qc.setQueriesData<ExtraGroup[]>(
        { predicate },
        (old) => old ? old.map((g) => g.id === id ? { ...g, ...payload } : g) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extraGroupsQueryPredicate(branchId) })
    },
  })
}

export function useDeleteExtraGroup(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteExtraGroup(branchId, id),
    onMutate: async (id) => {
      const predicate = extraGroupsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<ExtraGroup[]>({ predicate })
      qc.setQueriesData<ExtraGroup[]>(
        { predicate },
        (old) => old ? old.filter((g) => g.id !== id) : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extraGroupsQueryPredicate(branchId) })
      // A deleted group can no longer be assigned to any item — its menu-item
      // assignments/materialized extras may need to be refreshed too.
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
    },
  })
}

export function useReorderExtraGroups(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => menuService.reorderExtraGroups(branchId, orderedIds),
    onMutate: async (orderedIds) => {
      const predicate = extraGroupsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<ExtraGroup[]>({ predicate })
      qc.setQueriesData<ExtraGroup[]>(
        { predicate },
        (old) => {
          if (!old) return old
          const byId = new Map(old.map((g) => [g.id, g]))
          return orderedIds
            .map((id, index) => {
              const g = byId.get(id)
              return g ? { ...g, order: index + 1 } : undefined
            })
            .filter((g): g is ExtraGroup => !!g)
        },
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extraGroupsQueryPredicate(branchId) })
    },
  })
}

// ── Extra Admin Hooks ──────────────────────────────────────────────────────────

export function useCreateExtra(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Extra> & { group_id: string }) => menuService.createExtra(branchId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: extrasQueryPredicate(branchId) })
    },
  })
}

export function useUpdateExtra(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Extra> }) =>
      menuService.updateExtra(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const predicate = extrasQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<Extra[]>({ predicate })
      qc.setQueriesData<Extra[]>(
        { predicate },
        (old) => old ? old.map((e) => e.id === id ? { ...e, ...payload } : e) : old,
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
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
      qc.invalidateQueries({ queryKey: ['menu-item', branchId, itemId] })
    },
  })
}

export function useCreateMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<MenuItem>) => menuService.createItem(branchId, payload),
    onSuccess: () => {
      // Scoped invalidation: only the active branch's cached menu-items/categories
      // are refetched — other branches' cached queries are left untouched.
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
      qc.invalidateQueries({ predicate: categoriesQueryPredicate(branchId) })
    },
  })
}

export function useUpdateMenuItem(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MenuItem> }) =>
      menuService.updateItem(branchId, id, payload),
    onMutate: async ({ id, payload }) => {
      const predicate = menuItemsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<PaginatedResponse<MenuItem>>({ predicate })
      qc.setQueriesData<PaginatedResponse<MenuItem>>(
        { predicate },
        (old) => old
          ? { ...old, results: old.results.map((i) => i.id === id ? { ...i, ...payload } : i) }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
      qc.invalidateQueries({ queryKey: ['menu-item', branchId, id] })
    },
  })
}

// ── Vendor Hooks (P6.11) ─────────────────────────────────────────────────────

export function useVendors() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['vendors', tenantId],
    queryFn: () => vendorService.getVendors(),
    staleTime: STALE_TIME,
  })
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorService.getVendor(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateVendorPayload) => vendorService.createVendor(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVendorPayload }) =>
      vendorService.updateVendor(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['vendor', id] })
    },
  })
}

export function useDisableVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorService.disableVendor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export function useVendorStats(id: string) {
  return useQuery({
    queryKey: ['vendor-stats', id],
    queryFn: () => vendorService.getVendorStats(id),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useVendorSettlements(id: string) {
  return useQuery({
    queryKey: ['vendor-settlements', id],
    queryFn: () => vendorService.getVendorSettlements(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useCreateSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSettlementPayload) => vendorService.createSettlement(payload),
    onSuccess: (_data, { vendorId }) => {
      qc.invalidateQueries({ queryKey: ['vendor-settlements', vendorId] })
      qc.invalidateQueries({ queryKey: ['vendor-stats', vendorId] })
    },
  })
}

// ── Promotion Hooks (P6.10) ───────────────────────────────────────────────────

export function usePromotions() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['promotions', tenantId],
    queryFn: () => promotionService.getPromotions(),
    staleTime: STALE_TIME,
  })
}

export function useActivePromotions() {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['active-promotions', tenantId],
    queryFn: () => promotionService.getActivePromotions(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePromotionPayload) => promotionService.createPromotion(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions'] })
      qc.invalidateQueries({ queryKey: ['active-promotions'] })
    },
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePromotionPayload }) =>
      promotionService.updatePromotion(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions'] })
      qc.invalidateQueries({ queryKey: ['active-promotions'] })
    },
  })
}

export function useDisablePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => promotionService.disablePromotion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions'] })
      qc.invalidateQueries({ queryKey: ['active-promotions'] })
    },
  })
}

export function useActivatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => promotionService.activatePromotion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions'] })
      qc.invalidateQueries({ queryKey: ['active-promotions'] })
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
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return useQuery({
    queryKey: ['admin-loyalty-rewards', tenantId],
    queryFn: () => loyaltyService.adminGetRewards(),
    staleTime: STALE_TIME,
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
      const predicate = menuItemsQueryPredicate(branchId)
      await qc.cancelQueries({ predicate })
      const snapshots = qc.getQueriesData<PaginatedResponse<MenuItem>>({ predicate })
      qc.setQueriesData<PaginatedResponse<MenuItem>>(
        { predicate },
        (old) => old
          ? { ...old, results: old.results.filter((i) => i.id !== id), count: old.count - 1 }
          : old,
      )
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: menuItemsQueryPredicate(branchId) })
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-templates'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-templates'] }),
  })
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient()
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => {
      if (!tenant) throw new Error('No tenant')
      return tenantService.updateTenantSettings(tenant.slug, patch)
    },
    onSuccess: (updated) => {
      useTenantStore.getState().setTenant(updated)
      qc.invalidateQueries({ queryKey: ['tenant'] })
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
 * P8.7.7.1 — Public marketplace discovery hook.
 * Returns all tenants visible in the public /discover page (active + trial).
 * No RBAC guard — this is explicitly public data for business discovery.
 * Uses a separate query key so it never collides with the admin useTenants().
 */
export function usePublicTenants() {
  return useQuery({
    queryKey: ['public-tenants'],
    queryFn: () => tenantService.getTenants(),
    staleTime: STALE_TIME,
    select: (tenants) =>
      tenants.filter(
        (t) => t.slug !== 'default' && (t.status === 'active' || t.status === 'trial'),
      ),
  })
}

/**
 * Fetches a single public tenant by slug. Returns null for an unknown or
 * inaccessible slug (a normal, expected outcome for a mistyped public URL —
 * must not surface as a query error/toast). A genuine server/network
 * failure still throws, so React Query's error state (and the global
 * error-toast handler) only fires for real backend problems, not for
 * ordinary "this business doesn't exist" lookups.
 */
export function usePublicTenant(slug: string) {
  return useQuery({
    queryKey: ['public-tenant', slug],
    queryFn: async () => {
      try {
        return await tenantService.getTenant(slug)
      } catch (err) {
        if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) return null
        throw err
      }
    },
    staleTime: STALE_TIME,
    enabled: !!slug,
  })
}

/** Fetches a single public branch by tenant+branch slug from marketplace meta. Returns null for unknown slugs. */
export function usePublicBranch(tenantSlug: string, branchSlug: string) {
  return useQuery<PublicBranchInfo | null>({
    queryKey: ['public-branch', tenantSlug, branchSlug],
    queryFn: async (): Promise<PublicBranchInfo | null> => {
      const tenant = await tenantService.getTenant(tenantSlug)
      if (tenant.slug === 'default' && tenantSlug !== 'default') return null
      const meta = getMarketplaceMeta(tenant.settings)
      return meta?.branches?.find((b) => b.slug === branchSlug) ?? null
    },
    staleTime: STALE_TIME,
    enabled: !!tenantSlug && !!branchSlug,
  })
}

export function useActivateTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (slugOrId: string) => tenantService.activateTenant(slugOrId),
    onSuccess: (_data, slugOrId) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      auditLogService.record(
        'TENANT_ACTIVATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: slugOrId, displayName: slugOrId },
        { tenantId: slugOrId },
        { before: { status: 'suspended' }, after: { status: 'active' }, changedFields: ['status'] },
      )
    },
  })
}

export function useSuspendTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (slugOrId: string) => tenantService.suspendTenant(slugOrId),
    onSuccess: (_data, slugOrId) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      auditLogService.record(
        'TENANT_SUSPENDED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: slugOrId, displayName: slugOrId },
        { tenantId: slugOrId },
        { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
      )
    },
  })
}

export function useArchiveTenant() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: (slugOrId: string) => tenantService.archiveTenant(slugOrId),
    onSuccess: (_data, slugOrId) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      auditLogService.record(
        'TENANT_ARCHIVED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'tenant', id: slugOrId, displayName: slugOrId },
        { tenantId: slugOrId },
        { before: { status: 'active' }, after: { status: 'archived' }, changedFields: ['status'] },
      )
    },
  })
}

// ── Staff Management Hooks (P7.2) ─────────────────────────────────────────────

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
  return useQuery({
    queryKey: ['staff-member', id],
    queryFn: () => staffService.getStaffMember(id),
    staleTime: STALE_TIME,
    enabled: !!id,
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
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (payload: InviteStaffPayload) => staffService.inviteStaff(tenantId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] })
      auditLogService.record(
        'STAFF_CREATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id: variables.email, displayName: variables.email },
        { tenantId: tenant?.id ?? tenantId },
        { before: null, after: { email: variables.email, roles: variables.roles } },
      )
    },
  })
}

export function useUpdateStaffRoles() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStaffRolesPayload }) =>
      staffService.updateStaffRoles(id, payload),
    onSuccess: (_data, { id, payload }) => {
      const member = qc.getQueryData<Awaited<ReturnType<typeof staffService.getStaffMember>>>(['staff-member', id])
      if (member) {
        qc.invalidateQueries({ queryKey: ['staff', member.tenantId] })
      }
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      auditLogService.record(
        'STAFF_UPDATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenant?.id ?? '' },
        { before: null, after: { roles: payload.roles }, changedFields: ['roles'] },
      )
    },
  })
}

export function useSuspendStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (id: string) => staffService.suspendStaff(id),
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
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      auditLogService.record(
        'STAFF_SUSPENDED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenant?.id ?? '' },
        { before: { status: 'active' }, after: { status: 'suspended' }, changedFields: ['status'] },
      )
    },
  })
}

export function useActivateStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (id: string) => staffService.activateStaff(id),
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
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      auditLogService.record(
        'STAFF_REACTIVATED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenant?.id ?? '' },
        { before: { status: 'suspended' }, after: { status: 'active' }, changedFields: ['status'] },
      )
    },
  })
}

export function useRemoveStaff() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: (id: string) => staffService.removeStaff(id),
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
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      auditLogService.record(
        'STAFF_REMOVED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: [] },
        { type: 'staff', id, displayName: id },
        { tenantId: tenant?.id ?? '' },
        { before: { status: 'active' }, after: { status: 'removed' }, changedFields: ['status'] },
      )
    },
  })
}

export function useTransferOwnership(tenantId: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: ({
      currentOwnerId,
      payload,
    }: {
      currentOwnerId: string
      payload: TransferOwnershipPayload
    }) => staffService.transferOwnership(currentOwnerId, payload.targetMemberId),
    onSuccess: (_data, { payload }) => {
      qc.invalidateQueries({ queryKey: ['staff', tenantId] })
      auditLogService.record(
        'OWNERSHIP_TRANSFERRED',
        { id: user?.id ?? 'system', name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'System', roles: ['owner'] },
        { type: 'staff', id: payload.targetMemberId, displayName: payload.targetMemberId },
        { tenantId: tenant?.id ?? tenantId },
        { before: null, after: { newOwnerId: payload.targetMemberId } },
      )
    },
  })
}

export function useCancelInvite(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffService.cancelInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] }),
  })
}

export function useResendInvite(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffService.resendInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-invites', tenantId] }),
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

/** Returns the branches visible to the given access context, filtered through the branch access engine. */
export function useAccessibleBranches(
  context: BranchAccessContext,
  allBranches: BranchEntity[],
) {
  return useQuery({
    enabled: !!context.tenantId && !!context.staffId,
    staleTime: STALE_TIME,
    queryKey: ['accessible-branches', context.tenantId, context.staffId, context.roles, context.branchIds],
    queryFn: () => Promise.resolve(branchAccessService.getAccessibleBranches(context, allBranches)),
  })
}

// Phase 2 (RBAC unification) — useOwnershipBranchAccessContext(), which
// built a BranchAccessContext from client-held StaffAssignment fixtures
// via ownership-resolution.service.ts, has been removed: deciding which
// branches a staff member can see is an authorization decision and must
// come from the backend, not be computed in the browser. It had no
// consumers outside this file. useAccessibleBranches() above is unaffected
// — it's a generic filter over whatever context/branches it's given.

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
  return useQuery({
    enabled: !!id,
    staleTime: STALE_TIME,
    queryKey: ['audit-log', id],
    queryFn: () => auditLogService.getAuditLog(id),
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
  return useQuery({
    enabled: !!id,
    staleTime: STALE_TIME,
    queryKey: ['rich-notification', id],
    queryFn: () => notificationRichService.getNotification(id),
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
  const tenant = useTenantStore((s) => s.tenant)
  return useQuery({
    queryKey: ['feature-flags', tenant?.id],
    queryFn: () => {
      if (!tenant) return []
      return featureFlagsService.listFlags(tenant)
    },
    enabled: !!tenant,
    staleTime: 60_000,
  })
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient()
  const tenant = useTenantStore((s) => s.tenant)
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) => {
      if (!tenant) throw new Error('No tenant')
      const newOverrides = featureFlagsService.updateFlag(tenant, key, value)
      const updatedTenant = {
        ...tenant,
        settings: { ...tenant.settings, featureFlags: newOverrides },
      }
      useTenantStore.getState().setTenant(updatedTenant)
      useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(updatedTenant))
      return Promise.resolve({ key, value })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags'] })
    },
  })
}

// ── P7.8 Phase H — WebSocket integration ─────────────────────────────────────
import {
  adminOperationsSocket,
  ordersBroadcastSocket,
  reservationsBroadcastSocket,
  staffBroadcastSocket,
  notificationsBroadcastSocket,
  auditBroadcastSocket,
} from '@/services/websocket.service'

/** Returns the live connection status of the admin operations WebSocket. */
export function useWebSocketStatus() {
  const [status, setStatus] = React.useState(() => adminOperationsSocket.getStatus())

  React.useEffect(() => {
    const off = adminOperationsSocket.on('status', (s: unknown) => {
      setStatus(s as ReturnType<typeof adminOperationsSocket.getStatus>)
    })
    return off
  }, [])

  return status
}

/** Wires a broadcast socket to invalidate a query key on any message. */
function useBroadcastInvalidation(
  socket: typeof adminOperationsSocket,
  queryKey: readonly unknown[],
) {
  const qc = useQueryClient()
  React.useEffect(() => {
    const off = socket.on('message', () => {
      qc.invalidateQueries({ queryKey: [...queryKey] })
    })
    return off
  }, [qc, socket, ...queryKey]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Subscribe orders broadcast socket to invalidate live-orders queries. */
export function useOrdersBroadcastSync(scope: OperationsScope) {
  useBroadcastInvalidation(ordersBroadcastSocket, ['live-orders', scope.tenantId, scope.branchId])
}

/** Subscribe reservations broadcast socket to invalidate live-reservations queries. */
export function useReservationsBroadcastSync(scope: OperationsScope) {
  useBroadcastInvalidation(reservationsBroadcastSocket, ['live-reservations', scope.tenantId, scope.branchId])
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
  return useMutation({
    mutationFn: async ({ domain, format }: { domain: ExportDomain; format: ExportFormat }) => {
      const fetchMap: Record<ExportDomain, () => Promise<unknown>> = {
        summary:      () => analyticsService.getAnalyticsSummary(),
        revenue:      () => analyticsService.getRevenueAnalytics(),
        reservations: () => analyticsService.getReservationAnalytics(),
        loyalty:      () => analyticsService.getLoyaltyAnalytics(),
        promotions:   () => analyticsService.getPromotionAnalytics(),
        vendors:      () => analyticsService.getVendorAnalytics(),
        menu:         () => analyticsService.getMenuAnalytics(),
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
  const now = new Date()
  const periodDays = period === 'day' ? 1 : period === 'month' ? 30 : period === 'quarter' ? 90 : period === 'year' ? 365 : 7
  const currentStart = new Date(now.getTime() - periodDays * 86_400_000).toISOString()
  const previousStart = new Date(now.getTime() - periodDays * 2 * 86_400_000).toISOString()
  const previousEnd = currentStart

  const currentQ = useQuery({
    queryKey: ['analytics-summary', 'current', period, currentStart],
    queryFn: () => analyticsService.getAnalyticsSummary({ dateFrom: currentStart }),
    staleTime: 60_000,
  })
  const previousQ = useQuery({
    queryKey: ['analytics-summary', 'previous', period, previousStart],
    queryFn: () => analyticsService.getAnalyticsSummary({ dateFrom: previousStart, dateTo: previousEnd }),
    staleTime: 60_000,
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
import type { HomepageLayout, BranchContentOverrides } from '@/types/website-builder'

export function useHomepageLayout(tenantSlug: string) {
  return useQuery({
    queryKey: ['website-builder', tenantSlug, 'layout'],
    queryFn: () => websiteBuilderService.getLayout(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useSaveLayout(tenantSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (layout: HomepageLayout) => websiteBuilderService.saveLayout(tenantSlug, layout),
    onSuccess: (saved) => {
      qc.setQueryData(['website-builder', tenantSlug, 'layout'], saved)
    },
  })
}

export function usePublishLayout(tenantSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (layout: HomepageLayout) => websiteBuilderService.publishLayout(tenantSlug, layout),
    onSuccess: (published) => {
      qc.setQueryData(['website-builder', tenantSlug, 'layout'], published)
      void qc.invalidateQueries({ queryKey: ['tenant', tenantSlug] })
    },
  })
}

export function useRestoreVersion(tenantSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) => websiteBuilderService.restoreVersion(tenantSlug, versionId),
    onSuccess: (restored) => {
      qc.setQueryData(['website-builder', tenantSlug, 'layout'], restored)
    },
  })
}

export function useBranchOverrides(tenantSlug: string, branchSlug: string) {
  return useQuery({
    queryKey: ['website-builder', tenantSlug, 'branch-overrides', branchSlug],
    queryFn: () => websiteBuilderService.getBranchOverrides(tenantSlug, branchSlug),
    enabled: Boolean(tenantSlug) && Boolean(branchSlug),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useSaveBranchOverrides(tenantSlug: string, branchSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: BranchContentOverrides) =>
      websiteBuilderService.saveBranchOverrides(tenantSlug, branchSlug, overrides),
    onSuccess: (saved) => {
      qc.setQueryData(['website-builder', tenantSlug, 'branch-overrides', branchSlug], saved)
    },
  })
}
