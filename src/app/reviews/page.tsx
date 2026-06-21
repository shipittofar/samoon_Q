import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'

/**
 * Reviews page — guarded by the `reviews` capability (P6.8).
 * Tenants whose active modules do not enable reviews see the "not available" fallback.
 */
export default function ReviewsPage() {
  return (
    <CapabilityGuard
      capability="reviews"
      fallback={<CapabilityNotAvailable capability="reviews" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Reviews</h1>
        <p className="text-[var(--fg-muted)]">Reviews content coming soon.</p>
      </main>
    </CapabilityGuard>
  )
}
