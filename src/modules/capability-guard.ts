/**
 * Capability Guard Utilities — Phase 6 (P6.8)
 *
 * Centralizes capability enforcement so no UI component ever needs to hardcode
 * business-type checks (e.g. `if (tenant.type === 'cafe')`).
 *
 * Three enforcement layers:
 *   1. requireCapability()  — pure assertion for server-safe contexts; throws when
 *                             capability is absent so the caller can return 404/null.
 *   2. CapabilityGuard      — client component that renders children only when the
 *                             resolved feature flag is true (see components/guards/).
 *   3. useCapability()      — React hook that reads the tenant-resolved flag
 *                             (see hooks/index.ts).
 *
 * All checks are capability-driven, never business-type-driven.
 * The resolved feature flag (layer 3 of featureFlagsService.resolve) is the
 * authoritative source because it incorporates tenant overrides.
 */

import { CAPABILITY_FLAG_MAP, hasCapability, getCapabilityFeatureFlags } from '@/modules/registry'
import type { Capability } from '@/types'

export type { Capability }
export { hasCapability, getCapabilityFeatureFlags, CAPABILITY_FLAG_MAP }

// ── requireCapability ─────────────────────────────────────────────────────────

/**
 * Asserts that at least one of the active modules supports the given capability
 * at the module-default level (required or defaultEnabled).
 *
 * Use in server components or route handlers to short-circuit rendering when a
 * capability is structurally absent from the active module set. For tenant-
 * overridden values use the resolved feature flag via useFeatureFlag() instead.
 *
 * @throws {CapabilityError} when no active module provides the capability.
 *
 * @example
 * // In a server component / page:
 * requireCapability(['bar'], 'loyalty')  // throws → caller returns notFound()
 */
export function requireCapability(activeModuleKeys: string[], cap: Capability): void {
  if (!hasCapability(activeModuleKeys, cap)) {
    throw new CapabilityError(cap, activeModuleKeys)
  }
}

// ── CapabilityError ───────────────────────────────────────────────────────────

export class CapabilityError extends Error {
  readonly capability: Capability
  readonly activeModuleKeys: string[]

  constructor(capability: Capability, activeModuleKeys: string[]) {
    super(
      `Capability "${capability}" is not available for module(s): [${activeModuleKeys.join(', ')}]. ` +
        `Active modules must include "${capability}" in their required or defaultEnabled set.`,
    )
    this.name = 'CapabilityError'
    this.capability = capability
    this.activeModuleKeys = activeModuleKeys
  }
}

// ── isCapabilityEnabled ───────────────────────────────────────────────────────

/**
 * Returns true when the resolved feature flag for the given capability is true.
 *
 * Accepts a pre-resolved flags map (from featureFlagsService.resolve()) so this
 * helper can be used in both client and server contexts without store access.
 *
 * This is the tenant-override-aware check: tenant.settings.featureFlags can
 * override the module default in either direction.
 *
 * @example
 * const flags = featureFlagsService.resolve(tenant)
 * if (!isCapabilityEnabled('loyalty', flags)) return null
 */
export function isCapabilityEnabled(
  cap: Capability,
  resolvedFlags: Record<string, boolean>,
): boolean {
  const flagKey = CAPABILITY_FLAG_MAP[cap]
  return resolvedFlags[flagKey] ?? false
}

// ── getCapabilityFlagKey ──────────────────────────────────────────────────────

/**
 * Returns the feature flag key for the given capability.
 * Convenience wrapper over CAPABILITY_FLAG_MAP for consumers that only need
 * the key (e.g. to pass to useFeatureFlag()).
 *
 * @example
 * const flagKey = getCapabilityFlagKey('reservations')  // 'reservations.enabled'
 * const enabled = useFeatureFlag(flagKey)
 */
export function getCapabilityFlagKey(cap: Capability): string {
  return CAPABILITY_FLAG_MAP[cap]
}
