/**
 * Readiness Endpoint — Phase 4 (P4.3.3)
 *
 * Readiness probe: verifies the application is fully configured and ready to
 * serve traffic. Returns 503 when required environment variables are absent or
 * invalid so orchestrators (k8s, ECS, Render) can withhold traffic.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const readinessSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_USE_MOCK: z.enum(['true', 'false']),
})

export async function GET() {
  const result = readinessSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
  })

  if (!result.success) {
    return NextResponse.json({ status: 'not_ready' }, { status: 503 })
  }

  return NextResponse.json({ status: 'ready' }, { status: 200 })
}
