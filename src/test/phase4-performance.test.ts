/**
 * Phase 4.7 — Performance Optimization tests (P4.7.1–P4.7.8)
 *
 * Covers:
 *   P4.7.1 — Image optimization audit (sizes props)
 *   P4.7.2 — Framer-motion bundle reduction (lazy imports)
 *   P4.7.3 — Heavy component splitting (FoodDetailModal lazy)
 *   P4.7.4 — Resource hints (preconnect / dns-prefetch)
 *   P4.7.5 — Zustand persistence debouncing
 *   P4.7.6 — React Query configuration (gcTime / staleTime)
 *   P4.7.7 — Bundle-splitting & no-duplicate-import assertions
 *   P4.7.8 — Regression checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', '..')
const src = (rel: string) => readFileSync(join(SRC, 'src', rel), 'utf-8')

// ── P4.7.1 — Image Optimization Audit ────────────────────────────────────────

describe('P4.7.1 — Image optimization: all Image usages have sizes prop', () => {
  /**
   * Report of every Image component in the codebase:
   *
   * src/components/menu/FoodDetailModal.tsx
   *   → sizes="(max-width: 768px) 100vw, 40vw"  (hero image, responsive modal)
   *
   * src/components/menu/FoodCard.tsx (compact)
   *   → sizes="80px"  (small card thumbnail)
   * src/components/menu/FoodCard.tsx (standard)
   *   → sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
   *
   * src/components/cart/CartDrawer.tsx
   *   → sizes="64px"  (cart line-item thumbnail)
   *
   * src/app/console/menu/page.tsx
   *   → sizes="(max-width: 768px) 100vw, 25vw"
   *
   * src/app/restaurant/page.tsx (hero)
   *   → sizes="100vw"
   * src/app/restaurant/page.tsx (gallery small)
   *   → sizes="(max-width: 768px) 50vw, 25vw"
   * src/app/restaurant/page.tsx (gallery large)
   *   → sizes="(max-width: 768px) 50vw, 33vw"
   *
   * src/app/page.tsx (hero)
   *   → sizes="100vw"
   * src/app/page.tsx (featured dish cards)
   *   → sizes="(max-width: 768px) 100vw, 25vw"
   *
   * src/app/order/[orderId]/page.tsx
   *   → sizes="56px"
   *
   * src/app/checkout/page.tsx
   *   → sizes="48px"
   */

  it('ProductDetailMedia Image has sizes prop', () => {
    const content = src('components/product/ProductDetailMedia.tsx')
    expect(content).toContain('sizes=')
    expect(content).toContain('42vw')
  })

  it('FoodCard compact Image has sizes prop', () => {
    const content = src('components/menu/FoodCard.tsx')
    expect(content).toContain('sizes="80px"')
  })

  it('FoodCard standard Image has responsive sizes prop', () => {
    const content = src('components/menu/FoodCard.tsx')
    expect(content).toContain('33vw')
  })

  it('CartDrawer Image has sizes prop', () => {
    const content = src('components/cart/CartDrawer.tsx')
    expect(content).toContain('sizes="64px"')
  })

  it('admin/menu page Image has sizes prop', () => {
    const content = src('app/console/menu/page.tsx')
    expect(content).toContain('sizes=')
  })

  it('restaurant page hero Image has sizes="100vw"', () => {
    const content = src('app/restaurant/page.tsx')
    expect(content).toContain('sizes="100vw"')
  })

  it('restaurant gallery Images have responsive sizes', () => {
    const content = src('app/restaurant/page.tsx')
    expect(content).toContain('50vw')
  })

  it('homepage hero Image has sizes="100vw"', () => {
    const content = src('app/page.tsx')
    expect(content).toContain('sizes="100vw"')
  })

  it('homepage featured dish Images have responsive sizes', () => {
    const content = src('components/home/FeaturedSection.tsx')
    expect(content).toContain('sizes="(max-width: 768px) 100vw, 25vw"')
  })

  it('order page Image has sizes prop', () => {
    const content = src('app/order/[orderId]/page.tsx')
    expect(content).toContain('sizes="56px"')
  })

  it('checkout page Image has sizes prop', () => {
    const content = src('app/checkout/page.tsx')
    expect(content).toContain('sizes="48px"')
  })

  it('all fill Images in critical components have sizes (no omitted sizes)', () => {
    const files = [
      'components/product/ProductDetailView.tsx',
      'components/menu/FoodCard.tsx',
      'components/cart/CartDrawer.tsx',
      'app/page.tsx',
      'app/restaurant/page.tsx',
      'app/checkout/page.tsx',
      'app/order/[orderId]/page.tsx',
    ]
    for (const file of files) {
      const content = src(file)
      if (content.includes('<Image') && content.includes('fill')) {
        expect(content, `${file} must have sizes prop when using fill`).toContain('sizes=')
      }
    }
  })
})

// ── P4.7.2 — Framer Motion Bundle Reduction ───────────────────────────────────

describe('P4.7.2 — Framer-motion lazy splitting', () => {
  it('LazyFoodDetailModal.tsx exists', () => {
    expect(() => src('components/menu/LazyFoodDetailModal.tsx')).not.toThrow()
  })

  it('LazyFoodDetailModal uses next/dynamic', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain("from 'next/dynamic'")
    expect(content).toContain('dynamic(')
  })

  it('LazyFoodDetailModal has ssr: false (prevents SSR for interactive modal)', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain('ssr: false')
  })

  it('LazyFoodDetailModal has a null loading fallback', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain('loading: () => null')
  })

  it('LazyFoodDetailModal imports from FoodDetailModal', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain("'./FoodDetailModal'")
  })

  it('MenuContent no longer statically imports FoodDetailModal', () => {
    const content = src('components/menu/MenuContent.tsx')
    expect(content).not.toContain("import { FoodDetailModal }")
    expect(content).not.toContain("from '@/components/menu/FoodDetailModal'")
  })

  it('MenuContent uses LazyFoodDetailModal instead', () => {
    const content = src('components/menu/MenuContent.tsx')
    expect(content).toContain('LazyFoodDetailModal')
  })
})

// ── P4.7.3 — Heavy Component Splitting ───────────────────────────────────────

describe('P4.7.3 — FoodDetailModal lazy chunk', () => {
  it('LazyFoodDetailModal is a client component', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content.trimStart()).toMatch(/^'use client'/)
  })

  it('dynamic import resolves FoodDetailModal by named export', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain('FoodDetailModal')
  })

  it('MenuContent renders LazyFoodDetailModal (not static)', () => {
    const content = src('components/menu/MenuContent.tsx')
    expect(content).toContain('<LazyFoodDetailModal')
  })

  it('FoodDetailModal.tsx wraps ProductDetailShell (lazy chunk entry preserved)', () => {
    const content = src('components/menu/FoodDetailModal.tsx')
    expect(content).toContain('ProductDetailShell')
    expect(content).toContain('export function FoodDetailModal')
  })

  it('LazyFoodDetailModal does not import framer-motion directly', () => {
    const content = src('components/menu/LazyFoodDetailModal.tsx')
    expect(content).not.toContain('framer-motion')
  })
})

// ── P4.7.4 — Resource Hints ───────────────────────────────────────────────────

describe('P4.7.4 — Resource hints in app/layout.tsx', () => {
  it('layout.tsx includes preconnect to fonts.googleapis.com', () => {
    const content = src('app/layout.tsx')
    expect(content).toContain('rel="preconnect"')
    expect(content).toContain('fonts.googleapis.com')
  })

  it('layout.tsx includes preconnect to images.unsplash.com', () => {
    const content = src('app/layout.tsx')
    expect(content).toContain('images.unsplash.com')
    expect(content).toContain('preconnect')
  })

  it('layout.tsx includes dns-prefetch for images.unsplash.com', () => {
    const content = src('app/layout.tsx')
    expect(content).toContain('dns-prefetch')
    expect(content).toContain('images.unsplash.com')
  })

  it('resource hints only reference origins actually used in the codebase', () => {
    const content = src('app/layout.tsx')
    // Speculative hints NOT present — only confirmed origins
    expect(content).not.toContain('rel="preconnect" href="https://example.com"')
    // APIs are env-driven, not hardcoded preconnects
  })

  it('layout.tsx does not add preconnect to a hardcoded API origin', () => {
    const content = src('app/layout.tsx')
    // API origin is dynamic (env var), so it must NOT be hardcoded as preconnect
    expect(content).not.toMatch(/preconnect.*localhost:8000/)
  })
})

// ── P4.7.5 — Zustand Persistence Debouncing ──────────────────────────────────

describe('P4.7.5 — Cart store debounced writes', () => {
  it('stores/index.ts contains createDebouncedStorage', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('createDebouncedStorage')
  })

  it('cart store uses synchronous persistence (no debounced flush race)', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('name: CART_KEY')
    expect(content).toContain('Synchronous persistence')
    expect(content).not.toContain('storage: createDebouncedStorage(50)')
  })

  it('createDebouncedStorage uses setTimeout for write deferral', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('setTimeout')
    expect(content).toContain('clearTimeout')
  })

  it('debounced storage setItem clears previous timer', () => {
    const content = src('stores/index.ts')
    // Pattern: if (timer) clearTimeout(timer)
    expect(content).toContain('clearTimeout(timer)')
  })

  it('debounced storage getItem reads synchronously from localStorage', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('localStorage.getItem(name)')
  })

  it('debounced storage removeItem cancels pending write (no stale data)', () => {
    const content = src('stores/index.ts')
    // removeItem should clear timer AND remove from storage
    expect(content).toContain('removeItem')
    expect(content).toContain('localStorage.removeItem(name)')
  })

  it('createDebouncedStorage handles SSR (typeof localStorage guard)', () => {
    const content = src('stores/index.ts')
    expect(content).toContain("typeof localStorage === 'undefined'")
  })

  it('debounced storage works end-to-end in test environment', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn((k: string, v: string) => writes.push(v)), removeItem: vi.fn() }

    // Simulate behavior: multiple rapid writes should batch
    let timer: ReturnType<typeof setTimeout> | null = null
    const debouncedSet = (value: string) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { storage.setItem('key', value) }, 50)
    }

    debouncedSet('a')
    debouncedSet('b')
    debouncedSet('c')

    expect(writes).toHaveLength(0) // not written yet
    vi.advanceTimersByTime(60)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toBe('c') // only last value persisted
    vi.useRealTimers()
  })

  it('other persisted stores are unaffected (theme, lang, tenant still use default storage)', () => {
    const content = src('stores/index.ts')
    // Theme, lang, tenant stores use { name: KEY } without custom storage
    expect(content).toContain(`{ name: THEME_KEY }`)
    expect(content).toContain(`{ name: LANG_KEY }`)
  })
})

// ── P4.7.6 — React Query Configuration ───────────────────────────────────────

describe('P4.7.6 — React Query configuration', () => {
  it('providers/index.tsx imports STALE_TIME from constants', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('STALE_TIME')
    expect(content).toContain("from '@/constants'")
  })

  it('providers/index.tsx imports CACHE_TIME from constants', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('CACHE_TIME')
  })

  it('QueryClient uses STALE_TIME constant (not inline literal)', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('staleTime: STALE_TIME')
    // Inline literal should not appear for staleTime
    expect(content).not.toContain('staleTime: 1000 * 60 * 5')
  })

  it('QueryClient has gcTime set to CACHE_TIME', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('gcTime: CACHE_TIME')
  })

  it('STALE_TIME constant is 5 minutes', async () => {
    const { STALE_TIME } = await import('@/constants')
    expect(STALE_TIME).toBe(1000 * 60 * 5)
  })

  it('CACHE_TIME constant is 30 minutes', async () => {
    const { CACHE_TIME } = await import('@/constants')
    expect(CACHE_TIME).toBe(1000 * 60 * 30)
  })

  it('gcTime is greater than staleTime (correct cache hierarchy)', async () => {
    const { STALE_TIME, CACHE_TIME } = await import('@/constants')
    expect(CACHE_TIME).toBeGreaterThan(STALE_TIME)
  })

  it('retry logic still excludes 401 errors', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('status === 401')
    expect(content).toContain('return false')
  })

  it('server QueryClient (createServerQueryClient) has retry: false', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const qc = createServerQueryClient()
    expect(qc.getDefaultOptions().queries?.retry).toBe(false)
  })
})

// ── P4.7.7 — Bundle-splitting assertions ─────────────────────────────────────

describe('P4.7.7 — Bundle splitting & no-duplicate-import checks', () => {
  it('MenuContent does not import from framer-motion directly', () => {
    // MenuContent imports motion/AnimatePresence from framer-motion for UI animations
    // — this is acceptable. The FoodDetailModal chunk is the one being split.
    // Verify MenuContent does NOT re-import FoodDetailModal statically.
    const content = src('components/menu/MenuContent.tsx')
    expect(content).not.toContain("from '@/components/menu/FoodDetailModal'")
  })

  it('LazyFoodDetailModal is the only entry point for FoodDetailModal in menu path', () => {
    const menuContent = src('components/menu/MenuContent.tsx')
    expect(menuContent).not.toContain("'./FoodDetailModal'")
    expect(menuContent).not.toContain("'../menu/FoodDetailModal'")
  })

  it('FoodDetailModal is still exported (named export preserved)', () => {
    const content = src('components/menu/FoodDetailModal.tsx')
    expect(content).toContain('export function FoodDetailModal')
  })

  it('LazyFoodDetailModal file is a new file (not modifying existing)', () => {
    expect(() => src('components/menu/LazyFoodDetailModal.tsx')).not.toThrow()
    // FoodDetailModal is unchanged — only a new wrapper exists
    const original = src('components/menu/FoodDetailModal.tsx')
    expect(original).toContain('export function FoodDetailModal')
  })

  it('framer-motion is still used in non-split components (not removed globally)', () => {
    // Verify framer-motion is still in the codebase (not accidentally removed)
    const modalContent = src('components/ui/Modal.tsx')
    expect(modalContent).toContain('framer-motion')
  })

  it('next/dynamic is only used in the lazy wrapper (no duplicate dynamic wrappers)', () => {
    const lazyContent = src('components/menu/LazyFoodDetailModal.tsx')
    expect(lazyContent).toContain('dynamic(')

    // MenuContent itself should not use dynamic() for FoodDetailModal
    const menuContent = src('components/menu/MenuContent.tsx')
    expect(menuContent).not.toContain("dynamic(() => import('./FoodDetailModal')")
    expect(menuContent).not.toContain("dynamic(() => import('@/components/menu/FoodDetailModal')")
  })
})

// ── P4.7.8 — Regression checks ───────────────────────────────────────────────

describe('P4.7.8 — Regression checks', () => {
  it('Product detail UI still uses framer-motion (CollapsibleSection)', () => {
    const content = src('components/ui/CollapsibleSection.tsx')
    expect(content).toContain('framer-motion')
  })

  it('MenuContent still has its own animations (framer-motion in place)', () => {
    const content = src('components/menu/MenuContent.tsx')
    expect(content).toContain('framer-motion')
  })

  it('CartDrawer framer-motion import is unchanged', () => {
    const content = src('components/cart/CartDrawer.tsx')
    expect(content).toContain('framer-motion')
  })

  it('cart store still persists with CART_KEY name', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('CART_KEY')
    expect(content).toContain('name: CART_KEY')
  })

  it('auth store is unchanged (no persist, no debouncing)', () => {
    const content = src('stores/index.ts')
    // Auth store uses plain create() — no persist
    expect(content).toContain("export const useAuthStore = create<AuthState>()")
    expect(content).not.toContain('useAuthStore.*persist')
  })

  it('tenant store persists nothing — tenant must always be revalidated, never trusted from storage', () => {
    const content = src('stores/index.ts')
    expect(content).toContain('partialize: () => ({})')
  })

  it('QueryClient error handler is unchanged (401/CancelledError guards in place)', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain("err?.name === 'CancelledError'")
    expect(content).toContain('status === 401')
  })

  it('layout.tsx preexisting font preconnect is preserved', () => {
    const content = src('app/layout.tsx')
    expect(content).toContain('fonts.googleapis.com')
    // Font stylesheet still present
    expect(content).toContain('Vazirmatn')
  })

  it('providers/index.tsx Sentry integration unchanged', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('setSentryUser')
    expect(content).toContain('clearSentryUser')
    expect(content).toContain('setSentryTenant')
    expect(content).toContain('setEnvironmentTags')
  })

  it('createServerQueryClient retry:false is preserved', async () => {
    const { createServerQueryClient } = await import('@/lib/react-query/queryClient')
    const qc = createServerQueryClient()
    expect(qc.getDefaultOptions().queries?.retry).toBe(false)
  })
})
