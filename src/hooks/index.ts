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
import { tenantService } from '@/services/tenant.service'
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
import { useAuthStore, useFavoritesStore, useNotificationStore, useTenantStore, useLangStore, useRbacStore } from '@/stores'
import { getPermissionsForRole, hasPermission, hasAnyPermission, hasAllPermissions } from '@/services/permission.service'
import type { P7Permission, PermissionCheckOptions } from '@/types/rbac'
import { rbacService } from '@/services/rbac.service'
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
  LoginCredentials,
  LoyaltyReward,
  MenuItem,
  NavItem,
  Order,
  OrderStatus,
  PaginatedResponse,
  LegacyPermission,
  RegisterData,
  Reservation,
  ReservationStatus,
  SystemReadiness,
  TenantLifecycle,
} from '@/types'

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
  const isReady    = tenantState === 'ready'
  const isFallback = tenantState === 'fallback'

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

// ── RBAC Hook — P1B.1 ────────────────────────────────────────────────────────
/**
 * Returns true if the currently authenticated user holds the given permission.
 * Returns false for unauthenticated users (safe default deny).
 *
 * Canonical usage:
 *   const canManageMenu = useHasPermission('menu:manage')
 *   if (!canManageMenu) return null
 */
export function useHasPermission(permission: LegacyPermission): boolean {
  const role = useAuthStore((s) => s.user?.role ?? null)
  return rbacService.hasPermission(role, permission)
}

// ── P7.1 Permission Hooks ─────────────────────────────────────────────────────
/**
 * Returns all P7 permissions granted to the current user for the active tenant.
 * Memoized by role list string to avoid excessive re-renders.
 */
export function usePermissions(): readonly P7Permission[] {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  return useMemo(() => {
    const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
    return getPermissionsForRole(roles)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tenantRoles])
}

/**
 * Returns true if the current user holds the given P7 permission for the active tenant.
 * Respects the full authorization formula: Permission AND Capability AND FeatureFlag.
 */
export function usePermission(permission: P7Permission, opts?: PermissionCheckOptions): boolean {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
    return hasPermission(roles, permission, { featureFlags, ...opts })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tenantRoles, permission, featureFlags])
}

/**
 * Returns true if the current user holds AT LEAST ONE of the given permissions.
 */
export function useAnyPermission(permissions: P7Permission[], opts?: PermissionCheckOptions): boolean {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
    return hasAnyPermission(roles, permissions, { featureFlags, ...opts })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tenantRoles, permissions.join(','), featureFlags])
}

/**
 * Returns true if the current user holds ALL of the given permissions.
 */
export function useAllPermissions(permissions: P7Permission[], opts?: PermissionCheckOptions): boolean {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  return useMemo(() => {
    const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
    return hasAllPermissions(roles, permissions, { featureFlags, ...opts })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tenantRoles, permissions.join(','), featureFlags])
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
  const allNav = getHeaderNav(tenant.businessTypes)
  if (!canExecute) return allNav
  return allNav.filter(
    (item) => !item.featureFlagKey || featureFlags[item.featureFlagKey] !== false,
  )
}

/**
 * Returns dashboard sidebar nav items, filtered by RBAC.
 *
 * - Returns empty array when user lacks `dashboard:access` permission.
 * - Returns full dashboard nav for staff and admin.
 * - Safe for unauthenticated users (null role → no access → empty array).
 */
export function useDashboardNav(): NavItem[] {
  const role = useAuthStore((s) => s.user?.role ?? null)
  if (!rbacService.hasPermission(role, 'dashboard:access')) return []
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
  return hasCapability(tenant.businessTypes, cap)
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
 */
export function useAdminModuleNav(): NavItem[] {
  const { canExecute } = useSystemReady()
  const tenant = useTenantStore((s) => s.tenant)
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const allAdminNav = getAdminNav(tenant.businessTypes)
  if (!canExecute) return allAdminNav
  const roles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
  const permissions = getPermissionsForRole(roles)
  return allAdminNav.filter((item) => {
    if (item.featureFlagKey && featureFlags[item.featureFlagKey] === false) return false
    if (item.permissionKey && !permissions.includes(item.permissionKey)) return false
    return true
  })
}

// ── Auth Hooks ────────────────────────────────────────────────────────────────
export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.login(creds),
    onSuccess: ({ user }) => setUser(user),
  })
}

export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: ({ user }) => setUser(user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const logout = useAuthStore((s) => s.logout)
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout()
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
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => menuService.getCategories(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  })
}

export function useMenuItems(filters?: MenuFilters) {
  return useQuery({
    queryKey: ['menu-items', filters],
    queryFn: () => menuService.getItems(filters),
    staleTime: STALE_TIME,
  })
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: ['menu-item', id],
    queryFn: () => menuService.getItem(id),
    staleTime: STALE_TIME,
    enabled: !!id,
  })
}

export function useFeaturedItems() {
  return useQuery({
    queryKey: ['featured-items'],
    queryFn: () => menuService.getFeatured(),
    staleTime: STALE_TIME,
  })
}

export function useRelatedItems(id: string) {
  return useQuery({
    queryKey: ['related-items', id],
    queryFn: () => menuService.getRelated(id),
    staleTime: STALE_TIME,
    enabled: !!id,
  })
}

export function useMenuSearch(query: string) {
  return useQuery({
    queryKey: ['menu-search', query],
    queryFn: () => menuService.search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}

// ── Order Hooks ───────────────────────────────────────────────────────────────
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
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
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
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

// ── Branch Management Hooks (P7.3) ────────────────────────────────────────────

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

// ── Reservation Hooks ─────────────────────────────────────────────────────────
export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
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
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getAnalyticsSummary(),
    staleTime: STALE_TIME,
  })
}

export function useRevenueAnalytics() {
  return useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => analyticsService.getRevenueAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useReservationAnalytics() {
  return useQuery({
    queryKey: ['analytics-reservations'],
    queryFn: () => analyticsService.getReservationAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useLoyaltyAnalytics() {
  return useQuery({
    queryKey: ['analytics-loyalty'],
    queryFn: () => analyticsService.getLoyaltyAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function usePromotionAnalytics() {
  return useQuery({
    queryKey: ['analytics-promotions'],
    queryFn: () => analyticsService.getPromotionAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useVendorAnalytics() {
  return useQuery({
    queryKey: ['analytics-vendors'],
    queryFn: () => analyticsService.getVendorAnalytics(),
    staleTime: STALE_TIME,
  })
}

export function useMenuAnalytics() {
  return useQuery({
    queryKey: ['analytics-menu'],
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
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminService.getStats(),
    staleTime: 60_000,
  })
}

export function useAdminOrders(filters: AdminOrderFilters = {}) {
  return useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: () => adminService.getAdminOrders(filters),
    staleTime: 30_000,
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

export function useAdminReservations(filters: AdminReservationFilters = {}) {
  return useQuery({
    queryKey: ['admin-reservations', filters],
    queryFn: () => adminService.getAdminReservations(filters),
    staleTime: 30_000,
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
  return useQuery({
    queryKey: ['admin-customers', filters],
    queryFn: () => adminService.getCustomers(filters),
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomer(id: string) {
  return useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => adminService.getCustomer(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerStats(id: string) {
  return useQuery({
    queryKey: ['admin-customer-stats', id],
    queryFn: () => adminService.getCustomerStats(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useAdminCustomerReviews(id: string) {
  return useQuery({
    queryKey: ['admin-customer-reviews', id],
    queryFn: () => adminService.getCustomerReviews(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

// ── Menu Admin Hooks (P5.1) ───────────────────────────────────────────────────

export function useCreateMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<MenuItem>) => menuService.createItem(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MenuItem> }) =>
      menuService.updateItem(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ['menu-items'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<MenuItem>>({ queryKey: ['menu-items'] })
      qc.setQueriesData<PaginatedResponse<MenuItem>>(
        { queryKey: ['menu-items'] },
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
      qc.invalidateQueries({ queryKey: ['menu-items'] })
      qc.invalidateQueries({ queryKey: ['menu-item', id] })
    },
  })
}

// ── Vendor Hooks (P6.11) ─────────────────────────────────────────────────────

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
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
  return useQuery({
    queryKey: ['promotions'],
    queryFn: () => promotionService.getPromotions(),
    staleTime: STALE_TIME,
  })
}

export function useActivePromotions() {
  return useQuery({
    queryKey: ['active-promotions'],
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
  return useQuery({
    queryKey: ['loyalty-account'],
    queryFn: () => loyaltyService.getAccount(),
    staleTime: 30_000,
  })
}

export function useLoyaltyTransactions() {
  return useQuery({
    queryKey: ['loyalty-transactions'],
    queryFn: () => loyaltyService.getTransactions(),
    staleTime: 30_000,
  })
}

export function useLoyaltyRewards() {
  return useQuery({
    queryKey: ['loyalty-rewards'],
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
  return useQuery({
    queryKey: ['admin-loyalty-rewards'],
    queryFn: () => loyaltyService.adminGetRewards(),
    staleTime: STALE_TIME,
  })
}

export function useAdminCreateReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<LoyaltyReward, 'id' | 'createdAt'>) =>
      loyaltyService.adminCreateReward(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards'] }),
  })
}

export function useAdminUpdateReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<LoyaltyReward, 'id' | 'createdAt'>> }) =>
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

export function useDeleteMenuItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['menu-items'] })
      const snapshots = qc.getQueriesData<PaginatedResponse<MenuItem>>({ queryKey: ['menu-items'] })
      qc.setQueriesData<PaginatedResponse<MenuItem>>(
        { queryKey: ['menu-items'] },
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
      qc.invalidateQueries({ queryKey: ['menu-items'] })
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
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.getTenants(),
    staleTime: STALE_TIME,
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

/** Fetches orders for a specific branch. */
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

/** Full operations dashboard snapshot — polls every 15 s for freshness. */
export function useOperationsDashboard(scope: OperationsScope) {
  return useQuery({
    queryKey: ['operations-dashboard', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getOperationsSnapshot(scope),
    refetchInterval: 15_000,
  })
}

/** Live orders — polls every 10 s; real-time updates supplement via websocket. */
export function useLiveOrders(scope: OperationsScope) {
  return useQuery({
    queryKey: ['live-orders', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getLiveOrders(scope),
    refetchInterval: 10_000,
  })
}

/** Live reservations — polls every 10 s. */
export function useLiveReservations(scope: OperationsScope) {
  return useQuery({
    queryKey: ['live-reservations', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getLiveReservations(scope),
    refetchInterval: 10_000,
  })
}

/** Branch status summary — polls every 20 s. */
export function useBranchStatus(scope: OperationsScope) {
  return useQuery({
    queryKey: ['branch-status', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getBranchStatuses(scope),
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
  return useQuery({
    queryKey: ['staff-presence', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getStaffPresence(scope),
    refetchInterval: 30_000,
  })
}

/** Active SLA alerts — polls every 15 s. */
export function useSLAAlerts(scope: OperationsScope) {
  return useQuery({
    queryKey: ['sla-alerts', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getSLAAlerts(scope),
    refetchInterval: 15_000,
  })
}

/** Realtime statistics — polls every 30 s. */
export function useRealtimeStatistics(scope: OperationsScope) {
  return useQuery({
    queryKey: ['realtime-statistics', scope.tenantId, scope.branchId],
    queryFn: () => realtimeOperationsService.getRealtimeStatistics(scope),
    refetchInterval: 30_000,
  })
}

/** Recent operations events — polls every 10 s. */
export function useOperationsStream(scope: OperationsScope, limit = 50) {
  return useQuery({
    queryKey: ['operations-stream', scope.tenantId, scope.branchId, limit],
    queryFn: async () => {
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
