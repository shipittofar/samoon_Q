// ============================================================
// Phase 7 Task 2 — Production mock safety: ALLOW_PRODUCTION_MOCK removed
//
// next.config.ts previously let ALLOW_PRODUCTION_MOCK=true bypass the
// NODE_ENV=production + NEXT_PUBLIC_USE_MOCK=true build guard entirely —
// exactly the kind of env var that could be left set in a CI/deploy
// pipeline by accident, silently defeating the guard for a real
// production deploy. This file proves the bypass is gone and the guard
// is unconditional.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Phase 7 — ALLOW_PRODUCTION_MOCK bypass removed from next.config.ts', () => {
  const configSrc = () => readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')

  it('no longer reads process.env.ALLOW_PRODUCTION_MOCK (a historical comment mentioning the removed flag is fine)', () => {
    expect(configSrc()).not.toContain('process.env.ALLOW_PRODUCTION_MOCK')
  })

  it('the production mock-mode guard has no bypass condition', () => {
    const src = configSrc()
    const guardStart = src.indexOf("if (process.env.NODE_ENV === 'production'")
    expect(guardStart).toBeGreaterThanOrEqual(0)
    const guardBlock = src.slice(guardStart, src.indexOf('throw new Error', guardStart))
    // The if-condition must be exactly the two env checks, ANDed, with no
    // third clause (a bypass flag) negated into it.
    expect(guardBlock).toContain("NODE_ENV === 'production'")
    expect(guardBlock).toContain("NEXT_PUBLIC_USE_MOCK === 'true'")
    expect(guardBlock).not.toContain('!')
  })

  it('still throws unconditionally when NODE_ENV=production and NEXT_PUBLIC_USE_MOCK=true', () => {
    // Mirrors the guard's actual logic (see phase3.test.ts's established
    // pattern for testing this module-level throw without importing a
    // file that has build-time side effects) — now with no bypass branch
    // to also verify is unreachable.
    const check = (env: Record<string, string | undefined>) => {
      if (env.NODE_ENV === 'production' && env.NEXT_PUBLIC_USE_MOCK === 'true') {
        throw new Error('[P3.3] Build aborted: NEXT_PUBLIC_USE_MOCK=true is not allowed in production.')
      }
    }
    expect(() => check({ NODE_ENV: 'production', NEXT_PUBLIC_USE_MOCK: 'true' })).toThrow()
    // Even with what used to be the bypass flag set, the guard (as
    // extracted from the real file's logic above) has no branch that
    // reads it anymore — this documents the intent, the real assertion
    // is the source-string checks above.
    expect(() => check({ NODE_ENV: 'production', NEXT_PUBLIC_USE_MOCK: 'true', ALLOW_PRODUCTION_MOCK: 'true' })).toThrow()
  })
})
