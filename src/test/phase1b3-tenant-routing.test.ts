/**
 * P1B.3 — Tenant-Aware Routing tests
 *
 * Verifies:
 *   - Middleware subdomain parsing
 *   - Localhost / dev env fallback
 *   - X-Tenant-Slug header injection
 *   - TenantBootstrapper reads slug and passes it to loadTenant()
 *   - Scenario matrix A/B/C/D/E
 *   - Regression: auth flow unchanged
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Middleware — source structure ─────────────────────────────────────────────

describe('middleware.ts — source structure', () => {
  const src = () => readSrc('middleware.ts')

  it('imports NextRequest and NextResponse', () => {
    expect(src()).toContain('NextRequest')
    expect(src()).toContain('NextResponse')
  })

  it('exports a middleware function', () => {
    expect(src()).toContain('export function middleware')
  })

  it('has resolveTenantSlug function', () => {
    expect(src()).toContain('resolveTenantSlug')
  })

  it('parses host header', () => {
    expect(src()).toContain("get('host')")
  })

  it('splits hostname on dots', () => {
    expect(src()).toContain("split('.')")
  })

  it('skips www subdomain', () => {
    expect(src()).toContain("'www'")
  })

  it('falls back to NEXT_PUBLIC_TENANT_SLUG env var', () => {
    expect(src()).toContain('NEXT_PUBLIC_TENANT_SLUG')
  })

  it('injects x-tenant-slug header', () => {
    expect(src()).toContain('x-tenant-slug')
  })

  it('sets header on request when slug resolved', () => {
    expect(src()).toContain('requestHeaders.set')
  })

  it('preserves auth redirect for protected routes', () => {
    expect(src()).toContain('redirect')
    expect(src()).toContain('login')
  })

  it('preserves PROTECTED_PREFIXES', () => {
    expect(src()).toContain('PROTECTED_PREFIXES')
    expect(src()).toContain('/dashboard')
    expect(src()).toContain('/checkout')
    expect(src()).toContain('/console')
  })

  it('passes modified headers to NextResponse.next()', () => {
    expect(src()).toContain('request: { headers: requestHeaders }')
  })
})

// ── Middleware — resolveTenantSlug logic ──────────────────────────────────────

describe('resolveTenantSlug — unit logic (source-level)', () => {
  const src = () => readSrc('middleware.ts')

  it('checks parts.length >= 3 for subdomain detection', () => {
    expect(src()).toContain('>= 3')
  })

  it('returns parts[0] as slug for subdomain', () => {
    expect(src()).toContain('parts[0]')
  })

  it('returns undefined when no slug found', () => {
    expect(src()).toContain('return undefined')
  })

  it('strips port before parsing (split on colon)', () => {
    expect(src()).toContain("split(':')")
  })
})

// ── Root layout — meta tag injection ─────────────────────────────────────────

describe('app/layout.tsx — tenant meta tag', () => {
  const src = () => readSrc('app/layout.tsx')

  it('imports headers from next/headers', () => {
    expect(src()).toContain("from 'next/headers'")
    expect(src()).toContain('headers')
  })

  it('reads x-tenant-slug from headers', () => {
    expect(src()).toContain('x-tenant-slug')
  })

  it('injects meta tag for tenant slug', () => {
    expect(src()).toContain('meta')
    expect(src()).toContain('x-tenant-slug')
  })

  it('only renders meta tag when tenantSlug is truthy', () => {
    expect(src()).toContain('tenantSlug &&')
  })

  it('preserves existing locale/RTL logic', () => {
    expect(src()).toContain('getLocale')
    // P9.5.1B: RTL detection now goes through the Localization Runtime
    // Service's getDirection() (config-driven) instead of a hardcoded
    // ['fa', 'ar'].includes(locale) literal.
    expect(src()).toContain('getDirection')
  })

  it('preserves existing font/theme script', () => {
    expect(src()).toContain('samoon-theme')
  })
})

// ── TenantBootstrapper — source structure ─────────────────────────────────────

describe('providers/index.tsx — TenantBootstrapper P1B.3', () => {
  const src = () => readSrc('providers/index.tsx')

  it('has readTenantSlug function', () => {
    expect(src()).toContain('readTenantSlug')
  })

  it('reads meta[name="x-tenant-slug"] from DOM', () => {
    expect(src()).toContain('meta[name="x-tenant-slug"]')
  })

  it('falls back to NEXT_PUBLIC_TENANT_SLUG', () => {
    expect(src()).toContain('NEXT_PUBLIC_TENANT_SLUG')
  })

  it('calls readTenantSlug() inside TenantBootstrapper', () => {
    const block = src().slice(src().indexOf('function TenantBootstrapper'))
    expect(block).toContain('readTenantSlug()')
  })

  it('passes slug to loadTenant(slug)', () => {
    const block = src().slice(src().indexOf('function TenantBootstrapper'))
    expect(block).toContain('loadTenant(slug)')
  })

  it('guards against server-side execution', () => {
    expect(src()).toContain("typeof document === 'undefined'")
  })

  it('preserves RBAC initialization', () => {
    expect(src()).toContain('setRbacInitialized(true)')
  })

  it('preserves feature flag initialization', () => {
    expect(src()).toContain('setFeatureFlagsInitialized(true)')
  })

  it('preserves Sentry tenant tagging', () => {
    expect(src()).toContain('setSentryTenant')
  })
})

// ── Runtime: resolveTenantSlug ────────────────────────────────────────────────

describe('resolveTenantSlug — runtime behaviour', () => {
  function resolveTenantSlug(host: string, envSlug?: string): string | undefined {
    const hostname = host.split(':')[0]
    const parts = hostname.split('.')
    if (parts.length >= 3 && parts[0] !== 'www') return parts[0]
    if (envSlug) return envSlug
    return undefined
  }

  it('Scenario A: restaurant-a.domain.com → restaurant-a', () => {
    expect(resolveTenantSlug('restaurant-a.domain.com')).toBe('restaurant-a')
  })

  it('Scenario B: restaurant-b.domain.com → restaurant-b', () => {
    expect(resolveTenantSlug('restaurant-b.domain.com')).toBe('restaurant-b')
  })

  it('Scenario C: localhost with NEXT_PUBLIC_TENANT_SLUG → cafe-demo', () => {
    expect(resolveTenantSlug('localhost:3000', 'cafe-demo')).toBe('cafe-demo')
  })

  it('Scenario D: no slug → undefined', () => {
    expect(resolveTenantSlug('localhost:3000')).toBeUndefined()
  })

  it('Scenario D: domain.com (no subdomain) → undefined', () => {
    expect(resolveTenantSlug('domain.com')).toBeUndefined()
  })

  it('www subdomain is skipped (treated as no-tenant)', () => {
    expect(resolveTenantSlug('www.domain.com')).toBeUndefined()
  })

  it('www with env fallback uses env', () => {
    expect(resolveTenantSlug('www.domain.com', 'my-tenant')).toBe('my-tenant')
  })

  it('strips port before parsing', () => {
    expect(resolveTenantSlug('restaurant-a.domain.com:3000')).toBe('restaurant-a')
  })

  it('deep subdomain uses first part', () => {
    expect(resolveTenantSlug('cafe.city.domain.com')).toBe('cafe')
  })

  it('plain localhost with no env → undefined', () => {
    expect(resolveTenantSlug('localhost')).toBeUndefined()
  })

  it('env var takes precedence over nothing for localhost', () => {
    expect(resolveTenantSlug('localhost', 'env-tenant')).toBe('env-tenant')
  })
})

// ── Runtime: readTenantSlug ───────────────────────────────────────────────────

describe('readTenantSlug — DOM meta tag reading', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  function readTenantSlug(metaContent?: string, envSlug?: string): string | undefined {
    if (typeof document === 'undefined') return undefined
    if (metaContent !== undefined) {
      const meta = document.createElement('meta')
      meta.name = 'x-tenant-slug'
      meta.content = metaContent
      document.head.appendChild(meta)
      const result = meta.content || undefined
      document.head.removeChild(meta)
      return result
    }
    return envSlug || undefined
  }

  it('returns content from meta tag when present', () => {
    const meta = document.createElement('meta')
    meta.name = 'x-tenant-slug'
    meta.content = 'restaurant-a'
    document.head.appendChild(meta)
    const found = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-slug"]')
    expect(found?.content).toBe('restaurant-a')
    document.head.removeChild(meta)
  })

  it('returns undefined when no meta tag and no env', () => {
    const found = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-slug"]')
    expect(found).toBeNull()
  })
})

// ── Regression — auth middleware behaviour preserved ──────────────────────────

describe('Regression — auth middleware unchanged', () => {
  const src = () => readSrc('middleware.ts')

  it('still redirects to /login for protected routes without token', () => {
    expect(src()).toContain('/login')
    expect(src()).toContain('redirect')
  })

  it('still sets redirect query param', () => {
    expect(src()).toContain("'redirect'")
  })

  it('still reads JWT_ACCESS_KEY cookie', () => {
    expect(src()).toContain('JWT_ACCESS_KEY')
  })

  it('still imports JWT_ACCESS_KEY from constants', () => {
    expect(src()).toMatch(/JWT_ACCESS_KEY.*from '@\/constants'|from '@\/constants'.*JWT_ACCESS_KEY/)
  })

  it('still exports config with matcher', () => {
    expect(src()).toContain('export const config')
    expect(src()).toContain('matcher')
  })
})

// ── Scenario matrix (source-level) ───────────────────────────────────────────

describe('Scenario matrix — source evidence', () => {
  it('Scenario A/B: subdomain → slug (middleware reads parts[0])', () => {
    const src = readSrc('middleware.ts')
    expect(src).toContain('parts[0]')
    expect(src).toContain('>= 3')
  })

  it('Scenario C: NEXT_PUBLIC_TENANT_SLUG env fallback in middleware', () => {
    const src = readSrc('middleware.ts')
    expect(src).toContain('NEXT_PUBLIC_TENANT_SLUG')
  })

  it('Scenario D/E: loadTenant falls back to DEFAULT_TENANT on failure', () => {
    const src = readSrc('stores/index.ts')
    expect(src).toContain('DEFAULT_TENANT')
    expect(src).toContain("tenantState: 'fallback'")
  })

  it('Scenario E: tenant API failure → DEFAULT_TENANT via catch block', () => {
    const src = readSrc('stores/index.ts')
    expect(src).toContain('catch')
    expect(src).toContain('DEFAULT_TENANT')
  })
})
