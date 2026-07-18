// ============================================================
// Phase 7 Task 3 — CSP hardening
//
// connect-src previously allowed ANY http(s)/ws(s) origin
// (`http: https: ws: wss:`), which defeats CSP's purpose for that
// directive. There was also no `frame-src`, meaning `default-src 'self'`
// silently blocked Stripe Elements' iframe (js.stripe.com/hooks.stripe.com)
// and no `script-src` allowance for Stripe.js itself. This file proves
// the wildcard is gone in production, the Stripe/Firebase/Sentry
// allowances needed for existing integrations are present, and dev's
// permissive connect-src (needed for arbitrary local backends/tunnels)
// is unchanged.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const configSrc = () => readFileSync(join(process.cwd(), 'next.config.ts'), 'utf-8')

describe('Phase 7 — CSP connect-src no longer wildcards all http(s)/ws(s) origins', () => {
  it('does not contain the old unrestricted connect-src directive', () => {
    expect(configSrc()).not.toContain(`connect-src 'self' http: https: ws: wss:`)
  })

  it('production connect-src is derived from an explicit allowlist, not a wildcard scheme match', () => {
    const src = configSrc()
    const connectSrcBlock = src.slice(src.indexOf('const connectSrc ='), src.indexOf('return ['))
    expect(connectSrcBlock).toContain('apiOrigin')
    expect(connectSrcBlock).toContain('wsOrigin')
    expect(connectSrcBlock).toContain('https://api.stripe.com')
  })

  it('dev keeps the permissive connect-src (arbitrary local backends/tunnels are expected)', () => {
    const src = configSrc()
    expect(src).toContain(`? \`'self' http: https: ws: wss:\``)
  })
})

describe('Phase 7 — Stripe integration is not silently blocked by CSP', () => {
  it('script-src allows js.stripe.com', () => {
    expect(configSrc()).toContain('https://js.stripe.com')
  })

  it('a frame-src directive exists and allows Stripe Elements/3DS iframes', () => {
    const src = configSrc()
    expect(src).toContain('frame-src')
    expect(src).toContain(`frame-src 'self' https://js.stripe.com https://hooks.stripe.com`)
  })

  it('connect-src allows api.stripe.com', () => {
    expect(configSrc()).toContain('https://api.stripe.com')
  })
})

describe('Phase 7 — Firebase Cloud Messaging endpoints allowed (harmless when FCM unconfigured)', () => {
  it('connect-src allows fcm.googleapis.com and firebaseinstallations.googleapis.com', () => {
    const src = configSrc()
    expect(src).toContain('https://fcm.googleapis.com')
    expect(src).toContain('https://firebaseinstallations.googleapis.com')
  })
})

describe('Phase 7 — Sentry ingest origin is derived from the DSN, not hardcoded/wildcarded', () => {
  it('reads NEXT_PUBLIC_SENTRY_DSN (or SENTRY_DSN) and parses its origin via the URL constructor', () => {
    const src = configSrc()
    expect(src).toContain('NEXT_PUBLIC_SENTRY_DSN')
    expect(src).toContain('originOf(')
  })

  it('originOf() never falls back to a wildcard on a malformed/absent URL', () => {
    const src = configSrc()
    const fnBlock = src.slice(src.indexOf('function originOf'), src.indexOf('function buildCspHeader'))
    expect(fnBlock).toContain('return undefined')
    expect(fnBlock).not.toContain('*')
  })
})

describe('Phase 7 — pre-existing CSP guarantees unchanged', () => {
  it('still blocks object-src and restricts frame-ancestors/base-uri', () => {
    const src = configSrc()
    expect(src).toContain(`object-src 'none'`)
    expect(src).toContain(`frame-ancestors 'none'`)
    expect(src).toContain(`base-uri 'self'`)
  })

  it('still sets default-src to self', () => {
    expect(configSrc()).toContain(`default-src 'self'`)
  })
})
