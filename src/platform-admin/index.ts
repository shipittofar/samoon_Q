/**
 * Platform Administration Center — P9.4 public entry point
 *
 * Importing this module registers every Platform Administration module
 * (Phase C) as a side effect, mirroring `src/config/index.ts`'s pattern.
 * Consumers (routes, nav, dashboard) should import from here rather than
 * reaching into `src/platform-admin/modules/*` or `./permissions` directly.
 *
 * P9.5.5.1 — `'@/config'` is imported first so core P9.0 modules register
 * before this file's remaining side effects. `src/config/index.ts` already
 * imports `./modules`; repeating that import is idempotent (`register()`
 * no-ops when the module id is already present). Widgets/search still
 * register from this barrel (not the config registry).
 */
import '@/config'
import './modules'
import './widgets'
import './search-providers'

export { PLATFORM_ROLES, PLATFORM_ROLE_LABEL, PLATFORM_ROLE_PERMISSIONS, hasPlatformPermission, parsePlatformRole } from './permissions'
export type { PlatformRole, PlatformPermission } from './permissions'
export { usePlatformAdminStore, applyPlatformRoleFromSession } from './store'
export { usePlatformRole, usePlatformPermission } from './hooks'
export { PLATFORM_ADMIN_GROUPS } from './nav-groups'
export type { PlatformAdminGroup } from './nav-groups'
export { platformDashboardRegistry } from './dashboard'
export type { PlatformWidgetDefinition, PlatformWidgetValue, PlatformWidgetKind } from './dashboard'
export { platformSearchRegistry } from './search'
export type { PlatformSearchHit, PlatformSearchProvider } from './search'
