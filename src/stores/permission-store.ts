/**
 * Permission cache — single source for authorization checks.
 * Populated from GET /auth/me/permissions (never hardcoded ROLE_PERMISSION_MAP).
 */
import { create } from 'zustand'
import { fetchMePermissionKeys } from '@/api/permissions'
import { fetchPermissionCatalog } from '@/api/permissions'
import { getApiErrorMessage } from '@/api/errors'
import type { PermissionCatalogEntry } from '@/types/rbac-api'

export type PermissionKey = string

interface PermissionStoreState {
  permissions: PermissionKey[]
  permissionCatalog: PermissionCatalogEntry[]
  tenantId: string | null
  loading: boolean
  error: string | null
  catalogLoaded: boolean

  setPermissions: (permissions: PermissionKey[], tenantId?: string | null) => void
  clearPermissions: () => void
  fetchPermissions: (tenantSlug?: string, tenantId?: string) => Promise<PermissionKey[]>
  fetchCatalog: () => Promise<PermissionCatalogEntry[]>
  hasPermission: (permission: PermissionKey) => boolean
  hasAnyPermission: (permissions: PermissionKey[]) => boolean
  hasAllPermissions: (permissions: PermissionKey[]) => boolean
}

export const usePermissionStore = create<PermissionStoreState>((set, get) => ({
  permissions: [],
  permissionCatalog: [],
  tenantId: null,
  loading: false,
  error: null,
  catalogLoaded: false,

  setPermissions: (permissions, tenantId = null) =>
    set({
      permissions: [...new Set(permissions)],
      tenantId,
      error: null,
    }),

  clearPermissions: () =>
    set({
      permissions: [],
      tenantId: null,
      error: null,
      loading: false,
    }),

  fetchPermissions: async (tenantSlug, tenantId) => {
    set({ loading: true, error: null })
    try {
      const permissions = await fetchMePermissionKeys(tenantSlug)
      set({
        permissions: [...new Set(permissions)],
        tenantId: tenantId ?? get().tenantId,
        loading: false,
        error: null,
      })
      return permissions
    } catch (e) {
      const message = getApiErrorMessage(e, 'Failed to load permissions')
      set({
        loading: false,
        error: message,
        permissions: [],
        tenantId: tenantId ?? get().tenantId,
      })
      throw e
    }
  },

  fetchCatalog: async () => {
    const catalog = await fetchPermissionCatalog()
    set({ permissionCatalog: catalog, catalogLoaded: true })
    return catalog
  },

  hasPermission: (permission) => get().permissions.includes(permission),

  hasAnyPermission: (permissions) => {
    if (permissions.length === 0) return false
    const setPerms = new Set(get().permissions)
    return permissions.some((p) => setPerms.has(p))
  },

  hasAllPermissions: (permissions) => {
    if (permissions.length === 0) return false
    const setPerms = new Set(get().permissions)
    return permissions.every((p) => setPerms.has(p))
  },
}))

/** Non-hook access for services and auth bootstrap. */
export const permissionStore = {
  getState: () => usePermissionStore.getState(),
  fetchPermissions: (tenantSlug?: string, tenantId?: string) =>
    usePermissionStore.getState().fetchPermissions(tenantSlug, tenantId),
  clear: () => usePermissionStore.getState().clearPermissions(),
  setPermissions: (permissions: PermissionKey[], tenantId?: string | null) =>
    usePermissionStore.getState().setPermissions(permissions, tenantId),
}
