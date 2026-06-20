/**
 * Server-side QueryClient factory — Phase 4 (P4.4.1)
 *
 * Creates a fresh, per-request QueryClient for server-side prefetching.
 * Must NOT be shared across requests (no module-level singleton here).
 *
 * Differences from the browser client in providers/index.tsx:
 *  - retry: false  — don't retry on the server; let the client handle it
 *  - No QueryCache onError toast (no toast system on the server)
 */
import { QueryClient } from '@tanstack/react-query'

export function createServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for the duration of the server render
        staleTime: 1000 * 60 * 5,
        // Never retry on server — let the client re-fetch on failure
        retry: false,
        // Do not throw to error boundaries on server — degrade gracefully
        throwOnError: false,
      },
    },
  })
}
