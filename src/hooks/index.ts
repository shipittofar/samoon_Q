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
  notificationService,
  reservationService,
  tableService,
  userService,
} from '@/services/combined.service'
import { authService } from '@/services/auth.service'
import { qrExperienceService } from '@/services/qr-experience.service'
import { analyticsService } from '@/services/analytics.service'
import { useAuthStore, useFavoritesStore, useNotificationStore, useTenantStore, useLangStore } from '@/stores'
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
  Permission,
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
export function useHasPermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role ?? null)
  return rbacService.hasPermission(role, permission)
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
  const allAdminNav = getAdminNav(tenant.businessTypes)
  if (!canExecute) return allAdminNav
  return allAdminNav.filter(
    (item) => !item.featureFlagKey || featureFlags[item.featureFlagKey] !== false,
  )
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

// ── Branch Hooks ──────────────────────────────────────────────────────────────
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

// ── Notification Hooks ────────────────────────────────────────────────────────
export function useNotifications() {
  const setNotifications = useNotificationStore((s) => s.setNotifications)
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationService.getNotifications()
      setNotifications(res.results)
      return res
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
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

export function useConfirmReservation() {
  const qc = useQueryClient()
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reservations'] })
      qc.invalidateQueries({ queryKey: ['reservations'] })
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

export function useAdminCustomerStats(id: string) {
  return useQuery({
    queryKey: ['admin-customer-stats', id],
    queryFn: () => adminService.getCustomerStats(id),
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
