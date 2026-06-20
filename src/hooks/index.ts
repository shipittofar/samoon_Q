import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { menuService } from '@/services/menu.service'
import { orderService } from '@/services/order.service'
import {
  branchService,
  notificationService,
  reservationService,
  userService,
} from '@/services/combined.service'
import { authService } from '@/services/auth.service'
import { useAuthStore, useFavoritesStore, useNotificationStore, useTenantStore } from '@/stores'
import { CACHE_TIME, STALE_TIME } from '@/constants'
import type { MenuFilters } from '@/services/menu.service'
import type { CreateOrderPayload } from '@/services/order.service'
import type { CreateReservationPayload } from '@/services/combined.service'
import type { LoginCredentials, RegisterData, TenantLifecycle } from '@/types'

// ── Tenant Lifecycle Hook (Phase 1B stabilization) ────────────────────────────
/**
 * Returns the deterministic tenant lifecycle state for the current session.
 *
 *   'loading'  → bootstrap not yet complete; no Phase 1B logic should run
 *   'ready'    → tenant loaded from a live source; full system behaviour applies
 *   'fallback' → service failed; tenant is DEFAULT_TENANT; single-tenant rules apply
 *
 * All Phase 1B systems (RBAC, feature flags, route guards) MUST branch on this.
 * Safe behaviour per state:
 *   loading  → deny RBAC, use module-default flags only, skip route validation
 *   fallback → DEFAULT_TENANT permissions, module-default flags, allow navigation
 *   ready    → full tenant-specific overrides
 */
export function useTenantState(): TenantLifecycle {
  return useTenantStore((s) => s.tenantState)
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
