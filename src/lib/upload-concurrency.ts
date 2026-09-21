export const DEFAULT_UPLOAD_CONCURRENCY = 3

export interface ConcurrencyTask<T> {
  id: string
  run: (signal: AbortSignal) => Promise<T>
}

export interface ConcurrencyResult<T> {
  id: string
  status: 'fulfilled' | 'rejected' | 'cancelled'
  value?: T
  error?: unknown
}

/**
 * Run at most `limit` tasks at once. Does not use unbounded Promise.all.
 * Cancelling the parent aborts queued and in-flight work that honors the signal.
 */
export async function runWithConcurrency<T>(
  tasks: ConcurrencyTask<T>[],
  options?: { limit?: number; signal?: AbortSignal },
): Promise<ConcurrencyResult<T>[]> {
  const limit = Math.max(1, options?.limit ?? DEFAULT_UPLOAD_CONCURRENCY)
  const results: ConcurrencyResult<T>[] = tasks.map((task) => ({
    id: task.id,
    status: 'cancelled',
  }))
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor
      cursor += 1
      const task = tasks[index]!
      if (options?.signal?.aborted) {
        results[index] = { id: task.id, status: 'cancelled' }
        continue
      }
      try {
        const value = await task.run(options?.signal ?? new AbortController().signal)
        results[index] = { id: task.id, status: 'fulfilled', value }
      } catch (error) {
        const cancelled =
          options?.signal?.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        results[index] = {
          id: task.id,
          status: cancelled ? 'cancelled' : 'rejected',
          error,
        }
      }
    }
  })

  await Promise.all(workers)
  return results
}
