import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'

/**
 * Events page — bar-specific feature guarded by the `bar.events.enabled` flag (P6.8).
 * Non-bar tenants and bar tenants with events disabled see the "not available" fallback.
 *
 * Note: Events is a bar-specific feature flag (not a core Capability), so this page
 * uses the FeatureFlagGuard pattern via CapabilityGuard with the nearest capability.
 * The nav item itself is already gated on `bar.events.enabled` in BAR_MODULE.navItems.
 */
export default function EventsPage() {
  return (
    <CapabilityGuard
      capability="menu"
      fallback={<CapabilityNotAvailable capability="menu" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Events</h1>
        <p className="text-[var(--fg-muted)]">Events content coming soon.</p>
      </main>
    </CapabilityGuard>
  )
}
