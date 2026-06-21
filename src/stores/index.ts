import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'

// ── P4.7.5 — Debounced localStorage writes for high-frequency stores ──────────
// Cart items can change rapidly (add/update quantity). Debouncing avoids
// blocking the main thread on every keystroke or click. 50 ms is short enough
// to avoid data loss while eliminating redundant synchronous writes.
function createDebouncedStorage<T>(delayMs: number): PersistStorage<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    getItem: (name) => {
      if (typeof localStorage === 'undefined') return null
      const raw = localStorage.getItem(name)
      if (!raw) return null
      return JSON.parse(raw) as import('zustand/middleware').StorageValue<T>
    },
    setItem: (name, value) => {
      if (typeof localStorage === 'undefined') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        localStorage.setItem(name, JSON.stringify(value))
      }, delayMs)
    },
    removeItem: (name) => {
      if (timer) { clearTimeout(timer); timer = null }
      if (typeof localStorage === 'undefined') return
      localStorage.removeItem(name)
    },
  }
}
import type { Branch, CartItem, Extra, MenuItem, Notification, Tenant, TenantLifecycle, User } from '@/types'
import { BRANCH_KEY, CART_KEY, DEFAULT_TENANT, DINE_IN_KEY, LANG_KEY, TAX_RATE, SERVICE_CHARGE_RATE, TENANT_KEY, THEME_KEY } from '@/constants'
import { tenantService } from '@/services/tenant.service'

// ── Auth Store ────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}))

// ── Cart Store ────────────────────────────────────────────────────────────────
interface CartState {
  items: CartItem[]
  discountCode: string
  discountAmount: number
  isOpen: boolean
  addItem: (item: MenuItem, quantity?: number, extras?: Extra[], notes?: string) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  updateNotes: (id: string, notes: string) => void
  clearCart: () => void
  setDiscount: (code: string, amount: number) => void
  setOpen: (v: boolean) => void
  getSubtotal: () => number
  getTax: () => number
  getServiceCharge: () => number
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discountCode: '',
      discountAmount: 0,
      isOpen: false,

      addItem: (menuItem, quantity = 1, extras = [], notes) => {
        set((state) => {
          const existingId = state.items.find(
            (i) =>
              i.menu_item.id === menuItem.id &&
              JSON.stringify(i.extras.map((e) => e.id).sort()) ===
                JSON.stringify(extras.map((e) => e.id).sort()),
          )?.id

          if (existingId) {
            return {
              items: state.items.map((i) =>
                i.id === existingId ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            }
          }

          const extraTotal = extras.reduce((sum, e) => sum + e.price, 0)
          const unitPrice = (menuItem.discounted_price ?? menuItem.price) + extraTotal
          const newItem: CartItem = {
            id: `${menuItem.id}-${Date.now()}`,
            menu_item: menuItem,
            quantity,
            extras,
            notes,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
          }
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) =>
        set((s) => ({
          items:
            quantity <= 0
              ? s.items.filter((i) => i.id !== id)
              : s.items.map((i) =>
                  i.id === id ? { ...i, quantity, total_price: i.unit_price * quantity } : i,
                ),
        })),

      updateNotes: (id, notes) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, notes } : i)) })),

      clearCart: () => set({ items: [], discountCode: '', discountAmount: 0 }),

      setDiscount: (discountCode, discountAmount) => set({ discountCode, discountAmount }),

      setOpen: (isOpen) => set({ isOpen }),

      getSubtotal: () => get().items.reduce((sum, i) => sum + i.total_price, 0),
      getTax: () => get().getSubtotal() * TAX_RATE,
      getServiceCharge: () => get().getSubtotal() * SERVICE_CHARGE_RATE,
      getTotal: () => {
        const sub = get().getSubtotal()
        return sub - get().discountAmount + get().getTax() + get().getServiceCharge()
      },
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: CART_KEY, storage: createDebouncedStorage(50) },
  ),
)

// ── Theme Store ───────────────────────────────────────────────────────────────
interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme })
        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.classList.toggle('dark', isDark)
      },
    }),
    { name: THEME_KEY },
  ),
)

// ── Language Store ────────────────────────────────────────────────────────────
interface LangState {
  locale: string
  setLocale: (locale: string) => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale })
        document.documentElement.lang = locale
        document.documentElement.dir = ['fa', 'ar'].includes(locale) ? 'rtl' : 'ltr'
        // Write NEXT_LOCALE cookie so server re-renders pick up the new locale.
        // SameSite=Lax; path=/ — readable by the next-intl request config on the server.
        document.cookie = `NEXT_LOCALE=${locale};path=/;SameSite=Lax`
      },
    }),
    { name: LANG_KEY },
  ),
)

// ── Tenant Store  (Phase 1A — P1A.1 / Phase 1B P1B.6) ───────────────────────
/**
 * Holds the active tenant context and the bootstrap lifecycle signals for all
 * Phase 1B subsystems. Serves as the single bootstrap coordinator for:
 *   tenantState            — tenant lifecycle (P1A.1)
 *   rbacInitialized        — RBAC system ready signal (P1B.1 stub → real in P1B.1)
 *   featureFlagsInitialized — Feature flag system ready signal (P1B.2 stub → real in P1B.2)
 *
 * The RBAC and feature flag flags are BOOTSTRAP SIGNALS, not RBAC/flag business logic.
 * They belong here because this is the bootstrap coordinator, not because the
 * tenant store knows anything about RBAC rules or feature flag values.
 *
 * Lifecycle state machine:
 *   tenantState: 'loading' → initial; 'ready' → loaded; 'fallback' → degraded
 *
 * Hydration flow:
 *   Phase 1A/1B: TenantBootstrapper calls loadTenant() and then sets both
 *   initialized flags (stub until P1B.1/P1B.2 ship their own initializers).
 *   Phase 1B (P1B.3): middleware injects X-Tenant-Slug; loadTenant() updated then.
 *
 * Persist version 1. All runtime signals excluded via partialize.
 */
interface TenantState {
  tenant: Tenant
  isLoading: boolean
  /**
   * Deterministic tenant lifecycle state. See TenantLifecycle in types/index.ts.
   * TenantState = ONLY source of tenant lifecycle truth.
   */
  tenantState: TenantLifecycle
  /**
   * True once the RBAC system has completed its initialization sequence (P1B.1).
   * Set by TenantBootstrapper via rbac.service after loadTenant() resolves.
   * Default false — canExecute blocks until RBAC is ready.
   *
   * PHASE 1B INITIALIZATION CONTRACT — P1B.1 (RBAC):
   *   The RBAC initializer MUST call useTenantStore.getState().setRbacInitialized(true)
   *   after completing auth state hydration and role resolution.
   *   Until this call is made, canExecute remains false and all Phase 1B consumers are blocked.
   */
  rbacInitialized: boolean
  /**
   * True once the feature flag system has completed its initialization sequence (P1B.2).
   * Set by TenantBootstrapper via featureFlagsService.resolve() after loadTenant() resolves.
   * Default false — canExecute blocks until feature flags are ready.
   *
   * PHASE 1B INITIALIZATION CONTRACT — P1B.2 (Feature Flags):
   *   The feature flag initializer MUST call useTenantStore.getState().setFeatureFlagsInitialized(true)
   *   after loading tenant configuration and resolving all flag values.
   *   Until this call is made, canExecute remains false and all Phase 1B consumers are blocked.
   */
  featureFlagsInitialized: boolean
  /**
   * Resolved feature flag map for the active tenant (P1B.2).
   * Populated by TenantBootstrapper after loadTenant() via featureFlagsService.resolve().
   * Empty object before initialization — missing keys default to false via useFeatureFlag().
   * NOT persisted: always recomputed from the live tenant on each page load.
   */
  featureFlags: Record<string, boolean>
  setTenant: (tenant: Tenant) => void
  loadTenant: (slug?: string) => Promise<void>
  setRbacInitialized: (v: boolean) => void
  setFeatureFlagsInitialized: (v: boolean) => void
  setFeatureFlags: (flags: Record<string, boolean>) => void
  reset: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenant: DEFAULT_TENANT,
      isLoading: false,
      tenantState: 'loading' as TenantLifecycle,
      rbacInitialized: false,
      featureFlagsInitialized: false,
      featureFlags: {},
      setTenant: (tenant) => set({ tenant }),
      loadTenant: async (slug?: string) => {
        set({ isLoading: true, tenantState: 'loading' })
        try {
          const tenant = await tenantService.getTenant(slug)
          set({ tenant, isLoading: false, tenantState: 'ready' })
        } catch {
          // Network or service failure — discard any stale persisted tenant,
          // degrade to DEFAULT_TENANT, and advance to 'fallback' so downstream
          // systems are not blocked indefinitely on an unresolvable load.
          set({ tenant: DEFAULT_TENANT, isLoading: false, tenantState: 'fallback' })
        }
      },
      setRbacInitialized: (v) => set({ rbacInitialized: v }),
      setFeatureFlagsInitialized: (v) => set({ featureFlagsInitialized: v }),
      setFeatureFlags: (flags) => set({ featureFlags: flags }),
      // reset() returns ALL runtime signals to their pre-bootstrap state.
      reset: () => set({
        tenant: DEFAULT_TENANT,
        isLoading: false,
        tenantState: 'loading',
        rbacInitialized: false,
        featureFlagsInitialized: false,
        featureFlags: {},
      }),
    }),
    {
      name: TENANT_KEY,
      version: 1,
      migrate: () => ({ tenant: DEFAULT_TENANT }),
      // Only tenant is persisted. All runtime signals start fresh on every page
      // load: tenantState = 'loading', rbacInitialized = false, featureFlagsInitialized = false.
      partialize: (state) => ({ tenant: state.tenant }),
    },
  ),
)

// ── Branch Store ──────────────────────────────────────────────────────────────
interface BranchState {
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranch: null,
      setActiveBranch: (activeBranch) => set({ activeBranch }),
    }),
    { name: BRANCH_KEY },
  ),
)

// ── Notification Store ────────────────────────────────────────────────────────
interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (n: Notification[]) => void
  addNotification: (n: Notification) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + (n.is_read ? 0 : 1),
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}))

// ── Favorites Store ───────────────────────────────────────────────────────────
interface FavoritesState {
  favorites: Set<string>
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  setFavorites: (ids: string[]) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(),
      toggleFavorite: (id) =>
        set((s) => {
          const next = new Set(s.favorites)
          next.has(id) ? next.delete(id) : next.add(id)
          return { favorites: next }
        }),
      isFavorite: (id) => get().favorites.has(id),
      setFavorites: (ids) => set({ favorites: new Set(ids) }),
    }),
    {
      name: 'savor-favorites',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const { state, version } = JSON.parse(str)
          return { state: { ...state, favorites: new Set(state.favorites) }, version }
        },
        setItem: (name, value) => {
          const str = JSON.stringify({
            ...value,
            state: { ...value.state, favorites: Array.from(value.state.favorites) },
          })
          localStorage.setItem(name, str)
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
)

// ── Recently Viewed ───────────────────────────────────────────────────────────
interface RecentlyViewedState {
  items: MenuItem[]
  addItem: (item: MenuItem) => void
  clear: () => void
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((s) => ({
          items: [item, ...s.items.filter((i) => i.id !== item.id)].slice(0, 10),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'savor-recently-viewed' },
  ),
)

// ── Dine-In Store (P4.4) ──────────────────────────────────────────────────────
// Persists the active table number so it survives navigation from /table/[tableId]
// → /menu → /checkout without requiring the ?table= URL param to be carried through.
interface DineInState {
  tableNumber: number | null
  setTableNumber: (n: number | null) => void
  clearTable: () => void
}

export const useDineInStore = create<DineInState>()(
  persist(
    (set) => ({
      tableNumber: null,
      setTableNumber: (tableNumber) => set({ tableNumber }),
      clearTable: () => set({ tableNumber: null }),
    }),
    { name: DINE_IN_KEY },
  ),
)
