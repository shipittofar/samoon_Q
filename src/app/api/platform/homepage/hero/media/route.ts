import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformSuperuser } from '@/lib/require-platform-superuser'

/**
 * Legacy multipart BFF. Hero media now uses the shared direct-upload
 * pipeline (`POST /uploads/initiate/` → storage PUT → complete).
 * Kept as an auth-gated 410 so tenant callers still receive 403.
 */
export async function POST(request: NextRequest) {
  const denied = await requirePlatformSuperuser(request)
  if (denied) return denied

  return NextResponse.json(
    { detail: 'Use POST /uploads/initiate/ for direct object-storage uploads.' },
    { status: 410 },
  )
}
