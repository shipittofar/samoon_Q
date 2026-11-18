/**
 * Phase 0 hardening — tenant slug resolution in the real middleware.
 *
 * Exercises src/middleware.ts directly (not a copy of its logic) and reads the
 * request headers Next.js forwards via NextResponse.next({ request: { headers } }),
 * which are exposed as `x-middleware-request-<name>` on the response.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function forwardedTenant(host: string, extraHeaders: Record<string, string> = {}): string | null {
  const req = new NextRequest(`http://${host}/discover`, { headers: { host, ...extraHeaders } })
  const res = middleware(req)
  return res.headers.get('x-middleware-request-x-tenant-slug')
}

describe('middleware tenant slug resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves a tenant subdomain', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    expect(forwardedTenant('restaurant-a.samoon.app')).toBe('restaurant-a')
  })

  it('does not treat an IPv4 host as a subdomain', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    expect(forwardedTenant('77.221.156.197:3000')).toBeNull()
  })

  it('skips reserved platform subdomains', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    expect(forwardedTenant('www.samoon.app')).toBeNull()
    expect(forwardedTenant('api.samoon.app')).toBeNull()
  })

  it('only accepts direct subdomains of NEXT_PUBLIC_ROOT_DOMAIN when set', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'samoon.co.uk')
    expect(forwardedTenant('cafe-x.samoon.co.uk')).toBe('cafe-x')
    expect(forwardedTenant('samoon.co.uk')).toBeNull()
    expect(forwardedTenant('evil.other.co.uk')).toBeNull()
  })

  it('strips a client-supplied x-tenant-slug header when no slug resolves', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    expect(forwardedTenant('localhost:3000', { 'x-tenant-slug': 'victim-tenant' })).toBeNull()
  })

  it('overrides a client-supplied x-tenant-slug header with the resolved slug', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', '')
    expect(forwardedTenant('cafe-x.samoon.app', { 'x-tenant-slug': 'victim-tenant' })).toBe('cafe-x')
  })

  it('falls back to NEXT_PUBLIC_TENANT_SLUG on localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_SLUG', 'dev-tenant')
    expect(forwardedTenant('localhost:3000')).toBe('dev-tenant')
  })
})
