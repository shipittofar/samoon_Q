/**
 * Hydration utilities — Phase 4 (P4.4.1)
 *
 * Re-exports the React Query dehydration/hydration primitives alongside
 * the server QueryClient factory so route files have a single import point.
 *
 * Server usage (Server Component page):
 *   const qc = createServerQueryClient()
 *   await qc.prefetchQuery({ queryKey: ['categories'], queryFn: ... })
 *   const dehydrated = dehydrateClient(qc)
 *   return <HydrationBoundary state={dehydrated}>...</HydrationBoundary>
 *
 * Client usage: HydrationBoundary is placed in the JSX tree automatically —
 * no additional client-side setup required. Existing useQuery hooks pick up
 * the dehydrated cache and do not issue duplicate network requests.
 */
import { dehydrate, HydrationBoundary, type DehydratedState } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

export { HydrationBoundary, type DehydratedState }
export { createServerQueryClient } from './queryClient'

/**
 * Dehydrate a server QueryClient to a serialisable snapshot.
 * Pass the result as the `state` prop of <HydrationBoundary>.
 */
export function dehydrateClient(queryClient: QueryClient): DehydratedState {
  return dehydrate(queryClient)
}
