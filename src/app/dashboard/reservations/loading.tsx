import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function ReservationsLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading reservations">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* Reservation cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SkeletonText lines={2} lastLineWidth="w-full" />
            <SkeletonText lines={2} lastLineWidth="w-full" />
            <SkeletonText lines={2} lastLineWidth="w-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-24 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
