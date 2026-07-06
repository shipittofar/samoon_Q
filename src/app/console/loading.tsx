import { getTranslations } from 'next-intl/server'
import { SkeletonCard } from '@/components/ui/Skeleton'

export default async function AdminLoading() {
  const t = await getTranslations('console')
  return (
    <div className="min-h-screen pt-32 px-4 max-w-7xl mx-auto">
      <div className="mb-6 space-y-2">
        <div className="animate-pulse h-8 w-48 rounded-lg bg-[var(--card-hover)]" aria-hidden="true" />
        <div className="animate-pulse h-4 w-72 rounded-lg bg-[var(--card-hover)]" aria-hidden="true" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3" aria-hidden="true">
            <div className="animate-pulse h-4 w-24 rounded bg-[var(--card-hover)]" />
            <div className="animate-pulse h-8 w-32 rounded bg-[var(--card-hover)]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard showImage={false} bodyLines={5} />
        <SkeletonCard showImage={false} bodyLines={5} />
      </div>
      <span className="sr-only" role="status" aria-live="polite">{t('loadingAdminPage')}</span>
    </div>
  )
}
