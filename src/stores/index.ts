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
import type { Branch as AdminBranch } from '@/types/branch'
import type { Role } from '@/types/rbac'
import type { TenantRoleAssignment, UserPermissionOverride, CustomRoleTemplate, RbacAuditEvent } from '@/types/rbac'
import { BRANCH_KEY, CART_KEY, DINE_IN_KEY, LANG_KEY, TAX_RATE, SERVICE_CHARGE_RATE, TENANT_KEY, THEME_KEY } from '@/constants'
import {
  tenantService,
  TenantNotFoundError,
  TenantForbiddenError,
  ELIGIBLE_TENANT_STATUSES,
} from '@/services/tenant.service'
import { getDirection } from '@/i18n/runtime'

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
          // Branch isolation: a cart can only ever hold one branch's items.
          // Adding an item from a different branch than what's currently in
          // the cart starts a fresh cart instead of mixing branches together.
          const items = state.items.length > 0 && state.items[0].branch_id !== menuItem.branch_id
            ? []
            : state.items

          const existingId = items.find(
            (i) =>
              i.menu_item.id === menuItem.id &&
              JSON.stringify(i.extras.map((e) => e.id).sort()) ===
                JSON.stringify(extras.map((e) => e.id).sort()),
          )?.id

          if (existingId) {
            return {
              items: items.map((i) =>
                i.id === existingId ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            }
          }

          const extraTotal = extras.reduce((sum, e) => sum + e.price, 0)
          const unitPrice = (menuItem.discounted_price ?? menuItem.price) + extraTotal
          const newItem: CartItem = {
            id: `${menuItem.id}-${Date.now()}`,
            branch_id: menuItem.branch_id,
            menu_item: menuItem,
            quantity,
            extras,
            notes,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
          }
          return { items: [...items, newItem] }
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
        // P9.5.1A: RTL detection now goes through the Localization Runtime
        // Service (config-driven `languages.rtl_locales`) instead of a
        // hardcoded literal — see src/i18n/runtime.ts's isRTLLocale().
        document.documentElement.dir = getDirection(locale)
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
  /**
   * `null` in every state except 'resolved'. There is no fallback/placeholder
   * tenant object — a failed or pending resolution is represented by
   * `tenant === null` plus the specific `tenantState`, never by substituting
   * DEFAULT_TENANT or any other stand-in. Consumers (Console pages, guards)
   * must treat `tenant` as unusable unless `tenantState === 'resolved'`.
   */
  tenant: Tenant | null
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
  setTenant: (tenant: Tenant | null) => void
  loadTenant: (slug?: string) => Promise<void>
  setRbacInitialized: (v: boolean) => void
  setFeatureFlagsInitialized: (v: boolean) => void
  setFeatureFlags: (flags: Record<string, boolean>) => void
  reset: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenant: null,
      isLoading: false,
      tenantState: 'loading' as TenantLifecycle,
      rbacInitialized: false,
      featureFlagsInitialized: false,
      featureFlags: {},
      setTenant: (tenant) => set({ tenant }),
      loadTenant: async (slug?: string) => {
        set({ isLoading: true, tenantState: 'loading', tenant: null })
        try {
          const tenant = await tenantService.getTenant(slug)
          // A tenant record can be fetched successfully and still be
          // ineligible (suspended/archived/churned) — that is access denial,
          // not a resolved, usable tenant. Console must never render against it.
          if (!ELIGIBLE_TENANT_STATUSES.includes(tenant.status)) {
            set({ tenant: null, isLoading: false, tenantState: 'forbidden' })
            return
          }
          set({ tenant, isLoading: false, tenantState: 'resolved' })
        } catch (err) {
          // Never substitute a fake tenant here. Classify the failure and
          // leave `tenant` null so nothing downstream can mistake an
          // unresolved tenant for a real one.
          if (err instanceof TenantNotFoundError) {
            set({ tenant: null, isLoading: false, tenantState: 'not_found' })
          } else if (err instanceof TenantForbiddenError) {
            set({ tenant: null, isLoading: false, tenantState: 'forbidden' })
          } else {
            set({ tenant: null, isLoading: false, tenantState: 'error' })
          }
        }
      },
      setRbacInitialized: (v) => set({ rbacInitialized: v }),
      setFeatureFlagsInitialized: (v) => set({ featureFlagsInitialized: v }),
      setFeatureFlags: (flags) => set({ featureFlags: flags }),
      // reset() returns ALL runtime signals to their pre-bootstrap state.
      reset: () => set({
        tenant: null,
        isLoading: false,
        tenantState: 'loading',
        rbacInitialized: false,
        featureFlagsInitialized: false,
        featureFlags: {},
      }),
    }),
    {
      name: TENANT_KEY,
      version: 2,
      migrate: () => ({}),
      // Nothing meaningful is persisted anymore. `tenant` must always come
      // from a fresh, revalidated loadTenant() call — a persisted tenant
      // object would be exactly the kind of unverified "hint treated as
      // fact" this refactor removes. The actual slug hint used to kick off
      // that fresh fetch comes from the server-injected x-tenant-slug meta
      // tag / NEXT_PUBLIC_TENANT_SLUG (see providers/index.tsx's
      // readTenantSlug()), not from this store's persistence at all.
      partialize: () => ({}),
    },
  ),
)

// ── Branch Store ──────────────────────────────────────────────────────────────
interface BranchState {
  /** Public-facing branch (Location alias) used by the customer-facing header/BranchSelector. */
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch) => void
  /** Admin-selected branch with full AdminBranch data (tenantId, settings, businessHours, etc.).
   *  Set by the AdminBranchSwitcher. Used for context-aware preview URLs and admin scoping. */
  adminActiveBranch: AdminBranch | null
  setAdminActiveBranch: (branch: AdminBranch | null) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      activeBranch: null,
      setActiveBranch: (activeBranch) => {
        const previous = get().activeBranch
        // Switching to a different branch must never carry over another
        // branch's cached cart — the menu (and therefore valid item ids,
        // prices, extras) is entirely different per branch.
        if (previous && previous.slug !== activeBranch.slug) {
          useCartStore.getState().clearCart()
        }
        set({ activeBranch })
      },
      adminActiveBranch: null,
      setAdminActiveBranch: (adminActiveBranch) => set({ adminActiveBranch }),
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
      name: 'samoon-favorites',
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
    { name: 'samoon-recently-viewed' },
  ),
)

// ── RBAC Store (P7.1) ─────────────────────────────────────────────────────────
/**
 * Tracks tenant-scoped role assignments for the current session.
 * Role assignments are per-tenant — a user may have different roles across tenants.
 *
 * Write path: call setTenantRoles(tenantId, roles) during auth initialization
 * or after the backend confirms a role assignment change.
 *
 * Read path: hooks read tenantRoles + current tenant ID from useTenantStore
 * to derive effective roles for permission checks.
 */
// ── P8.5: Extended RBAC store with overrides and branch scope ─────────────────

interface RbacStoreState {
  // Tenant-scoped role assignments
  //
  // P10.7 Phase F — TRANSITIONAL PERSISTED FIELD. `tenantRoles` is still
  // persisted to localStorage (see the `persist(..., { name: 'samoon-rbac' })`
  // call below — no `partialize` yet). This is a KNOWN, DOCUMENTED gap,
  // not an oversight: docs/P10.5.5_RBAC_REAL_MODE_SECURITY.md §3 and
  // docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md §3 both cover why it
  // hasn't been removed yet — AuthBootstrapper's session-restore path
  // (src/providers/index.tsx) now ALSO hydrates this field from
  // authService.getMe() (P10.7 Phase A/D), which is the precondition
  // that makes removing localStorage persistence safe. Once real-mode
  // getMe()/login() reliably return `tenantRoles` from a trusted
  // backend (not just mock mode, which this phase already covers), a
  // future phase should add a `partialize` to the `persist()` config
  // below excluding this field — do NOT do that yet; mock-mode session
  // restore still depends on it until that precondition is fully met.
  tenantRoles: TenantRoleAssignment[]
  setTenantRoles: (tenantId: string, roles: Role[]) => void
  addRole: (tenantId: string, role: Role) => void
  removeRole: (tenantId: string, role: Role) => void
  clearRoles: () => void
  getRolesForTenant: (tenantId: string) => Role[]

  // P8.5: Per-user permission overrides (admin-managed)
  //
  // P10.7 Phase F — also a TRANSITIONAL PERSISTED FIELD, same rationale
  // as `tenantRoles` above. Unlike `tenantRoles`, no session-restore path
  // populates this from a backend yet — there is no backend endpoint for
  // overrides at all (docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md §4
  // proposes one). Remove from persistence in the same future phase that
  // wires that endpoint in, not before.
  userOverrides: UserPermissionOverride[]
  setUserOverride: (userId: string, tenantId: string, allow: import('@/types/rbac').P7Permission[], deny: import('@/types/rbac').P7Permission[]) => void
  clearUserOverride: (userId: string, tenantId: string) => void
  getUserOverride: (userId: string, tenantId: string) => UserPermissionOverride | undefined

  // P8.6: Custom role templates (tenant-admin managed)
  customRoles: CustomRoleTemplate[]
  addCustomRole: (role: CustomRoleTemplate) => void
  updateCustomRole: (roleId: string, updates: Partial<Omit<CustomRoleTemplate, 'id'>>) => void
  deleteCustomRole: (roleId: string) => void
  getCustomRoles: (tenantId: string) => CustomRoleTemplate[]

  // P8.6: In-session RBAC audit trail
  rbacAuditLog: RbacAuditEvent[]
  addRbacAuditEvent: (event: RbacAuditEvent) => void
  getRbacAuditLog: (tenantId: string) => RbacAuditEvent[]
  clearRbacAuditLog: (tenantId: string) => void

  _resetStore: () => void
}

export const useRbacStore = create<RbacStoreState>()(
  persist(
    (set, get) => ({
      tenantRoles: [],
      userOverrides: [],
      customRoles: [],
      rbacAuditLog: [],

      setTenantRoles: (tenantId, roles) =>
        set((s) => {
          const filtered = s.tenantRoles.filter((t) => t.tenantId !== tenantId)
          return { tenantRoles: [...filtered, { tenantId, roles: [...new Set(roles)] }] }
        }),

      addRole: (tenantId, role) =>
        set((s) => {
          const existing = s.tenantRoles.find((t) => t.tenantId === tenantId)
          if (existing) {
            if (existing.roles.includes(role)) return s
            return {
              tenantRoles: s.tenantRoles.map((t) =>
                t.tenantId === tenantId ? { ...t, roles: [...t.roles, role] } : t,
              ),
            }
          }
          return { tenantRoles: [...s.tenantRoles, { tenantId, roles: [role] }] }
        }),

      removeRole: (tenantId, role) =>
        set((s) => ({
          tenantRoles: s.tenantRoles.map((t) =>
            t.tenantId === tenantId ? { ...t, roles: t.roles.filter((r) => r !== role) } : t,
          ),
        })),

      clearRoles: () => set({ tenantRoles: [] }),

      getRolesForTenant: (tenantId) => {
        return get().tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
      },

      // User overrides
      setUserOverride: (userId, tenantId, allow, deny) =>
        set((s) => {
          const filtered = s.userOverrides.filter(
            (o) => !(o.userId === userId && o.tenantId === tenantId),
          )
          return { userOverrides: [...filtered, { userId, tenantId, allow, deny }] }
        }),

      clearUserOverride: (userId, tenantId) =>
        set((s) => ({
          userOverrides: s.userOverrides.filter(
            (o) => !(o.userId === userId && o.tenantId === tenantId),
          ),
        })),

      getUserOverride: (userId, tenantId) =>
        get().userOverrides.find((o) => o.userId === userId && o.tenantId === tenantId),

      // P8.6: Custom role templates
      addCustomRole: (role) =>
        set((s) => ({
          customRoles: [...s.customRoles.filter((r) => r.id !== role.id), role],
        })),
      updateCustomRole: (roleId, updates) =>
        set((s) => ({
          customRoles: s.customRoles.map((r) =>
            r.id === roleId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r,
          ),
        })),
      deleteCustomRole: (roleId) =>
        set((s) => ({ customRoles: s.customRoles.filter((r) => r.id !== roleId) })),
      getCustomRoles: (tenantId) =>
        get().customRoles.filter((r) => r.tenantId === tenantId),

      // P8.6: RBAC audit trail
      addRbacAuditEvent: (event) =>
        set((s) => ({ rbacAuditLog: [event, ...s.rbacAuditLog].slice(0, 500) })),
      getRbacAuditLog: (tenantId) =>
        get().rbacAuditLog.filter((e) => e.tenantId === tenantId),
      clearRbacAuditLog: (tenantId) =>
        set((s) => ({ rbacAuditLog: s.rbacAuditLog.filter((e) => e.tenantId !== tenantId) })),

      _resetStore: () => set({
        tenantRoles: [],
        userOverrides: [],
        customRoles: [],
        rbacAuditLog: [],
      }),
    }),
    // P10.7 Phase F — deliberately unchanged. No `partialize` yet: see
    // the `tenantRoles`/`userOverrides` field comments above for why
    // both are still fully persisted, and what precondition must be met
    // before a future phase adds one.
    { name: 'samoon-rbac' },
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
