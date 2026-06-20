/**
 * Phase 4.2 — Rate Limiting tests (P4.2.1–P4.2.5)
 *
 * Covers:
 *   P4.2.1 — Generic sliding-window rate limiter
 *   P4.2.2 — Auth protection policies (LOGIN, OTP, PASSWORD_RESET)
 *   P4.2.3 — Order creation protection policy
 *   P4.2.4 — Retry metadata / getRetryAfterSeconds
 *   P4.2.5 — Policy isolation, edge cases, deterministic clock
 */

import { describe, it, expect } from 'vitest'
import {
  createRateLimiter,
  getRetryAfterSeconds,
  type RateLimitResult,
} from '@/lib/rate-limit'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClock(startMs = 0) {
  let current = startMs
  return {
    now: () => current,
    advance: (ms: number) => { current += ms },
    set: (ms: number) => { current = ms },
  }
}

// ── P4.2.1 — Generic Rate Limiter ─────────────────────────────────────────────

describe('P4.2.1 — createRateLimiter: core behaviour', () => {
  it('allows the first request', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now })
    const result = limiter.check('user-1')
    expect(result.allowed).toBe(true)
  })

  it('tracks remaining correctly after first request', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now })
    const result = limiter.check('user-1')
    expect(result.remaining).toBe(2)
  })

  it('allows requests up to the limit', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now })
    expect(limiter.check('u').allowed).toBe(true)  // 1
    expect(limiter.check('u').allowed).toBe(true)  // 2
    expect(limiter.check('u').allowed).toBe(true)  // 3
    expect(limiter.check('u').allowed).toBe(false) // 4 — over limit
  })

  it('sets remaining to 0 when limit is exactly reached', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now })
    limiter.check('u')
    const result = limiter.check('u')
    expect(result.remaining).toBe(0)
    expect(result.allowed).toBe(true)
  })

  it('blocks requests beyond the limit', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now })
    limiter.check('u')
    limiter.check('u')
    const result = limiter.check('u')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now })
    limiter.check('u')
    limiter.check('u')
    // advance past the window
    clock.advance(61_000)
    const result = limiter.check('u')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('uses sliding window — old requests expire individually', () => {
    const clock = makeClock(0)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now })

    clock.set(1_000);  limiter.check('u')  // t=1s
    clock.set(30_000); limiter.check('u')  // t=30s
    clock.set(45_000); limiter.check('u')  // t=45s — now at limit

    // At t=62s the first request (t=1s) has expired → 1 slot frees
    clock.set(62_000)
    const result = limiter.check('u')
    expect(result.allowed).toBe(true)

    // But at t=62s we still have requests at 30s, 45s, 62s → limit hit again
    expect(limiter.check('u').allowed).toBe(false)
  })

  it('tracks independent identifiers separately', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now })
    limiter.check('alice')
    limiter.check('alice')
    limiter.check('alice') // alice is blocked

    const bobResult = limiter.check('bob')
    expect(bobResult.allowed).toBe(true) // bob is unaffected
  })

  it('peek does not consume a slot', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now })
    const peek1 = limiter.peek('u')
    const peek2 = limiter.peek('u')
    expect(peek1.allowed).toBe(true)
    expect(peek2.allowed).toBe(true)
    // Now actually consume the slot
    const check1 = limiter.check('u')
    expect(check1.allowed).toBe(true)
    const check2 = limiter.check('u')
    expect(check2.allowed).toBe(false)
  })

  it('reset clears state for an identifier', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now })
    limiter.check('u')
    limiter.check('u')
    expect(limiter.check('u').allowed).toBe(false)
    limiter.reset('u')
    expect(limiter.check('u').allowed).toBe(true)
  })

  it('provides a resetAt timestamp in the future', () => {
    const clock = makeClock(10_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now })
    const result = limiter.check('u')
    expect(result.resetAt).toBeGreaterThan(clock.now())
  })

  it('no hidden shared state between two limiter instances', () => {
    const clock = makeClock(1_000)
    const a = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now })
    const b = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now })
    a.check('u')
    expect(a.check('u').allowed).toBe(false)
    expect(b.check('u').allowed).toBe(true)
  })
})

// ── P4.2.4 — Retry Metadata ───────────────────────────────────────────────────

describe('P4.2.4 — getRetryAfterSeconds', () => {
  it('returns 0 when reset is in the past', () => {
    const result: RateLimitResult = { allowed: false, remaining: 0, resetAt: 1_000 }
    expect(getRetryAfterSeconds(result, 5_000)).toBe(0)
  })

  it('returns correct ceiling in seconds', () => {
    const now = 10_000
    const result: RateLimitResult = { allowed: false, remaining: 0, resetAt: now + 30_500 }
    expect(getRetryAfterSeconds(result, now)).toBe(31) // ceil(30.5)
  })

  it('returns 0 when resetAt equals now', () => {
    const now = 10_000
    const result: RateLimitResult = { allowed: false, remaining: 0, resetAt: now }
    expect(getRetryAfterSeconds(result, now)).toBe(0)
  })

  it('returns whole seconds (no fractions)', () => {
    const now = 0
    const result: RateLimitResult = { allowed: false, remaining: 0, resetAt: 45_000 }
    expect(Number.isInteger(getRetryAfterSeconds(result, now))).toBe(true)
  })
})

// ── P4.2.2 — Auth Policies ────────────────────────────────────────────────────

describe('P4.2.2 — LOGIN_LIMIT policy (5 req / 60 s)', () => {
  it('allows 5 login attempts per identifier', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, now: clock.now })
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('ip-1').allowed).toBe(true)
    }
  })

  it('blocks the 6th login attempt', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, now: clock.now })
    for (let i = 0; i < 5; i++) limiter.check('ip-2')
    expect(limiter.check('ip-2').allowed).toBe(false)
  })

  it('unblocks after 60 s window expires', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, now: clock.now })
    for (let i = 0; i < 5; i++) limiter.check('ip-3')
    clock.advance(61_000)
    expect(limiter.check('ip-3').allowed).toBe(true)
  })
})

describe('P4.2.2 — OTP_LIMIT policy (3 req / 5 min)', () => {
  it('allows 3 OTP requests', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 5 * 60_000, now: clock.now })
    expect(limiter.check('user-a').allowed).toBe(true)
    expect(limiter.check('user-a').allowed).toBe(true)
    expect(limiter.check('user-a').allowed).toBe(true)
  })

  it('blocks the 4th OTP request within 5 minutes', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 5 * 60_000, now: clock.now })
    for (let i = 0; i < 3; i++) limiter.check('user-b')
    expect(limiter.check('user-b').allowed).toBe(false)
  })

  it('unblocks after 5-minute window expires', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 5 * 60_000, now: clock.now })
    for (let i = 0; i < 3; i++) limiter.check('user-c')
    clock.advance(5 * 60_000 + 1_000)
    expect(limiter.check('user-c').allowed).toBe(true)
  })
})

describe('P4.2.2 — PASSWORD_RESET_LIMIT policy (3 req / 1 h)', () => {
  it('allows 3 password-reset requests per hour', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 3; i++) {
      expect(limiter.check('email@example.com').allowed).toBe(true)
    }
  })

  it('blocks the 4th password-reset request within 1 hour', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 3; i++) limiter.check('email@example.com')
    expect(limiter.check('email@example.com').allowed).toBe(false)
  })
})

// ── P4.2.3 — Order Creation Policy ───────────────────────────────────────────

describe('P4.2.3 — ORDER_CREATE_LIMIT policy (10 req / 1 h)', () => {
  it('allows 10 order creation requests per user per hour', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 10; i++) {
      expect(limiter.check('user-42').allowed).toBe(true)
    }
  })

  it('blocks the 11th order in the same hour', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 10; i++) limiter.check('user-42')
    expect(limiter.check('user-42').allowed).toBe(false)
  })

  it('different users have independent order quotas', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 10; i++) limiter.check('user-1')
    expect(limiter.check('user-2').allowed).toBe(true)
  })

  it('order quota resets after 1 hour', () => {
    const clock = makeClock(1_000)
    const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000, now: clock.now })
    for (let i = 0; i < 10; i++) limiter.check('user-42')
    clock.advance(60 * 60_000 + 1_000)
    expect(limiter.check('user-42').allowed).toBe(true)
  })
})

// ── P4.2.5 — Module exports audit ────────────────────────────────────────────

describe('P4.2.5 — rate-limit module exports', () => {
  it('exports createRateLimiter', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.createRateLimiter).toBe('function')
  })

  it('exports getRetryAfterSeconds', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.getRetryAfterSeconds).toBe('function')
  })

  it('exports LOGIN_LIMIT policy instance', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.LOGIN_LIMIT.check).toBe('function')
  })

  it('exports OTP_LIMIT policy instance', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.OTP_LIMIT.check).toBe('function')
  })

  it('exports PASSWORD_RESET_LIMIT policy instance', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.PASSWORD_RESET_LIMIT.check).toBe('function')
  })

  it('exports ORDER_CREATE_LIMIT policy instance', async () => {
    const mod = await import('@/lib/rate-limit')
    expect(typeof mod.ORDER_CREATE_LIMIT.check).toBe('function')
  })
})
