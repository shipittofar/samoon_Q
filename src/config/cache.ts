/**
 * ConfigurationCache — P9.0 / Phase E
 *
 * TTL in-memory cache for resolved configuration values, keyed by
 * `${fieldId}::${tenantId}::${branchId}::${userId}`. Pure memoisation layer —
 * ConfigurationService is responsible for invalidating on writes.
 */
import type { ConfigResolutionScope, ResolvedConfigValue } from './types'

interface CacheEntry {
  value: ResolvedConfigValue
  expiresAt: number
}

const DEFAULT_TTL_MS = 30_000

function scopeKey(fieldId: string, scope: ConfigResolutionScope): string {
  return `${fieldId}::${scope.tenantId ?? '-'}::${scope.branchId ?? '-'}::${scope.userId ?? '-'}`
}

class ConfigurationCacheClass {
  private store = new Map<string, CacheEntry>()
  private ttlMs = DEFAULT_TTL_MS

  configureTtl(ms: number): void {
    this.ttlMs = ms
  }

  get(fieldId: string, scope: ConfigResolutionScope): ResolvedConfigValue | undefined {
    const key = scopeKey(fieldId, scope)
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(fieldId: string, scope: ConfigResolutionScope, value: ResolvedConfigValue): void {
    this.store.set(scopeKey(fieldId, scope), { value, expiresAt: Date.now() + this.ttlMs })
  }

  /** Invalidates every cached entry for a field, across all scopes (used after any write). */
  invalidateField(fieldId: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${fieldId}::`)) this.store.delete(key)
    }
  }

  invalidateScope(scope: ConfigResolutionScope): void {
    const suffix = `${scope.tenantId ?? '-'}::${scope.branchId ?? '-'}::${scope.userId ?? '-'}`
    for (const key of this.store.keys()) {
      if (key.endsWith(`::${suffix}`)) this.store.delete(key)
    }
  }

  clear(): void {
    this.store.clear()
  }
}

export const configurationCache = new ConfigurationCacheClass()
