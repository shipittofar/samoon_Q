'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadService } from '@/services/upload.service'
import { createUploadIdempotencyKey } from '@/types/upload'

/**
 * Module-level scopes survive unmount. A remounted screen sees the same
 * logical action still running and cannot start a second one.
 * This is per action id, not a global upload lock.
 */
const activeScopes = new Set<string>()
const scopeListeners = new Set<() => void>()

function publishScopes(): void {
  scopeListeners.forEach((listener) => listener())
}

export interface SubmissionRunContext {
  signal: AbortSignal
  /** False after invalidate(), unmount, or a newer run of this hook instance. */
  isCurrent: () => boolean
}

/**
 * Synchronous single-flight guard for one logical user action
 * (upload + the business write that follows it).
 *
 * The ref/scope is acquired before the task's first await. React state
 * (`locked`) only mirrors that for rendering.
 */
export function useSubmissionGuard(scope?: string) {
  const inFlightRef = useRef(false)
  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const [locked, setLocked] = useState(false)

  const syncLocked = useCallback(() => {
    if (!mountedRef.current) return
    setLocked(inFlightRef.current || (scope != null && activeScopes.has(scope)))
  }, [scope])

  useEffect(() => {
    mountedRef.current = true
    scopeListeners.add(syncLocked)
    syncLocked()
    return () => {
      mountedRef.current = false
      scopeListeners.delete(syncLocked)
      abortRef.current?.abort()
    }
  }, [syncLocked])

  const releaseInstance = useCallback((generation: number) => {
    if (generation !== generationRef.current) return
    inFlightRef.current = false
    abortRef.current = null
    if (scope) activeScopes.delete(scope)
    publishScopes()
    if (mountedRef.current) setLocked(scope != null && activeScopes.has(scope))
  }, [scope])

  const invalidate = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    inFlightRef.current = false
    if (scope) activeScopes.delete(scope)
    publishScopes()
    if (mountedRef.current) setLocked(false)
  }, [scope])

  const run = useCallback(async <T>(task: (ctx: SubmissionRunContext) => Promise<T>): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined
    if (scope && activeScopes.has(scope)) return undefined

    inFlightRef.current = true
    if (scope) activeScopes.add(scope)
    const generation = ++generationRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setLocked(true)
    publishScopes()

    const isCurrent = () => generation === generationRef.current && mountedRef.current

    try {
      return await task({ signal: controller.signal, isCurrent })
    } catch {
      // Callers that need a message catch inside the task. Swallowing here
      // keeps `void guard.run(...)` from becoming an unhandled rejection
      // while `finally` still releases the lock.
      return undefined
    } finally {
      releaseInstance(generation)
    }
  }, [releaseInstance, scope])

  return { locked, run, invalidate }
}

function fileSignature(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}`
}

/**
 * One idempotency key per slot + file bytes identity.
 * A retry of the same file reuses the key. A different file gets a new key.
 * Successful business writes should `reset` so the next action is new.
 */
export function useIdempotencyKeys() {
  const keysRef = useRef(new Map<string, { sig: string; key: string }>())

  const keyFor = useCallback((slot: string, file: File | null | undefined): string | undefined => {
    if (!file) return undefined
    const sig = fileSignature(file)
    const prev = keysRef.current.get(slot)
    if (prev && prev.sig === sig) return prev.key
    if (prev) uploadService.releaseIdempotency(prev.key)
    const key = createUploadIdempotencyKey()
    keysRef.current.set(slot, { sig, key })
    return key
  }, [])

  const reset = useCallback((slot?: string) => {
    if (slot) {
      const prev = keysRef.current.get(slot)
      if (prev) uploadService.releaseIdempotency(prev.key)
      keysRef.current.delete(slot)
      return
    }
    for (const entry of keysRef.current.values()) {
      uploadService.releaseIdempotency(entry.key)
    }
    keysRef.current.clear()
  }, [])

  return { keyFor, reset }
}
