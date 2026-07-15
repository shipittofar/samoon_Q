/**
 * Offline mutation queue — Phase 4.8 (P4.8.7)
 *
 * Lightweight queue that persists pending mutations in localStorage when the
 * app is offline. When connectivity is restored, callers invoke replayQueue()
 * to replay them in insertion order.
 *
 * Design constraints met:
 *   - Additive only: no existing API contracts changed
 *   - Deduplication: mutations with the same id are not enqueued twice
 *   - Safe serialization: only JSON-serialisable payloads accepted
 *   - No duplicate submissions: each mutation is removed before replay starts
 *
 * Usage:
 *   offlineQueue.enqueue({ id: 'add-item-123', type: 'cart/add', payload: {...} })
 *   offlineQueue.replayQueue(async (m) => await apiClient.post(...))
 */

const STORAGE_KEY = 'samoon-offline-queue'

export interface OfflineMutation {
  /** Unique identifier — used for deduplication. */
  id: string
  /** Logical mutation type (e.g. 'cart/add', 'cart/remove'). */
  type: string
  /** JSON-serialisable mutation payload. */
  payload: unknown
  /** Unix timestamp (ms) when the mutation was enqueued. */
  timestamp: number
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function readQueue(): OfflineMutation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as OfflineMutation[]
  } catch {
    return []
  }
}

function writeQueue(queue: OfflineMutation[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Ignore storage errors (private browsing quota exceeded, etc.)
  }
}

// ── Queue API ─────────────────────────────────────────────────────────────────

/**
 * Add a mutation to the offline queue.
 * No-op if a mutation with the same id is already queued (deduplication).
 */
export function enqueue(mutation: Omit<OfflineMutation, 'timestamp'>): void {
  const queue = readQueue()
  if (queue.some((m) => m.id === mutation.id)) return
  queue.push({ ...mutation, timestamp: Date.now() })
  writeQueue(queue)
}

/** Return all queued mutations in insertion order. */
export function getQueue(): OfflineMutation[] {
  return readQueue()
}

/** Remove a single mutation by id. */
export function dequeue(id: string): void {
  const queue = readQueue().filter((m) => m.id !== id)
  writeQueue(queue)
}

/** Remove all queued mutations. */
export function clearQueue(): void {
  writeQueue([])
}

/**
 * Replay all queued mutations in order.
 *
 * Each mutation is dequeued BEFORE the executor runs so that a crash or
 * navigation during replay does not cause duplicate submissions.
 * If the executor throws, the error is logged but replay continues for
 * remaining mutations.
 */
export async function replayQueue(
  executor: (mutation: OfflineMutation) => Promise<void>,
): Promise<void> {
  const mutations = readQueue()
  for (const mutation of mutations) {
    dequeue(mutation.id) // remove first — prevents double submission
    try {
      await executor(mutation)
    } catch (err) {
      console.error('[offline-queue] Replay failed for mutation:', mutation.id, err)
    }
  }
}

/** Convenience singleton-style export for direct use. */
export const offlineQueue = {
  enqueue,
  getQueue,
  dequeue,
  clearQueue,
  replayQueue,
} as const
