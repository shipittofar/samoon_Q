/**
 * Rate Limiting — Phase 4 (P4.2), config-integrated P9.1.2
 *
 * Sliding-window rate limiter with injectable clock for deterministic testing.
 * Memory-backed, edge-safe (no Node.js APIs), no singleton hidden state.
 *
 * Each RateLimiter instance owns its own store — create one per policy and
 * share it explicitly. No module-level mutable state (beyond the exported
 * limiter instances themselves, which are intentionally process-lifetime
 * singletons — see their own docs below).
 */
import { configurationService } from '@/config'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window. */
  limit: number
  /** Window duration in milliseconds. */
  windowMs: number
  /** Injectable clock — defaults to Date.now. Used for deterministic testing. */
  now?: () => number
}

interface WindowEntry {
  /** Timestamps (ms) of requests within the current window. */
  timestamps: number[]
}

export interface RateLimiter {
  /**
   * Check and record a request for the given identifier.
   * Mutates internal state: records the request if allowed.
   */
  check(identifier: string): RateLimitResult
  /** Read-only peek — does not record the request. */
  peek(identifier: string): RateLimitResult
  /** Reset state for a specific identifier (e.g. after successful login). */
  reset(identifier: string): void
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, now = () => Date.now() } = options
  const store = new Map<string, WindowEntry>()

  function prune(entry: WindowEntry, currentTime: number): void {
    const cutoff = currentTime - windowMs
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
  }

  function compute(identifier: string, currentTime: number): { entry: WindowEntry; result: RateLimitResult } {
    let entry = store.get(identifier)
    if (!entry) {
      entry = { timestamps: [] }
      store.set(identifier, entry)
    }

    prune(entry, currentTime)

    const count = entry.timestamps.length
    const allowed = count < limit
    const remaining = Math.max(0, limit - count - (allowed ? 1 : 0))
    // resetAt = when the oldest request in the window will expire
    const oldestTimestamp = entry.timestamps[0] ?? currentTime
    const resetAt = oldestTimestamp + windowMs

    return { entry, result: { allowed, remaining, resetAt } }
  }

  return {
    check(identifier: string): RateLimitResult {
      const currentTime = now()
      const { entry, result } = compute(identifier, currentTime)
      if (result.allowed) {
        entry.timestamps.push(currentTime)
      }
      return result
    },

    peek(identifier: string): RateLimitResult {
      const currentTime = now()
      const { result } = compute(identifier, currentTime)
      return result
    },

    reset(identifier: string): void {
      store.delete(identifier)
    },
  }
}

// ── P4.2.4 — Retry Metadata Helper ───────────────────────────────────────────

/**
 * Returns the number of seconds until the rate limit window resets.
 * Use the value in a Retry-After HTTP response header.
 */
export function getRetryAfterSeconds(result: RateLimitResult, now = Date.now()): number {
  return Math.max(0, Math.ceil((result.resetAt - now) / 1000))
}

// ── P4.2.2 — Auth Protection Policies ────────────────────────────────────────
// P9.1.2 — Runtime Integration: limits now resolve through the Platform
// Configuration Foundation (platform scope — this module has no per-tenant
// context, matching the platform-locked fields it reads) instead of hardcoded
// literals. Read once at module load, same as the literals they replace;
// values are unchanged (5 and 3) so default behavior is identical.

/** Login attempts per minute per IP / identifier — from authentication.max_login_attempts. */
export const LOGIN_LIMIT = createRateLimiter({
  limit: configurationService.resolveField('authentication.max_login_attempts', {}).value as number,
  windowMs: 60_000,
})

/** OTP requests per 5-minute window — from authentication.otp.max_verify_attempts. */
export const OTP_LIMIT = createRateLimiter({
  limit: configurationService.resolveField('authentication.otp.max_verify_attempts', {}).value as number,
  windowMs: 5 * 60_000,
})

/** 3 password-reset requests per hour. */
export const PASSWORD_RESET_LIMIT = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 })

// ── P4.2.3 — Order Creation Protection ───────────────────────────────────────

/** 10 order creation requests per hour per user. */
export const ORDER_CREATE_LIMIT = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 })
