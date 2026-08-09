import api from './client'
import { getAccessToken } from '@/services/axios.instance'
import { ENDPOINTS } from '@/services/endpoints'
import { getApiErrorMessage, getApiStatus } from './errors'
import { normalizePermissionEntry, unwrapPermissionList } from './normalizers'
import { resolveTenantSlugForApi } from '@/lib/tenant-request-context'
import type { PermissionCatalogEntry } from '@/types/rbac-api'

const PERMISSIONS_DEBUG =
  process.env.NEXT_PUBLIC_AXIOS_DEBUG === 'true' ||
  process.env.NODE_ENV === 'development'

function logPermissionRequest(url: string, tenantSlug: string | undefined): void {
  if (!PERMISSIONS_DEBUG || typeof window === 'undefined') return
  console.debug('[permissions:request]', {
    url,
    authorization: Boolean(getAccessToken()),
    tenantSlug: tenantSlug ?? undefined,
  })
}

function logPermissionResponse(url: string, status: number): void {
  if (!PERMISSIONS_DEBUG || typeof window === 'undefined') return
  console.debug('[permissions:response]', { url, status })
}

function logPermissionError(url: string, status: number | undefined, message: string): void {
  if (!PERMISSIONS_DEBUG || typeof window === 'undefined') return
  console.debug('[permissions:error]', { url, status, message })
}

export async function fetchPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  const { data } = await api.get<unknown>(ENDPOINTS.RBAC.PERMISSIONS)
  if (!Array.isArray(data)) return []
  return data
    .map((entry) => normalizePermissionEntry(entry))
    .filter((e): e is PermissionCatalogEntry => e !== null)
}

export async function fetchMePermissionKeys(tenantSlug?: string): Promise<string[]> {
  const path = ENDPOINTS.AUTH.ME_PERMISSIONS
  const resolvedSlug = resolveTenantSlugForApi(tenantSlug)
  logPermissionRequest(path, resolvedSlug)

  try {
    const headers = resolvedSlug ? { 'X-Tenant-Slug': resolvedSlug } : undefined
    const response = await api.get<unknown>(path, { headers })
    logPermissionResponse(path, response.status)
    return unwrapPermissionList(response.data)
  } catch (error) {
    const status = getApiStatus(error)
    const message = getApiErrorMessage(error, 'Failed to load permissions')
    logPermissionError(path, status, message)
    throw error
  }
}
