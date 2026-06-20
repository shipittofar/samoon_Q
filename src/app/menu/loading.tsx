import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function MenuLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]" role="status" aria-busy="true" aria-label="Loading menu">
      {/* Header placeholder */}
      <div className="h-16 bg-[var(--card)] border-b border-[var(--border)]" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero / search area */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
          <Skeleton className="h-12 w-full max-w-xl mx-auto rounded-2xl" />
        </div>

        {/* Category pills */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
          ))}
        </div>

        {/* Food card grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} showImage bodyLines={2} showAction />
          ))}
        </div>
      </div>
    </div>
  )
}
