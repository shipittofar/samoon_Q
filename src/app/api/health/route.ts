/**
 * Health Endpoint — Phase 4 (P4.3.2 / P4.3.4)
 *
 * Liveness probe: returns 200 as long as the process is running.
 * Does not check external dependencies (that is the /api/ready concern).
 */
import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
