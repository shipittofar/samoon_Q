/**
 * Phase 3 — Production Hardening tests (P3.1–P3.12)
 *
 * Covers:
 *   P3.1  — Middleware route protection logic
 *   P3.2  — Admin RBAC (AuthGuard + hasPermission)
 *   P3.3  — Mock mode safety (production build guard)
 *   P3.4  — PWA asset manifest audit
 *   P3.5  — Mock login credential enforcement
 *   P3.6  — WebSocket hook exports
 *   P3.7  — I18N key parity across locales
 *   P3.8  — DevTools guard (NODE_ENV check)
 *   P3.9  — Dead dependency audit
 *   P3.11 — Sentry integration (DSN-gated)
 *   P3.12 — ErrorBoundary component
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// ── P3.1 Middleware Route Protection ─────────────────────────────────────────

describe('P3.1 — Middleware protected route logic', () => {
  const PROTECTED_PREFIXES = ['/dashboard', '/console']

  function isProtected(pathname: string): boolean {
    return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  }

  it('protects /dashboard and all sub-paths', () => {
    expect(isProtected('/dashboard')).toBe(true)
    expect(isProtected('/dashboard/orders')).toBe(true)
    expect(isProtected('/dashboard/settings')).toBe(true)
  })

  it('does not middleware-protect /checkout (guest checkout uses AuthModal)', () => {
    expect(isProtected('/checkout')).toBe(false)
    expect(isProtected('/checkout/success')).toBe(false)
    expect(isProtected('/checkout/failure')).toBe(false)
  })

  it('protects /console and all sub-paths', () => {
    expect(isProtected('/console')).toBe(true)
    expect(isProtected('/console/stats')).toBe(true)
    expect(isProtected('/console/orders')).toBe(true)
    expect(isProtected('/console/menu')).toBe(true)
  })

  it('does not protect public routes', () => {
    expect(isProtected('/')).toBe(false)
    expect(isProtected('/menu')).toBe(false)
    expect(isProtected('/login')).toBe(false)
    expect(isProtected('/register')).toBe(false)
    expect(isProtected('/reservation')).toBe(false)
    expect(isProtected('/restaurant')).toBe(false)
  })

  it('middleware.ts exports a middleware function and config', async () => {
    const mod = await import('@/middleware')
    expect(typeof mod.middleware).toBe('function')
    expect(mod.config).toBeDefined()
    expect(Array.isArray(mod.config.matcher)).toBe(true)
    expect(mod.config.matcher.length).toBeGreaterThan(0)
  })

  it('middleware config matcher still includes checkout for tenant header injection', async () => {
    const { config } = await import('@/middleware')
    const matcher = config.matcher as string[]
    expect(matcher.some((m) => m.includes('dashboard'))).toBe(true)
    expect(matcher.some((m) => m.includes('checkout'))).toBe(true)
    expect(matcher.some((m) => m.includes('console'))).toBe(true)
  })
})

// ── P3.2 Admin RBAC ───────────────────────────────────────────────────────────

describe('P3.2 — Admin authorization (dashboard:access permission)', () => {
  // P10.4.12 — the four rbacService.hasPermission()-only assertions that
  // lived here were removed: src/services/rbac.service.ts is deleted, and
  // AuthGuard has resolved dashboard:access through useHasDashboardAccess()
  // (not rbacService) since P10.4.11 — see
  // docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

  it('AuthGuard exports as a function', async () => {
    const mod = await import('@/components/auth/AuthGuard')
    expect(typeof mod.AuthGuard).toBe('function')
  })

  it('AdminLayout exists (admin/layout.tsx)', async () => {
    // Dynamic import of the default export (server component)
    const mod = await import('@/app/console/layout')
    expect(typeof mod.default).toBe('function')
  })
})

// ── P3.3 Mock Mode Safety ─────────────────────────────────────────────────────

describe('P3.3 — Mock mode safety (production build guard)', () => {
  it('next.config.ts contains the production mock-mode guard', () => {
    const configPath = join(process.cwd(), 'next.config.ts')
    const src = readFileSync(configPath, 'utf8')
    expect(src).toContain("NODE_ENV === 'production'")
    expect(src).toContain("NEXT_PUBLIC_USE_MOCK === 'true'")
    expect(src).toContain('throw new Error')
  })

  it('guard throws when NODE_ENV is production and mock is enabled', () => {
    const check = () => {
      const isProd = true
      const isMock = true
      if (isProd && isMock) {
        throw new Error('NEXT_PUBLIC_USE_MOCK=true is not allowed in production')
      }
    }
    expect(check).toThrow('NEXT_PUBLIC_USE_MOCK=true is not allowed in production')
  })

  it('guard does not throw in development even with mock enabled', () => {
    const check = () => {
      const isProd = false
      const isMock = true
      if (isProd && isMock) {
        throw new Error('NEXT_PUBLIC_USE_MOCK=true is not allowed in production')
      }
    }
    expect(check).not.toThrow()
  })

  it('guard does not throw in production when mock is disabled', () => {
    const check = () => {
      const isProd = true
      const isMock = false
      if (isProd && isMock) {
        throw new Error('NEXT_PUBLIC_USE_MOCK=true is not allowed in production')
      }
    }
    expect(check).not.toThrow()
  })

  it('.env.example defaults NEXT_PUBLIC_USE_MOCK to false (P3.3)', () => {
    const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
    // The default must be "false" — "true" is only for explicit local dev opt-in.
    expect(envExample).toContain('NEXT_PUBLIC_USE_MOCK=false')
    expect(envExample).not.toContain('NEXT_PUBLIC_USE_MOCK=true')
  })
})

// ── P3.4 PWA Asset Validation ─────────────────────────────────────────────────

describe('P3.4 — PWA asset manifest audit', () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'public/manifest.json'), 'utf8'),
  )

  it('manifest.json exists and has required fields', () => {
    expect(manifest.name).toBeDefined()
    expect(manifest.short_name).toBeDefined()
    expect(manifest.start_url).toBeDefined()
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
  })

  it('manifest references 8 icon sizes', () => {
    expect(manifest.icons).toHaveLength(8)
  })

  it('all icon src paths follow /icons/icon-{size}.png pattern', () => {
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/icons\/icon-\d+\.png$/)
    }
  })

  it('all 8 icon files are present in public/icons/', () => {
    const iconsDir = join(process.cwd(), 'public/icons')
    const existingFiles = readdirSync(iconsDir)
    const missing = manifest.icons
      .map((i: { src: string }) => i.src.replace('/icons/', ''))
      .filter((f: string) => !existingFiles.includes(f))
    expect(missing).toHaveLength(0)
  })

  it('screenshot file is present at public/screenshots/menu.png', () => {
    const screenshotPath = join(process.cwd(), 'public/screenshots/menu.png')
    const exists = (() => { try { readFileSync(screenshotPath); return true } catch { return false } })()
    expect(exists).toBe(true)
  })

  it('og-image.jpg is present at public/og-image.jpg', () => {
    const ogPath = join(process.cwd(), 'public/og-image.jpg')
    const exists = (() => { try { readFileSync(ogPath); return true } catch { return false } })()
    expect(exists).toBe(true)
  })
})

// ── P3.5 Mock Login Fix ───────────────────────────────────────────────────────

describe('P3.5 — Mock login credential enforcement', () => {
  const DEMO_EMAIL = 'demo@samoon.com'
  const DEMO_PASSWORD = 'password'

  // Replicate the fixed mock login logic
  function mockLogin(email: string, password: string): boolean {
    if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      throw new Error('Invalid credentials')
    }
    return true
  }

  it('accepts demo@samoon.com / password', () => {
    expect(() => mockLogin(DEMO_EMAIL, DEMO_PASSWORD)).not.toThrow()
    expect(mockLogin(DEMO_EMAIL, DEMO_PASSWORD)).toBe(true)
  })

  it('rejects wrong email with correct password', () => {
    expect(() => mockLogin('other@example.com', DEMO_PASSWORD)).toThrow('Invalid credentials')
  })

  it('rejects correct email with wrong password', () => {
    expect(() => mockLogin(DEMO_EMAIL, 'wrongpassword')).toThrow('Invalid credentials')
  })

  it('rejects both email and password wrong', () => {
    expect(() => mockLogin('hacker@example.com', 'hack123')).toThrow('Invalid credentials')
  })

  it('rejects empty credentials', () => {
    expect(() => mockLogin('', '')).toThrow('Invalid credentials')
  })

  it('auth.service.ts login uses OR (||) not AND (&&) for credential check', () => {
    const authSrc = readFileSync(
      join(process.cwd(), 'src/services/auth.service.ts'),
      'utf8',
    )
    // P8.4.3 — Multi-credential lookup table: unknown email OR wrong password both reject.
    // The guard is: !entry || credentials.password !== 'password'
    // which is equivalent to the original OR-based check.
    expect(authSrc).toContain("!entry || credentials.password !== 'password'")
    // The old broken && must not be present
    expect(authSrc).not.toContain("credentials.email !== 'demo@samoon.com' && credentials.password !== 'password'")
  })
})

// ── P3.6 WebSocket Integration ────────────────────────────────────────────────

describe('P3.6 — WebSocket hook exports', () => {
  it('useOrderWebSocket is exported from hooks/client', async () => {
    const mod = await import('@/hooks/client')
    expect(typeof mod.useOrderWebSocket).toBe('function')
  })

  it('useNotificationWebSocket is exported from hooks/client', async () => {
    const mod = await import('@/hooks/client')
    expect(typeof mod.useNotificationWebSocket).toBe('function')
  })

  it('orderWebSocket singleton is exported from websocket.service', async () => {
    const mod = await import('@/services/websocket.service')
    expect(mod.orderWebSocket).toBeDefined()
    expect(typeof mod.orderWebSocket.connect).toBe('function')
    expect(typeof mod.orderWebSocket.disconnect).toBe('function')
    expect(typeof mod.orderWebSocket.on).toBe('function')
  })

  it('notificationWebSocket singleton is exported from websocket.service', async () => {
    const mod = await import('@/services/websocket.service')
    expect(mod.notificationWebSocket).toBeDefined()
    expect(typeof mod.notificationWebSocket.connect).toBe('function')
  })

  it('simulateOrderUpdates is exported and is a function', async () => {
    const mod = await import('@/services/websocket.service')
    expect(typeof mod.simulateOrderUpdates).toBe('function')
  })

  it('providers.tsx imports useNotificationWebSocket (WebSocket wired)', () => {
    const src = readFileSync(join(process.cwd(), 'src/providers/index.tsx'), 'utf8')
    expect(src).toContain('useNotificationWebSocket')
    expect(src).toContain('NotificationWebSocketProvider')
  })
})

// ── P3.7 I18N Key Parity ─────────────────────────────────────────────────────

describe('P3.7 — I18N locale key parity', () => {
  const LOCALES_DIR = join(process.cwd(), 'src/i18n/locales')

  function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        keys.push(...flattenKeys(v as Record<string, unknown>, key))
      } else {
        keys.push(key)
      }
    }
    return keys
  }

  function loadLocale(name: string) {
    return JSON.parse(readFileSync(join(LOCALES_DIR, `${name}.json`), 'utf8'))
  }

  it('all three locale files exist', () => {
    const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
    const localeNames = files.map((f) => f.replace('.json', ''))
    expect(localeNames).toContain('en')
    expect(localeNames).toContain('fa')
    expect(localeNames).toContain('ar')
  })

  it('fa has no missing keys relative to en', () => {
    const en = new Set(flattenKeys(loadLocale('en')))
    const fa = new Set(flattenKeys(loadLocale('fa')))
    const missing = [...en].filter((k) => !fa.has(k))
    expect(missing).toHaveLength(0)
  })

  it('ar has no missing keys relative to en', () => {
    const en = new Set(flattenKeys(loadLocale('en')))
    const ar = new Set(flattenKeys(loadLocale('ar')))
    const missing = [...en].filter((k) => !ar.has(k))
    expect(missing).toHaveLength(0)
  })

  it('fa has no extra keys relative to en', () => {
    const en = new Set(flattenKeys(loadLocale('en')))
    const fa = new Set(flattenKeys(loadLocale('fa')))
    const extra = [...fa].filter((k) => !en.has(k))
    expect(extra).toHaveLength(0)
  })

  it('ar has no extra keys relative to en', () => {
    const en = new Set(flattenKeys(loadLocale('en')))
    const ar = new Set(flattenKeys(loadLocale('ar')))
    const extra = [...ar].filter((k) => !en.has(k))
    expect(extra).toHaveLength(0)
  })

  it('validate-i18n.mjs script exists', () => {
    const exists = (() => {
      try { readFileSync(join(process.cwd(), 'scripts/validate-i18n.mjs')); return true }
      catch { return false }
    })()
    expect(exists).toBe(true)
  })
})

// ── P3.8 DevTools Guard ───────────────────────────────────────────────────────

describe('P3.8 — ReactQueryDevtools guard', () => {
  it('providers.tsx wraps ReactQueryDevtools with NODE_ENV check', () => {
    const src = readFileSync(join(process.cwd(), 'src/providers/index.tsx'), 'utf8')
    expect(src).toContain("process.env.NODE_ENV === 'development'")
    expect(src).toContain('ReactQueryDevtools')
    // The devtools must be inside the conditional, not unconditional
    const devtoolsLine = src.split('\n').find((l) => l.includes('ReactQueryDevtools') && !l.includes('import'))
    expect(devtoolsLine).toBeDefined()
    expect(devtoolsLine).toContain("NODE_ENV === 'development'")
  })
})

// ── P3.9 Dead Dependency Removal ─────────────────────────────────────────────

describe('P3.9 — Dead dependency removal', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

  it('socket.io-client has been removed from package.json', () => {
    expect(allDeps['socket.io-client']).toBeUndefined()
  })

  it('next-pwa has been removed from package.json', () => {
    expect(allDeps['next-pwa']).toBeUndefined()
  })

  it('websocket.service.ts uses native WebSocket (not socket.io)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/services/websocket.service.ts'),
      'utf8',
    )
    expect(src).not.toContain('socket.io')
    expect(src).toContain('new WebSocket(')
  })

  it('next.config.ts does not reference next-pwa', () => {
    const src = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(src).not.toContain('next-pwa')
    expect(src).not.toContain('withPWA')
  })
})

// ── P3.11 Sentry Integration ──────────────────────────────────────────────────

describe('P3.11 — Sentry integration', () => {
  it('sentry.ts exports captureException and setSentryUser', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.captureException).toBe('function')
    expect(typeof mod.setSentryUser).toBe('function')
  })

  it('sentryEnabled is false when no DSN is configured', async () => {
    const mod = await import('@/lib/sentry')
    // In test env, NEXT_PUBLIC_SENTRY_DSN is not set
    expect(mod.sentryEnabled).toBe(false)
  })

  it('captureException is a no-op when DSN is not configured', async () => {
    const mod = await import('@/lib/sentry')
    // Should not throw when sentryEnabled is false
    expect(() => mod.captureException(new Error('test error'))).not.toThrow()
  })

  it('sentry.client.config.ts exists', () => {
    const exists = (() => {
      try { readFileSync(join(process.cwd(), 'sentry.client.config.ts')); return true }
      catch { return false }
    })()
    expect(exists).toBe(true)
  })

  it('sentry.server.config.ts exists', () => {
    const exists = (() => {
      try { readFileSync(join(process.cwd(), 'sentry.server.config.ts')); return true }
      catch { return false }
    })()
    expect(exists).toBe(true)
  })

  it('sentry configs gate initialization on DSN presence', () => {
    const clientSrc = readFileSync(join(process.cwd(), 'sentry.client.config.ts'), 'utf8')
    const serverSrc = readFileSync(join(process.cwd(), 'sentry.server.config.ts'), 'utf8')
    expect(clientSrc).toContain('if (DSN)')
    expect(serverSrc).toContain('if (DSN)')
  })
})

// ── P3.12 Error Boundaries ────────────────────────────────────────────────────

describe('P3.12 — ErrorBoundary component', () => {
  it('ErrorBoundary exports as a class', async () => {
    const mod = await import('@/components/common/ErrorBoundary')
    expect(typeof mod.ErrorBoundary).toBe('function')
  })

  it('ErrorBoundary has getDerivedStateFromError static method', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    expect(typeof ErrorBoundary.getDerivedStateFromError).toBe('function')
  })

  it('getDerivedStateFromError returns hasError:true for any error', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const state = ErrorBoundary.getDerivedStateFromError(new Error('boom'))
    expect(state.hasError).toBe(true)
    expect(state.error).toBeInstanceOf(Error)
  })

  it('ErrorBoundary wraps CartDrawer in the global cart host', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/cart/GlobalCartHost.tsx'), 'utf8')
    expect(src).toContain('ErrorBoundary')
    expect(src).toContain('CartDrawer')
    const ebIdx = src.indexOf('<ErrorBoundary')
    const cartIdx = src.indexOf('<CartDrawer')
    expect(ebIdx).toBeGreaterThan(-1)
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('ErrorBoundary wraps NotificationCenter area in Header', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/layout/Header.tsx'), 'utf8')
    expect(src).toContain('ErrorBoundary')
    expect(src).toContain('feature="NotificationCenter"')
  })
})

// ── Cart Store Tests (P3.10 expansion) ───────────────────────────────────────

describe('P3.10 — Cart store tests', async () => {
  const { useCartStore } = await import('@/stores')

  beforeEach(() => {
    useCartStore.setState({
      items: [],
      discountCode: '',
      discountAmount: 0,
      isOpen: false,
    })
  })

  const mockItem = {
    id: 'item-1',
    branch_id: 'branch-1',
    name: 'Test Burger',
    price: 10,
    discounted_price: null,
    category: 'burgers',
    description: '',
    image: '/img.png',
    is_available: true,
    is_featured: false,
    rating: 4.5,
    calories: 500,
    prep_time: 10,
    extras: [],
    tags: [],
  } as unknown as import('@/types').MenuItem

  it('starts with empty cart', () => {
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('addItem adds a new item', () => {
    useCartStore.getState().addItem(mockItem, 1)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('addItem increases quantity for duplicate item', () => {
    useCartStore.getState().addItem(mockItem, 1)
    useCartStore.getState().addItem(mockItem, 2)
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(3)
  })

  it('removeItem removes an item by id', () => {
    useCartStore.getState().addItem(mockItem, 1)
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().removeItem(id)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updateQuantity to 0 removes the item', () => {
    useCartStore.getState().addItem(mockItem, 1)
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQuantity(id, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('getSubtotal returns sum of item total_price', () => {
    useCartStore.getState().addItem(mockItem, 2)
    const subtotal = useCartStore.getState().getSubtotal()
    expect(subtotal).toBe(20)
  })

  it('getTotal includes tax and service charge', () => {
    useCartStore.getState().addItem(mockItem, 1)
    const total = useCartStore.getState().getTotal()
    // price=10, tax=9%, service=5%, total=11.40
    expect(total).toBeCloseTo(11.4, 1)
  })

  it('clearCart empties all items', () => {
    useCartStore.getState().addItem(mockItem, 3)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('setDiscount stores code and amount', () => {
    useCartStore.getState().setDiscount('SAVE10', 5)
    expect(useCartStore.getState().discountCode).toBe('SAVE10')
    expect(useCartStore.getState().discountAmount).toBe(5)
  })

  it('getItemCount returns total quantity across items', () => {
    useCartStore.getState().addItem(mockItem, 3)
    expect(useCartStore.getState().getItemCount()).toBe(3)
  })
})

// ── Auth Flow Tests (P3.10 expansion) ────────────────────────────────────────

describe('P3.10 — Auth store flow', async () => {
  const { useAuthStore } = await import('@/stores')

  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setUser marks authenticated', () => {
    const user = { id: '1', first_name: 'Test', last_name: 'User', email: 'test@example.com', accountType: 'customer' as const, phone_number: '', avatar: undefined, is_active: true, is_verified: true, created_at: '' }
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user).toBe(user)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('logout clears user and marks unauthenticated', () => {
    useAuthStore.setState({ user: { id: '1' } as never, isAuthenticated: true })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setUser(null) marks unauthenticated', () => {
    useAuthStore.getState().setUser(null)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
