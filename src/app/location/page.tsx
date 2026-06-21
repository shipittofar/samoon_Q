import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'

/**
 * Live Location page — Food Truck and Mobile Cafe specific (P6.8).
 * Gated by the `qr_table` capability (all mobile modules require QR ordering).
 * The nav item is gated on `food_truck.live_location.enabled` /
 * `mobile_cafe.live_location.enabled` in the respective module navItems.
 */
export default function LocationPage() {
  return (
    <CapabilityGuard
      capability="qr_table"
      fallback={<CapabilityNotAvailable capability="qr_table" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Live Location</h1>
        <p className="text-[var(--fg-muted)]">Live location tracking content coming soon.</p>
      </main>
    </CapabilityGuard>
  )
}
