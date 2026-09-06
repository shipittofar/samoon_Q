import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/constants'
import { ENDPOINTS } from '@/services/endpoints'
import { readBearerToken, requirePlatformSuperuser } from '@/lib/require-platform-superuser'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

async function tryUpstreamUpload(request: NextRequest, form: FormData): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return null
  const token = readBearerToken(request)
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.PLATFORM_HOMEPAGE.MEDIA_UPLOAD}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data?.url ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePlatformSuperuser(request)
  if (denied) return denied

  const form = await request.formData()
  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ detail: 'Image file required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ detail: 'Image too large' }, { status: 400 })
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ detail: 'Unsupported image type' }, { status: 400 })
  }

  const forwarded = new FormData()
  forwarded.append('image', file)
  const upstreamUrl = await tryUpstreamUpload(request, forwarded)
  if (upstreamUrl) return NextResponse.json({ url: upstreamUrl })

  const buf = Buffer.from(await file.arrayBuffer())
  const mime = file.type && ALLOWED.has(file.type) ? file.type : 'image/jpeg'
  const url = `data:${mime};base64,${buf.toString('base64')}`
  return NextResponse.json({ url })
}
