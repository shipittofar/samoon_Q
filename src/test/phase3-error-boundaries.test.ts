/**
 * P3.12 — Feature-Level Error Boundaries
 *
 * Verifies that CartDrawer, NotificationCenter, and MenuContent are all
 * wrapped in ErrorBoundary instances so a crash in one feature cannot
 * propagate to the full page.
 *
 * Covers:
 *   P3.12.1 — ErrorBoundary component contract
 *   P3.12.2 — CartDrawer boundary coverage (all render sites)
 *   P3.12.3 — NotificationCenter boundary coverage (Header)
 *   P3.12.4 — MenuContent boundary coverage (menu page)
 *   P3.12.5 — MainLayout central boundary
 *   P3.12.6 — Isolation verification (feature names, reset)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const src = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf-8')

// ── P3.12.1 — ErrorBoundary contract ─────────────────────────────────────────

describe('P3.12.1 — ErrorBoundary component contract', () => {
  it('ErrorBoundary is exported as a class from common/ErrorBoundary', async () => {
    const mod = await import('@/components/common/ErrorBoundary')
    expect(typeof mod.ErrorBoundary).toBe('function')
  })

  it('getDerivedStateFromError returns hasError:true', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const state = ErrorBoundary.getDerivedStateFromError(new Error('test'))
    expect(state.hasError).toBe(true)
  })

  it('getDerivedStateFromError stores the error object', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const err = new Error('boom')
    const state = ErrorBoundary.getDerivedStateFromError(err)
    expect(state.error).toBe(err)
  })

  it('ErrorBoundary source uses role="alert" for the fallback', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('role="alert"')
  })

  it('ErrorBoundary source renders a "Try again" reset button', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('Try again')
    expect(content).toContain('this.reset')
  })

  it('ErrorBoundary reset() sets hasError back to false', async () => {
    const { ErrorBoundary } = await import('@/components/common/ErrorBoundary')
    const boundary = new ErrorBoundary({ children: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    boundary.setState = (s: any) => Object.assign(boundary.state, s)
    boundary.state = { hasError: true, error: new Error('x') }
    boundary.reset()
    expect(boundary.state.hasError).toBe(false)
    expect(boundary.state.error).toBeNull()
  })

  it('ErrorBoundary accepts an optional custom fallback prop', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('fallback?:')
    expect(content).toContain('this.props.fallback')
  })

  it('ErrorBoundary accepts a feature name prop', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('feature?:')
  })

  it('ErrorBoundary calls captureException in componentDidCatch', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('captureException')
    expect(content).toContain('componentDidCatch')
  })
})

// ── P3.12.2 — CartDrawer boundary coverage ────────────────────────────────────

describe('P3.12.2 — CartDrawer wrapped at every render site', () => {
  it('MenuContent.tsx wraps CartDrawer in ErrorBoundary', () => {
    const content = src('components/menu/MenuContent.tsx')
    // ErrorBoundary must appear before CartDrawer
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(ebIdx).toBeGreaterThan(-1)
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('MenuContent.tsx uses feature="CartDrawer" label', () => {
    const content = src('components/menu/MenuContent.tsx')
    expect(content).toContain('feature="CartDrawer"')
  })

  it('MainLayout.tsx wraps CartDrawer in ErrorBoundary', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain('ErrorBoundary')
    expect(content).toContain('<CartDrawer')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('MainLayout.tsx uses feature="CartDrawer" label', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain('feature="CartDrawer"')
  })

  it('home page (app/page.tsx) wraps CartDrawer in ErrorBoundary', () => {
    const content = src('app/page.tsx')
    expect(content).toContain('ErrorBoundary')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('restaurant page wraps CartDrawer in ErrorBoundary', () => {
    const content = src('app/restaurant/page.tsx')
    expect(content).toContain('ErrorBoundary')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('table page wraps CartDrawer in ErrorBoundary', () => {
    const content = src('app/table/[tableId]/page.tsx')
    expect(content).toContain('ErrorBoundary')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })

  it('favorites page wraps CartDrawer in ErrorBoundary', () => {
    const content = src('app/dashboard/favorites/page.tsx')
    expect(content).toContain('ErrorBoundary')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const cartIdx = content.indexOf('<CartDrawer')
    expect(cartIdx).toBeGreaterThan(ebIdx)
  })
})

// ── P3.12.3 — NotificationCenter boundary coverage ───────────────────────────

describe('P3.12.3 — NotificationCenter wrapped in Header', () => {
  it('Header.tsx imports NotificationCenter', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain("from '@/components/notification/NotificationCenter'")
  })

  it('Header.tsx renders <NotificationCenter />', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('<NotificationCenter')
  })

  it('Header.tsx wraps NotificationCenter in ErrorBoundary', () => {
    const content = src('components/layout/Header.tsx')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const ncIdx = content.indexOf('<NotificationCenter')
    expect(ebIdx).toBeGreaterThan(-1)
    expect(ncIdx).toBeGreaterThan(ebIdx)
  })

  it('Header.tsx uses feature="NotificationCenter" label', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('feature="NotificationCenter"')
  })

  it('NotificationCenter is a real React component (not just a bell icon)', () => {
    const content = src('components/notification/NotificationCenter.tsx')
    expect(content).toContain('export function NotificationCenter')
    expect(content).toContain('notifications')
  })

  it('NotificationCenter component handles empty notification list', () => {
    const content = src('components/notification/NotificationCenter.tsx')
    expect(content).toContain("t('noNotificationsYet')")
  })

  it('NotificationCenter component shows unread count badge', () => {
    const content = src('components/notification/NotificationCenter.tsx')
    expect(content).toContain('unreadCount')
  })
})

// ── P3.12.4 — MenuContent boundary coverage ───────────────────────────────────

describe('P3.12.4 — MenuContent wrapped in menu page', () => {
  it('app/menu/page.tsx imports ErrorBoundary', () => {
    const content = src('app/menu/page.tsx')
    expect(content).toContain("from '@/components/common/ErrorBoundary'")
  })

  it('app/menu/page.tsx renders <ErrorBoundary>', () => {
    const content = src('app/menu/page.tsx')
    expect(content).toContain('<ErrorBoundary')
  })

  it('app/menu/page.tsx wraps MenuContent inside ErrorBoundary', () => {
    const content = src('app/menu/page.tsx')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const mcIdx = content.indexOf('<MenuContent')
    expect(ebIdx).toBeGreaterThan(-1)
    expect(mcIdx).toBeGreaterThan(ebIdx)
  })

  it('app/menu/page.tsx uses feature="MenuContent" label', () => {
    const content = src('app/menu/page.tsx')
    expect(content).toContain('feature="MenuContent"')
  })

  it('ErrorBoundary is outside Suspense so errors bubble correctly', () => {
    const content = src('app/menu/page.tsx')
    const ebIdx = content.indexOf('<ErrorBoundary')
    const suspenseIdx = content.indexOf('<Suspense')
    // ErrorBoundary must appear before Suspense (wraps it)
    expect(ebIdx).toBeLessThan(suspenseIdx)
  })
})

// ── P3.12.5 — MainLayout central boundary ─────────────────────────────────────

describe('P3.12.5 — MainLayout ErrorBoundary imports', () => {
  it('MainLayout.tsx imports ErrorBoundary', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain("from '@/components/common/ErrorBoundary'")
  })

  it('MainLayout.tsx wraps FloatingCart in ErrorBoundary', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain('feature="FloatingCart"')
    const ebIdx = content.lastIndexOf('<ErrorBoundary')
    const fcIdx = content.indexOf('<FloatingCart')
    expect(fcIdx).toBeGreaterThan(ebIdx)
  })
})

// ── P3.12.6 — Isolation and feature names ─────────────────────────────────────

describe('P3.12.6 — Isolation: unique feature names', () => {
  it('CartDrawer boundary uses "CartDrawer" feature label', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain('feature="CartDrawer"')
  })

  it('FloatingCart boundary uses "FloatingCart" feature label', () => {
    const content = src('components/layout/MainLayout.tsx')
    expect(content).toContain('feature="FloatingCart"')
  })

  it('NotificationCenter boundary uses "NotificationCenter" feature label', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('feature="NotificationCenter"')
  })

  it('MenuContent boundary uses "MenuContent" feature label', () => {
    const content = src('app/menu/page.tsx')
    expect(content).toContain('feature="MenuContent"')
  })

  it('ErrorBoundary fallback uses the feature name in the message', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).toContain('feature ?? ')
    expect(content).toContain('temporarily unavailable')
  })
})
