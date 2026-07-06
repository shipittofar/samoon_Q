'use client'

/**
 * CapabilityGuard — Phase 6 (P6.8)
 *
 * Client-side guard that renders children only when a capability's resolved
 * feature flag is true. Uses the tenant-override-aware flag value (layer 3)
 * so a tenant can explicitly enable/disable any optional capability.
 *
 * This guard NEVER checks business type directly — only capability flags.
 *
 * Two variants:
 *   - CapabilityGuard   — renders fallback (default: null) when disabled
 *   - CapabilitySection — wraps content with an accessible hidden region
 *
 * @example
 * // Page-level: hide entire loyalty section for food_truck tenants
 * <CapabilityGuard capability="loyalty">
 *   <LoyaltyDashboard />
 * </CapabilityGuard>
 *
 * @example
 * // With custom fallback
 * <CapabilityGuard capability="reservations" fallback={<NotAvailable />}>
 *   <ReservationPage />
 * </CapabilityGuard>
 *
 * @example
 * // Button-level: hide a "Make Reservation" button for bar tenants with reservations off
 * <CapabilityGuard capability="reservations">
 *   <Button>Make Reservation</Button>
 * </CapabilityGuard>
 */

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useCapabilityFlag } from '@/hooks'
import type { Capability } from '@/types'

export interface CapabilityGuardProps {
  /** The capability to check. Maps to its feature flag via CAPABILITY_FLAG_MAP. */
  capability: Capability
  children: ReactNode
  /**
   * Rendered when the capability flag is false or absent.
   * Defaults to null (renders nothing). Pass a component to show a
   * "Not Available" message or redirect.
   */
  fallback?: ReactNode
}

export function CapabilityGuard({
  capability,
  children,
  fallback = null,
}: CapabilityGuardProps) {
  const enabled = useCapabilityFlag(capability)
  if (!enabled) return <>{fallback}</>
  return <>{children}</>
}

// ── CapabilityNotAvailable ────────────────────────────────────────────────────

/**
 * Standard fallback UI shown when a capability is not available for the active
 * tenant. Use as the `fallback` prop on CapabilityGuard for page-level guards.
 *
 * @example
 * <CapabilityGuard capability="loyalty" fallback={<CapabilityNotAvailable capability="loyalty" />}>
 *   <LoyaltyPage />
 * </CapabilityGuard>
 */
export function CapabilityNotAvailable({ capability }: { capability: Capability }) {
  const t = useTranslations('common')
  return (
    <div
      role="status"
      aria-label={t('capabilityNotAvailableAria', { capability })}
      className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4"
    >
      <div className="text-4xl" aria-hidden="true">🚫</div>
      <h2 className="text-xl font-semibold text-[var(--fg)]">
        {t('featureNotAvailable')}
      </h2>
      <p className="text-sm text-[var(--fg-muted)] max-w-sm">
        {t('capabilityNotEnabled', { capability })}
      </p>
    </div>
  )
}
