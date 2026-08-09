import api from './client'
import { normalizeGetMeResponse } from '@/lib/auth-me-normalizer'
import type { GetMeResponse } from '@/services/auth.service'
import type { User } from '@/types'

const ME = '/auth/me/'
const ME_PERMISSIONS = '/auth/me/permissions/'

export async function fetchMe(): Promise<GetMeResponse> {
  const { data } = await api.get<unknown>(ME)
  return normalizeGetMeResponse(data)
}

export async function fetchMePermissions(tenantSlug?: string): Promise<string[]> {
  const headers = tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined
  const { data } = await api.get<unknown>(ME_PERMISSIONS, { headers })
  const root = data as { permissions?: string[] }
  if (Array.isArray(root?.permissions)) {
    return root.permissions.filter((p): p is string => typeof p === 'string')
  }
  return []
}

/** User fields from GET /auth/me — single source of truth for identity. */
export async function fetchCurrentUser(): Promise<User> {
  const me = await fetchMe()
  return me.user
}
