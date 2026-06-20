import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Branch, CartItem, Extra, MenuItem, Notification, Tenant, TenantLifecycle, User } from '@/types'
import { BRANCH_KEY, CART_KEY, DEFAULT_TENANT, LANG_KEY, TAX_RATE, SERVICE_CHARGE_RATE, TENANT_KEY, THEME_KEY } from '@/constants'
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
    { name: CART_KEY },
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
      },
    }),
    { name: LANG_KEY },
  ),
)

// ── Tenant Store  (Phase 1A — P1A.1 / Phase 1B stabilization) ───────────────
/**
 * Holds the active tenant context for the session.
 * Initialises from DEFAULT_TENANT (single-tenant backward compatibility, P1A.4).
 *
 * Lifecycle state machine (Phase 1B):
 *   tenantState drives all Phase 1B system decisions. Transitions:
 *
 *     'loading'  → initial state; TenantBootstrapper has not yet completed
 *     'ready'    → loadTenant() succeeded; tenant is from a verified source
 *     'fallback' → loadTenant() failed; tenant is DEFAULT_TENANT
 *
 *   tenantState is NOT persisted — it is a runtime-only value, always 'loading'
 *   at page load so the bootstrap sequence runs on every visit.
 *
 * Hydration flow:
 *   Phase 1A/1B: TenantBootstrapper calls loadTenant() in Providers.
 *   Phase 1B (P1B.3): middleware will inject X-Tenant-Slug from the subdomain;
 *   loadTenant(slug) will be updated to pass that slug at that point.
 *
 * Persist version 1 — any cached v0 state is discarded on first load.
 * tenantState is excluded from persist via partialize.
 */
interface TenantState {
  tenant: Tenant
  isLoading: boolean
  /**
   * Deterministic lifecycle state for the tenant bootstrap sequence.
   * See TenantLifecycle in types/index.ts for the full state contract.
   * All Phase 1B systems (RBAC, feature flags, routing) must branch on this.
   */
  tenantState: TenantLifecycle
  setTenant: (tenant: Tenant) => void
  loadTenant: (slug?: string) => Promise<void>
  reset: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenant: DEFAULT_TENANT,
      isLoading: false,
      tenantState: 'loading' as TenantLifecycle,
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
      reset: () => set({ tenant: DEFAULT_TENANT, isLoading: false, tenantState: 'loading' }),
    }),
    {
      name: TENANT_KEY,
      version: 1,
      migrate: () => ({ tenant: DEFAULT_TENANT, isLoading: false, tenantState: 'loading' as TenantLifecycle }),
      // tenantState and isLoading are runtime-only — exclude from localStorage
      // so the bootstrap sequence always runs fresh on every page load.
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
