import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'

/**
 * Vendors page — Food Court specific, gated by `ordering` capability (P6.8).
 * The vendor management nav item is gated on `food_court.vendor_management.enabled`
 * in FOOD_COURT_MODULE.navItems. Direct access without that flag still requires
 * the ordering capability to be present.
 */
export default function VendorsPage() {
  return (
    <CapabilityGuard
      capability="ordering"
      fallback={<CapabilityNotAvailable capability="ordering" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Vendors</h1>
        <p className="text-[var(--fg-muted)]">Vendor directory content coming soon.</p>
      </main>
    </CapabilityGuard>
  )
}
