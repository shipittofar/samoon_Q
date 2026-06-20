/**
 * Phase 4.3 — Loading States & Skeleton Screens tests (P4.3.1–P4.3.4)
 *
 * Covers:
 *   P4.3.1 — Skeleton component exports and rendering
 *   P4.3.2 — Route loading.tsx files exist for required routes
 *   P4.3.3 — QueryClient global error handler registration
 *   P4.3.4 — Suspense boundary / loading fallback rendering
 *   ARIA    — Accessibility compliance of skeleton components
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const APP = join(ROOT, 'src', 'app')
const COMPONENTS = join(ROOT, 'src', 'components', 'ui')

// ── P4.3.1 — Skeleton component exports ───────────────────────────────────────

describe('P4.3.1 — Skeleton UI primitives', () => {
  it('Skeleton.tsx file exists', () => {
    expect(existsSync(join(COMPONENTS, 'Skeleton.tsx'))).toBe(true)
  })

  it('exports Skeleton component', async () => {
    const mod = await import('@/components/ui/Skeleton')
    expect(typeof mod.Skeleton).toBe('function')
  })

  it('exports SkeletonText component', async () => {
    const mod = await import('@/components/ui/Skeleton')
    expect(typeof mod.SkeletonText).toBe('function')
  })

  it('exports SkeletonAvatar component', async () => {
    const mod = await import('@/components/ui/Skeleton')
    expect(typeof mod.SkeletonAvatar).toBe('function')
  })

  it('exports SkeletonCard component', async () => {
    const mod = await import('@/components/ui/Skeleton')
    expect(typeof mod.SkeletonCard).toBe('function')
  })

  it('Skeleton source uses animate-pulse CSS class', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('animate-pulse')
  })

  it('Skeleton source does not import framer-motion', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).not.toMatch(/^import.*from\s+['"]framer-motion['"]/m)
  })
})

// ── ARIA compliance ───────────────────────────────────────────────────────────

describe('P4.3.1 — ARIA compliance in Skeleton source', () => {
  it('SkeletonText uses role="status"', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('role="status"')
  })

  it('SkeletonText uses aria-busy="true"', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('aria-busy="true"')
  })

  it('SkeletonAvatar uses aria-label', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('aria-label="Loading avatar"')
  })

  it('SkeletonCard uses aria-label', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('aria-label="Loading content"')
  })

  it('inner decorative elements use aria-hidden', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('aria-hidden="true"')
  })
})

// ── SkeletonCard configuration options ────────────────────────────────────────

describe('P4.3.1 — SkeletonCard configuration', () => {
  it('SkeletonCard source supports showImage prop', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('showImage')
  })

  it('SkeletonCard source supports bodyLines prop', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('bodyLines')
  })

  it('SkeletonCard source supports showAction prop', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('showAction')
  })

  it('SkeletonText supports configurable line count', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    expect(src).toContain('lines')
  })

  it('SkeletonAvatar supports size variants', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(COMPONENTS, 'Skeleton.tsx'), 'utf-8')
    // Verify all five size tokens are defined
    expect(src).toContain("'xs'")
    expect(src).toContain("'sm'")
    expect(src).toContain("'md'")
    expect(src).toContain("'lg'")
    expect(src).toContain("'xl'")
  })
})

// ── P4.3.2 — Route loading files ─────────────────────────────────────────────

describe('P4.3.2 — Route loading.tsx files exist', () => {
  it('app/dashboard/loading.tsx exists', () => {
    expect(existsSync(join(APP, 'dashboard', 'loading.tsx'))).toBe(true)
  })

  it('app/dashboard/orders/loading.tsx exists', () => {
    expect(existsSync(join(APP, 'dashboard', 'orders', 'loading.tsx'))).toBe(true)
  })

  it('app/dashboard/reservations/loading.tsx exists', () => {
    expect(existsSync(join(APP, 'dashboard', 'reservations', 'loading.tsx'))).toBe(true)
  })

  it('app/menu/loading.tsx exists', () => {
    expect(existsSync(join(APP, 'menu', 'loading.tsx'))).toBe(true)
  })

  it('app/checkout/loading.tsx exists', () => {
    expect(existsSync(join(APP, 'checkout', 'loading.tsx'))).toBe(true)
  })

  it('loading files import from Skeleton.tsx', async () => {
    const { readFileSync } = await import('fs')
    const files = [
      join(APP, 'dashboard', 'loading.tsx'),
      join(APP, 'dashboard', 'orders', 'loading.tsx'),
      join(APP, 'dashboard', 'reservations', 'loading.tsx'),
      join(APP, 'menu', 'loading.tsx'),
      join(APP, 'checkout', 'loading.tsx'),
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      expect(src, `${f} should import from Skeleton`).toContain("from '@/components/ui/Skeleton'")
    }
  })

  it('loading files contain no data-fetching imports', async () => {
    const { readFileSync } = await import('fs')
    const files = [
      join(APP, 'dashboard', 'loading.tsx'),
      join(APP, 'dashboard', 'orders', 'loading.tsx'),
      join(APP, 'dashboard', 'reservations', 'loading.tsx'),
      join(APP, 'menu', 'loading.tsx'),
      join(APP, 'checkout', 'loading.tsx'),
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      expect(src, `${f} should not import useQuery`).not.toContain('useQuery')
      expect(src, `${f} should not import fetch`).not.toContain('fetch(')
    }
  })

  it('loading files expose a default export', async () => {
    const { readFileSync } = await import('fs')
    const files = [
      join(APP, 'dashboard', 'loading.tsx'),
      join(APP, 'dashboard', 'orders', 'loading.tsx'),
      join(APP, 'dashboard', 'reservations', 'loading.tsx'),
      join(APP, 'menu', 'loading.tsx'),
      join(APP, 'checkout', 'loading.tsx'),
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      expect(src, `${f} should have default export`).toContain('export default')
    }
  })
})

// ── P4.3.3 — Query error handler ─────────────────────────────────────────────

describe('P4.3.3 — QueryClient global error handler', () => {
  it('providers/index.tsx imports QueryCache', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('QueryCache')
  })

  it('makeQueryClient registers an onError handler via QueryCache', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('onError')
    expect(src).toContain('new QueryCache')
  })

  it('error handler ignores CancelledError', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('CancelledError')
  })

  it('error handler ignores 401 responses', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('401')
  })

  it('error handler calls toast.error', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('toast.error')
  })

  it('toast deduplication uses id option', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(ROOT, 'src', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('query-error-')
  })
})

// ── P4.3.4 — Suspense boundary audit ─────────────────────────────────────────

describe('P4.3.4 — Suspense boundaries', () => {
  it('menu/page.tsx already wraps dynamic content in Suspense', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync(join(APP, 'menu', 'page.tsx'), 'utf-8')
    expect(src).toContain('Suspense')
  })

  it('loading.tsx files act as route-level Suspense boundaries (role=status)', async () => {
    const { readFileSync } = await import('fs')
    const files = [
      join(APP, 'dashboard', 'loading.tsx'),
      join(APP, 'dashboard', 'orders', 'loading.tsx'),
      join(APP, 'menu', 'loading.tsx'),
    ]
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      expect(src, `${f} should signal loading state`).toContain('aria-busy="true"')
    }
  })
})
