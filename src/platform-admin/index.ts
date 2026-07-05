/**
 * Platform Administration Center — P9.4 public entry point
 *
 * Importing this module registers every Platform Administration module
 * (Phase C) as a side effect, mirroring `src/config/index.ts`'s pattern.
 * Consumers (routes, nav, dashboard) should import from here rather than
 * reaching into `src/platform-admin/modules/*` or `./permissions` directly.
 */
import './modules'
import './widgets'
import './search-providers'

export { PLATFORM_ROLES, PLATFORM_ROLE_LABEL, PLATFORM_ROLE_PERMISSIONS, hasPlatformPermission } from './permissions'
export type { PlatformRole, PlatformPermission } from './permissions'
export { usePlatformAdminStore } from './store'
export { usePlatformRole, usePlatformPermission } from './hooks'
export { PLATFORM_ADMIN_GROUPS } from './nav-groups'
export type { PlatformAdminGroup } from './nav-groups'
export { platformDashboardRegistry } from './dashboard'
export type { PlatformWidgetDefinition, PlatformWidgetValue, PlatformWidgetKind } from './dashboard'
export { platformSearchRegistry } from './search'
export type { PlatformSearchHit, PlatformSearchProvider } from './search'
