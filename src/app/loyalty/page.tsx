import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'

/**
 * Loyalty page — guarded by the `loyalty` capability (P6.8).
 * Food Truck and Food Court tenants do not enable loyalty by default;
 * those tenants see the "not available" fallback on direct route access.
 */
export default function LoyaltyPage() {
  return (
    <CapabilityGuard
      capability="loyalty"
      fallback={<CapabilityNotAvailable capability="loyalty" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Loyalty Program</h1>
        <p className="text-[var(--fg-muted)]">Loyalty program content coming soon.</p>
      </main>
    </CapabilityGuard>
  )
}
