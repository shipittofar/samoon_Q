/**
 * Health Endpoint — Phase 4 (P4.3.2 / P4.3.4 / P4.9.2)
 *
 * Liveness probe: returns 200 as long as the process is running.
 * Does not check external dependencies (that is the /api/ready concern).
 *
 * P4.9.2: Extended payload — uptime, memory, version, environment, timestamp.
 * All fields degrade gracefully when the runtime doesn't expose them.
 */
import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export async function GET() {
  // process.uptime() is available in Node.js; undefined in Edge runtime.
  const uptime = typeof process !== 'undefined' && typeof process.uptime === 'function'
    ? Math.floor(process.uptime())
    : undefined

  // process.memoryUsage() is Node.js only; not available on Edge.
  let memory: { rss: number; heapUsed: number; heapTotal: number } | undefined
  try {
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      const m = process.memoryUsage()
      memory = { rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal }
    }
  } catch {
    // Not available — omit field rather than crash.
  }

  const payload: Record<string, unknown> = {
    status: 'ok',
    version: VERSION,
    environment: process.env.NODE_ENV ?? 'unknown',
    timestamp: new Date().toISOString(),
  }

  if (uptime !== undefined) payload.uptime = uptime
  if (memory !== undefined) payload.memory = memory

  return NextResponse.json(payload, { status: 200 })
}
