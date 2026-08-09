/**
 * Phase 4.8 — Service Worker Versioning & Offline UX tests (P4.8.1–P4.8.7)
 *
 * Covers:
 *   P4.8.1 — SW audit results
 *   P4.8.2 — Build version injection
 *   P4.8.3 — Cache versioning
 *   P4.8.4 — Update detection
 *   P4.8.5 — Update banner
 *   P4.8.6 — Offline indicator
 *   P4.8.7 — Offline queue
 *   P4.8.8 — Bundle regression / registration safety
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const src = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf-8')
const file = (rel: string) => readFileSync(join(ROOT, rel), 'utf-8')

// ── P4.8.1 — SW Audit ────────────────────────────────────────────────────────

describe('P4.8.1 — Service worker audit', () => {
  it('public/sw.js exists', () => {
    expect(() => file('public/sw.js')).not.toThrow()
  })

  it('sw.js handles push notifications', () => {
    expect(file('public/sw.js')).toContain("'push'")
  })

  it('sw.js handles fetch events', () => {
    expect(file('public/sw.js')).toContain("'fetch'")
  })

  it('sw.js handles install event', () => {
    expect(file('public/sw.js')).toContain("'install'")
  })

  it('sw.js handles activate event', () => {
    expect(file('public/sw.js')).toContain("'activate'")
  })

  it('sw.js only intercepts same-origin /api/ GET requests', () => {
    const content = file('public/sw.js')
    expect(content).toContain('url.origin === self.location.origin')
    expect(content).toContain("url.pathname.startsWith('/api/')")
  })

  it('sw.js has API cache strategy (network-first)', () => {
    expect(file('public/sw.js')).toContain('/api/')
    expect(file('public/sw.js')).toContain('fetch(e.request)')
  })

  it('sw.js serves /offline route in static assets', () => {
    expect(file('public/sw.js')).toContain("'/offline'")
  })
})

// ── P4.8.2 — Build version injection ─────────────────────────────────────────

describe('P4.8.2 — SW version injection', () => {
  it('scripts/sw-source.js contains __SW_VERSION__ token', () => {
    expect(file('scripts/sw-source.js')).toContain('__SW_VERSION__')
  })

  it('scripts/build-sw.mjs exists', () => {
    expect(() => file('scripts/build-sw.mjs')).not.toThrow()
  })

  it('build-sw.mjs reads version from package.json', () => {
    expect(file('scripts/build-sw.mjs')).toContain('package.json')
    expect(file('scripts/build-sw.mjs')).toContain('version')
  })

  it('build-sw.mjs falls back to git SHA', () => {
    expect(file('scripts/build-sw.mjs')).toContain('git rev-parse')
  })

  it('build-sw.mjs falls back to "unknown"', () => {
    expect(file('scripts/build-sw.mjs')).toContain("'unknown'")
  })

  it('build-sw.mjs writes to public/sw.js', () => {
    expect(file('scripts/build-sw.mjs')).toContain('public/sw.js')
    expect(file('scripts/build-sw.mjs')).toContain('writeFileSync')
  })

  it('public/sw.js does NOT contain __SW_VERSION__ token after build', () => {
    // The build script was run during setup — token should be replaced
    expect(file('public/sw.js')).not.toContain('__SW_VERSION__')
  })

  it('public/sw.js contains a real version string after build', () => {
    const content = file('public/sw.js')
    // Should contain 1.0.0 or a git SHA or "unknown" — not the placeholder
    expect(content).toMatch(/samoon-cache-v([\d.]+|[0-9a-f]{7,8}|unknown)/)
  })

  it('package.json has build:sw script', () => {
    const pkg = JSON.parse(file('package.json'))
    expect(pkg.scripts['build:sw']).toContain('build-sw.mjs')
  })

  it('package.json build script runs build-sw.mjs before next build', () => {
    const pkg = JSON.parse(file('package.json'))
    expect(pkg.scripts['build']).toContain('build-sw.mjs')
    expect(pkg.scripts['build']).toContain('next build')
  })

  it('build-sw.mjs uses single version source (no second version system)', () => {
    const content = file('scripts/build-sw.mjs')
    // References package.json only (consistent with src/lib/version.ts)
    expect(content).toContain('package.json')
    expect(content).not.toContain('npm_package_version') // not duplicating version.ts approach
  })
})

// ── P4.8.3 — Cache versioning ────────────────────────────────────────────────

describe('P4.8.3 — Versioned cache names', () => {
  it('sw-source.js uses SW_VERSION in CACHE_NAME', () => {
    expect(file('scripts/sw-source.js')).toContain('samoon-cache-v${SW_VERSION}')
  })

  it('sw-source.js uses SW_VERSION in API_CACHE', () => {
    expect(file('scripts/sw-source.js')).toContain('samoon-api-v${SW_VERSION}')
  })

  it('sw-source.js defines KNOWN_CACHES array', () => {
    expect(file('scripts/sw-source.js')).toContain('KNOWN_CACHES')
  })

  it('activate event deletes caches NOT in KNOWN_CACHES', () => {
    const content = file('scripts/sw-source.js')
    expect(content).toContain('KNOWN_CACHES')
    expect(content).toContain('caches.delete')
    expect(content).toContain("'activate'")
  })

  it('public/sw.js has versioned CACHE_NAME after build', () => {
    expect(file('public/sw.js')).toContain('samoon-cache-v')
  })

  it('public/sw.js has versioned API_CACHE after build', () => {
    expect(file('public/sw.js')).toContain('samoon-api-v')
  })

  it('both old hardcoded "samoon-v1" names are gone', () => {
    // The old sw.js used 'samoon-v1' — verify the new format replaces it
    expect(file('public/sw.js')).not.toContain("'samoon-v1'")
    expect(file('public/sw.js')).not.toContain("'samoon-api-v1'")
  })
})

// ── P4.8.4 — Update detection ─────────────────────────────────────────────────

describe('P4.8.4 — SW update detection', () => {
  it('src/lib/service-worker.ts exists', () => {
    expect(() => src('lib/service-worker.ts')).not.toThrow()
  })

  it('registerServiceWorker registers /sw.js', () => {
    expect(src('lib/service-worker.ts')).toContain("'/sw.js'")
    expect(src('lib/service-worker.ts')).toContain('register(')
  })

  it('update detection listens for updatefound event', () => {
    expect(src('lib/service-worker.ts')).toContain('updatefound')
  })

  it('update detection checks statechange on installing worker', () => {
    expect(src('lib/service-worker.ts')).toContain('statechange')
    expect(src('lib/service-worker.ts')).toContain("'installed'")
  })

  it('checks for already-waiting SW on registration', () => {
    expect(src('lib/service-worker.ts')).toContain('registration.waiting')
  })

  it('sw-source.js handles SKIP_WAITING message', () => {
    expect(file('scripts/sw-source.js')).toContain('SKIP_WAITING')
    expect(file('scripts/sw-source.js')).toContain('skipWaiting')
  })

  it('applyServiceWorkerUpdate posts SKIP_WAITING to waiting SW', () => {
    expect(src('lib/service-worker.ts')).toContain('SKIP_WAITING')
    expect(src('lib/service-worker.ts')).toContain('postMessage')
  })

  it('controllerchange triggers page reload', () => {
    expect(src('lib/service-worker.ts')).toContain('controllerchange')
    expect(src('lib/service-worker.ts')).toContain('reload()')
  })

  it('useServiceWorkerUpdate hook exports updateAvailable and applyUpdate', () => {
    const content = src('lib/service-worker.ts')
    expect(content).toContain('useServiceWorkerUpdate')
    expect(content).toContain('updateAvailable')
    expect(content).toContain('applyUpdate')
  })

  it('no auto-refresh — user controls update application', () => {
    const content = src('lib/service-worker.ts')
    // skipWaiting is NOT called in the install handler of sw-source
    // and no automatic reload in the hook
    expect(file('scripts/sw-source.js')).not.toContain('skipWaiting()\nself')
    // The hook only sets state; it doesn't reload automatically
    expect(content).not.toMatch(/useEffect[\s\S]*?reload\(\)/)
  })
})

// ── P4.8.5 — Update banner ────────────────────────────────────────────────────

describe('P4.8.5 — ServiceWorkerUpdateBanner', () => {
  it('component file exists', () => {
    expect(() => src('components/pwa/ServiceWorkerUpdateBanner.tsx')).not.toThrow()
  })

  it('is a client component', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx').trimStart()).toMatch(/^'use client'/)
  })

  it('renders nothing when no update available', () => {
    const content = src('components/pwa/ServiceWorkerUpdateBanner.tsx')
    // Component returns null when !updateAvailable || dismissed
    expect(content).toContain('return null')
  })

  it('has role="alert" for accessibility', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('role="alert"')
  })

  it('has aria-live="polite"', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('aria-live="polite"')
  })

  it('displays "New version available" text', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('New version available')
  })

  it('has a Refresh action button', () => {
    const content = src('components/pwa/ServiceWorkerUpdateBanner.tsx')
    expect(content).toContain('Refresh')
    expect(content).toContain('applyUpdate')
  })

  it('has a Dismiss action', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('Dismiss')
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('dismissed')
  })

  it('uses useServiceWorkerUpdate hook', () => {
    expect(src('components/pwa/ServiceWorkerUpdateBanner.tsx')).toContain('useServiceWorkerUpdate')
  })

  it('is mounted in Providers (non-breaking addition)', () => {
    expect(src('providers/index.tsx')).toContain('ServiceWorkerUpdateBanner')
  })
})

// ── P4.8.6 — Offline indicator ───────────────────────────────────────────────

describe('P4.8.6 — OfflineIndicator', () => {
  it('component file exists', () => {
    expect(() => src('components/pwa/OfflineIndicator.tsx')).not.toThrow()
  })

  it('is a client component', () => {
    expect(src('components/pwa/OfflineIndicator.tsx').trimStart()).toMatch(/^'use client'/)
  })

  it('uses navigator.onLine for initial state', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('navigator.onLine')
  })

  it('listens to window offline event', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain("'offline'")
  })

  it('listens to window online event', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain("'online'")
  })

  it('removes event listeners on unmount (cleanup)', () => {
    const content = src('components/pwa/OfflineIndicator.tsx')
    expect(content).toContain('removeEventListener')
    expect(content).toContain('return () =>')
  })

  it('has role="status" for accessibility', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('role="status"')
  })

  it('has aria-live="polite"', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('aria-live="polite"')
  })

  it('returns null when online (non-blocking)', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('return null')
  })

  it('shows offline message when offline', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('offline')
  })

  it('no polling — uses event-driven updates only', () => {
    const content = src('components/pwa/OfflineIndicator.tsx')
    expect(content).not.toContain('setInterval')
    expect(content).not.toContain('setTimeout')
  })

  it('is mounted in Providers', () => {
    expect(src('providers/index.tsx')).toContain('OfflineIndicator')
  })
})

// ── P4.8.7 — Offline queue ───────────────────────────────────────────────────

describe('P4.8.7 — Offline mutation queue', () => {
  beforeEach(() => {
    vi.resetModules()
    // Reset localStorage mock
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('enqueue adds a mutation with timestamp', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'm1', type: 'cart/add', payload: { itemId: '1' } })
    const q = getQueue()
    expect(q).toHaveLength(1)
    expect(q[0].id).toBe('m1')
    expect(q[0].type).toBe('cart/add')
    expect(typeof q[0].timestamp).toBe('number')
  })

  it('enqueue deduplicates by id', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'dup', type: 'cart/add', payload: {} })
    enqueue({ id: 'dup', type: 'cart/add', payload: {} })
    expect(getQueue()).toHaveLength(1)
  })

  it('getQueue returns mutations in insertion order', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'a', type: 't', payload: 1 })
    enqueue({ id: 'b', type: 't', payload: 2 })
    enqueue({ id: 'c', type: 't', payload: 3 })
    const ids = getQueue().map((m) => m.id)
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('dequeue removes a single mutation by id', async () => {
    const { enqueue, dequeue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'x', type: 't', payload: null })
    enqueue({ id: 'y', type: 't', payload: null })
    dequeue('x')
    const q = getQueue()
    expect(q).toHaveLength(1)
    expect(q[0].id).toBe('y')
  })

  it('clearQueue removes all mutations', async () => {
    const { enqueue, clearQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'a', type: 't', payload: null })
    enqueue({ id: 'b', type: 't', payload: null })
    clearQueue()
    expect(getQueue()).toHaveLength(0)
  })

  it('replayQueue calls executor for each mutation', async () => {
    const { enqueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'r1', type: 'cart/add', payload: { x: 1 } })
    enqueue({ id: 'r2', type: 'cart/add', payload: { x: 2 } })

    const executed: string[] = []
    await replayQueue(async (m) => { executed.push(m.id) })

    expect(executed).toEqual(['r1', 'r2'])
  })

  it('replayQueue dequeues BEFORE executor (no duplicate submissions)', async () => {
    const { enqueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 's1', type: 'cart/add', payload: {} })

    let queueSizeAtExecution = -1
    await replayQueue(async (_m) => {
      queueSizeAtExecution = getQueue().length
    })

    // The mutation was dequeued before the executor ran
    expect(queueSizeAtExecution).toBe(0)
  })

  it('replayQueue continues after executor throws', async () => {
    const { enqueue, replayQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'fail', type: 't', payload: null })
    enqueue({ id: 'pass', type: 't', payload: null })

    const executed: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await replayQueue(async (m) => {
      if (m.id === 'fail') throw new Error('network error')
      executed.push(m.id)
    })
    spy.mockRestore()

    expect(executed).toContain('pass')
  })

  it('replayQueue clears the queue on completion', async () => {
    const { enqueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'done', type: 't', payload: null })
    await replayQueue(async () => {})
    expect(getQueue()).toHaveLength(0)
  })

  it('getQueue returns empty array when localStorage is empty', async () => {
    const { getQueue } = await import('@/lib/offline-queue')
    expect(getQueue()).toEqual([])
  })

  it('mutations survive across module re-imports (localStorage persistence)', async () => {
    const { enqueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'persist', type: 'cart/add', payload: { test: true } })

    vi.resetModules()
    const { getQueue } = await import('@/lib/offline-queue')
    const q = getQueue()
    expect(q.some((m) => m.id === 'persist')).toBe(true)
  })

  it('offlineQueue singleton exports all functions', async () => {
    const { offlineQueue } = await import('@/lib/offline-queue')
    expect(typeof offlineQueue.enqueue).toBe('function')
    expect(typeof offlineQueue.getQueue).toBe('function')
    expect(typeof offlineQueue.dequeue).toBe('function')
    expect(typeof offlineQueue.clearQueue).toBe('function')
    expect(typeof offlineQueue.replayQueue).toBe('function')
  })

  it('enqueue accepts JSON-serialisable payloads of any shape', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'complex', type: 'cart/add', payload: { nested: { arr: [1, 2, 3], str: 'hello' } } })
    const q = getQueue()
    expect((q[0].payload as any).nested.arr).toEqual([1, 2, 3])
  })
})

// ── P4.8.8 — Registration safety & regression checks ─────────────────────────

describe('P4.8.8 — Registration safety & regression checks', () => {
  it('service-worker.ts is a client module (safe for SSR)', () => {
    expect(src('lib/service-worker.ts').trimStart()).toMatch(/^'use client'/)
  })

  it('registerServiceWorker guards against non-browser environments', () => {
    const content = src('lib/service-worker.ts')
    expect(content).toContain("'serviceWorker' in navigator")
    expect(content).toContain('typeof navigator')
  })

  it('registration errors are caught (no unhandled rejection)', () => {
    expect(src('lib/service-worker.ts')).toContain('.catch(')
  })

  it('providers still contain Sentry integration (no regression)', () => {
    expect(src('providers/index.tsx')).toContain('setSentryUser')
    expect(src('providers/index.tsx')).toContain('clearSentryUser')
  })

  it('providers still contain auth bootstrapper (no regression)', () => {
    expect(src('providers/index.tsx')).toContain('AuthBootstrapper')
    expect(src('providers/index.tsx')).toContain('authService.getMe()')
  })

  it('PWA components are additive (Toaster still present)', () => {
    expect(src('providers/index.tsx')).toContain('Toaster')
  })

  it('manifest.json is unchanged (no PWA asset regressions)', () => {
    const manifest = JSON.parse(file('public/manifest.json'))
    expect(manifest.name).toBe('Samoon — Fine Dining & Delivery')
    expect(manifest.icons).toHaveLength(8)
  })

  it('offline-queue handles corrupt localStorage gracefully', async () => {
    const store: Record<string, string> = { 'samoon-offline-queue': 'INVALID_JSON' }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    vi.resetModules()
    const { getQueue } = await import('@/lib/offline-queue')
    expect(() => getQueue()).not.toThrow()
    expect(getQueue()).toEqual([])
    vi.unstubAllGlobals()
  })

  it('OfflineIndicator and ServiceWorkerUpdateBanner are both mounted in Providers', () => {
    const content = src('providers/index.tsx')
    expect(content).toContain('ServiceWorkerUpdateBanner')
    expect(content).toContain('OfflineIndicator')
  })

  it('sw-source.js removes skipWaiting from install (update flow controlled by app)', () => {
    const content = file('scripts/sw-source.js')
    // skipWaiting should only appear in the message handler, not in install
    const installSection = content.split("'install'")[1]?.split("'activate'")[0] ?? ''
    expect(installSection).not.toContain('skipWaiting()')
  })
})
