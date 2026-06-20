import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function OrdersLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading orders">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Order rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonText lines={2} lastLineWidth="w-1/2" />
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
