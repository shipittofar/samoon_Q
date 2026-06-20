import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]" role="status" aria-busy="true" aria-label="Loading checkout">
      {/* Header placeholder */}
      <div className="h-16 bg-[var(--card)] border-b border-[var(--border)]" aria-hidden="true" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left — checkout form */}
          <div className="space-y-6">
            <Skeleton className="h-7 w-48" />

            {/* Contact details section */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
              <Skeleton className="h-5 w-36" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>

            {/* Delivery / pickup toggle */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
              <Skeleton className="h-5 w-28" />
              <div className="flex gap-3">
                <Skeleton className="h-20 flex-1 rounded-xl" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            </div>

            {/* Payment section */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>

          {/* Right — order summary */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 h-fit">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-xl shrink-0" />
                <SkeletonText lines={2} className="flex-1" />
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
            ))}
            <div className="border-t border-[var(--border)] pt-4 space-y-2">
              <SkeletonText lines={3} lastLineWidth="w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
