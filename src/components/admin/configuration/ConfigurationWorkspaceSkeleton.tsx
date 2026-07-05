/**
 * ConfigurationWorkspaceSkeleton — P9.3 Phase N (Framework Improvement)
 *
 * Shape-matching loading placeholder for the workspace pane, shown for the
 * brief window before the registry/module data is available (today: only a
 * transient render before hydration, since ConfigurationService resolves
 * synchronously from the in-memory mock store — but this exists so a real
 * backend's async fetch has somewhere to render into without every future
 * module inventing its own skeleton).
 */
import { Skeleton } from '@/components/ui'

export function ConfigurationWorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6" role="status" aria-label="Loading configuration">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}
